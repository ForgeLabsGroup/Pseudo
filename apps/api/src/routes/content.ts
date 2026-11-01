import { CONTENT_SELECT, toContentItem } from '@pseudo/database';
import {
  ApproveContentRequest,
  ContentBody,
  GenerateContentRequest,
  Id,
  ListContentQuery,
  PLATFORM_CONTENT_TYPES,
  PersonaIdentity,
  RegenerateContentRequest,
  UpdateContentRequest,
} from '@pseudo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { contentJob } from '../jobs/content';
import { db, HttpError, must, parse } from '../lib/http';
import { publish } from '../lib/bus';
import { createRun, runInBackground } from '../lib/runs';

const LOCKED = ['publishing', 'published', 'scheduled'];

export default async function contentRoutes(app: FastifyInstance) {
  app.get('/api/content', async (req) => {
    const q = parse(ListContentQuery, req.query);
    let query = req.db
      .from('content_items')
      .select(CONTENT_SELECT)
      .order('created_at', { ascending: false })
      .limit(q.limit);
    if (q.personaId) query = query.eq('persona_id', q.personaId);
    if (q.platform) query = query.eq('platform', q.platform);
    if (q.status) query = query.eq('status', q.status);
    return { items: db(await query).map(toContentItem) };
  });

  app.get('/api/content/:id', async (req) => {
    const { id } = parse(Id, req.params);
    const row = must(
      db(await req.db.from('content_items').select(CONTENT_SELECT).eq('id', id).maybeSingle()),
      'Content',
    );
    return { item: toContentItem(row) };
  });

  /** Manual create (user writes the content themselves). */
  app.post('/api/content', async (req, reply) => {
    const body = parse(
      z.object({
        personaId: z.uuid(),
        platform: z.enum(['instagram', 'tiktok', 'youtube_shorts', 'x']),
        body: ContentBody,
        title: z.string().optional(),
      }),
      req.body,
    );
    const row = db(
      await req.db
        .from('content_items')
        .insert({
          user_id: req.user.id,
          persona_id: body.personaId,
          platform: body.platform,
          content_type: body.body.type,
          body: body.body,
          title: body.title ?? '',
          status: 'awaiting_approval',
        })
        .select(CONTENT_SELECT)
        .single(),
    );
    reply.code(201);
    return { item: toContentItem(row) };
  });

  /** Proof of Life Studio. Creates placeholders immediately, fills them in the background. */
  app.post('/api/content/generate', async (req, reply) => {
    const body = parse(GenerateContentRequest, req.body);
    if (!PLATFORM_CONTENT_TYPES[body.platform].includes(body.contentType))
      throw new HttpError(400, `${body.contentType} is not valid for ${body.platform}`);
    const persona = must(
      db(await req.db.from('personas').select('*').eq('id', body.personaId).maybeSingle()),
      'Persona',
    );
    const identity = parse(PersonaIdentity, persona.identity);
    const placeholders = db(
      await req.db
        .from('content_items')
        .insert(
          Array.from({ length: body.count }, () => ({
            user_id: req.user.id,
            persona_id: body.personaId,
            campaign_id: body.campaignId ?? null,
            platform: body.platform,
            content_type: body.contentType,
            status: 'generating',
            title: 'Generating…',
          })),
        )
        .select('id'),
    );
    const contentIds = placeholders.map((p) => p.id as string);
    const runId = await createRun(req.user.id, 'content', body.personaId, body);
    await req.db.from('content_items').update({ agent_run_id: runId }).in('id', contentIds);
    runInBackground(req.user.id, runId, 'content', body.personaId, (ctx) =>
      contentJob(ctx, {
        personaId: body.personaId,
        personaVersion: persona.current_version,
        identity,
        platform: body.platform,
        contentType: body.contentType,
        topic: body.topic,
        tone: body.tone,
        withImage: body.withImage,
        contentIds,
      }),
    );
    reply.code(202);
    return { runId, contentIds };
  });

  app.patch('/api/content/:id', async (req) => {
    const { id } = parse(Id, req.params);
    const body = parse(UpdateContentRequest, req.body);
    const row = must(
      db(await req.db.from('content_items').select('*').eq('id', id).maybeSingle()),
      'Content',
    );
    if (LOCKED.includes(row.status))
      throw new HttpError(409, `Cannot edit content that is ${row.status}`);
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.body) {
      patch.body = body.body;
      patch.content_type = body.body.type;
    }
    if (body.platform) patch.platform = body.platform;
    // Any edit to approved content sends it back for re-approval.
    if (Object.keys(patch).length && row.status === 'approved') {
      patch.status = 'awaiting_approval';
      patch.approved_at = null;
    }
    if (Object.keys(patch).length)
      db(await req.db.from('content_items').update(patch).eq('id', id));
    if (body.mediaAssetIds) {
      db(await req.db.from('content_media').delete().eq('content_id', id).eq('role', 'primary'));
      if (body.mediaAssetIds.length)
        db(
          await req.db
            .from('content_media')
            .insert(
              body.mediaAssetIds.map((assetId, position) => ({
                content_id: id,
                asset_id: assetId,
                user_id: req.user.id,
                role: 'primary',
                position,
              })),
            ),
        );
    }
    const fresh = db(
      await req.db.from('content_items').select(CONTENT_SELECT).eq('id', id).single(),
    );
    publish(req.user.id, { type: 'content.updated', contentId: id, status: fresh.status });
    return { item: toContentItem(fresh) };
  });

  /** Explicit human approval. Nothing can be published without approved_at being set here. */
  app.post('/api/content/:id/approve', async (req) => {
    const { id } = parse(Id, req.params);
    const { approved } = parse(ApproveContentRequest, req.body ?? { approved: true });
    const row = must(
      db(await req.db.from('content_items').select('*').eq('id', id).maybeSingle()),
      'Content',
    );
    if (!row.body) throw new HttpError(409, 'Content has not finished generating');
    if (LOCKED.includes(row.status)) throw new HttpError(409, `Content is already ${row.status}`);
    db(
      await req.db
        .from('content_items')
        .update(
          approved
            ? { status: 'approved', approved_at: new Date().toISOString() }
            : { status: 'rejected', approved_at: null },
        )
        .eq('id', id),
    );
    const fresh = db(
      await req.db.from('content_items').select(CONTENT_SELECT).eq('id', id).single(),
    );
    publish(req.user.id, { type: 'content.updated', contentId: id, status: fresh.status });
    return { item: toContentItem(fresh) };
  });

  app.post('/api/content/:id/regenerate', async (req, reply) => {
    const { id } = parse(Id, req.params);
    const body = parse(RegenerateContentRequest, req.body ?? {});
    const row = must(
      db(await req.db.from('content_items').select('*').eq('id', id).maybeSingle()),
      'Content',
    );
    if (LOCKED.includes(row.status))
      throw new HttpError(409, `Cannot regenerate content that is ${row.status}`);
    const persona = db(await req.db.from('personas').select('*').eq('id', row.persona_id).single());
    db(
      await req.db
        .from('content_items')
        .update({ status: 'generating', approved_at: null })
        .eq('id', id),
    );
    db(await req.db.from('content_media').delete().eq('content_id', id));
    const runId = await createRun(req.user.id, 'content', row.persona_id, {
      contentId: id,
      ...body,
    });
    runInBackground(req.user.id, runId, 'content', row.persona_id, (ctx) =>
      contentJob(ctx, {
        personaId: row.persona_id,
        personaVersion: persona.current_version,
        identity: parse(PersonaIdentity, persona.identity),
        platform: row.platform,
        contentType: row.content_type,
        instructions: body.instructions,
        withImage: row.content_type === 'instagram_post',
        contentIds: [id],
      }),
    );
    reply.code(202);
    return { runId };
  });
}
