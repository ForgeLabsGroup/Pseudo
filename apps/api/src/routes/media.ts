import { toMediaAsset } from '@pseudo/database';
import {
  GenerateImageRequest,
  GenerateVideoRequest,
  Id,
  ListMediaQuery,
  PersonaIdentity,
  UpdateMediaRequest,
} from '@pseudo/shared';
import type { FastifyInstance } from 'fastify';
import { generatePersonaImage } from '../jobs/image';
import { videoJob } from '../jobs/video';
import { publish } from '../lib/bus';
import { db, HttpError, must, parse } from '../lib/http';
import { createRun, runInBackground } from '../lib/runs';
import { removeMedia } from '../lib/storage';

export default async function mediaRoutes(app: FastifyInstance) {
  app.get('/api/media', async (req) => {
    const q = parse(ListMediaQuery, req.query);
    let query = req.db
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (q.personaId) query = query.eq('persona_id', q.personaId);
    if (q.kind) query = query.eq('kind', q.kind);
    if (q.category) query = query.eq('category', q.category);
    return { assets: db(await query).map(toMediaAsset) };
  });

  app.patch('/api/media/:id', async (req) => {
    const { id } = parse(Id, req.params);
    const body = parse(UpdateMediaRequest, req.body);
    const patch: Record<string, unknown> = {};
    if (body.isFavorite !== undefined) patch.is_favorite = body.isFavorite;
    if (body.category) patch.category = body.category;
    // An empty update returns no row, which surfaced as a bogus 404.
    const query = Object.keys(patch).length
      ? req.db.from('media_assets').update(patch).eq('id', id).select('*')
      : req.db.from('media_assets').select('*').eq('id', id);
    const row = must(db(await query.maybeSingle()), 'Asset');
    return { asset: toMediaAsset(row) };
  });

  /**
   * Deletes the row and its file. The DB nulls personas.avatar_asset_id and cascades
   * content_media; rendered video/voiceover ids inside short_video bodies are cleared here.
   */
  app.delete('/api/media/:id', async (req, reply) => {
    const { id } = parse(Id, req.params);
    const asset = must(
      db(await req.db.from('media_assets').select('*').eq('id', id).maybeSingle()),
      'Asset',
    );
    await removeMedia([asset.storage_path]);
    db(await req.db.from('media_assets').delete().eq('id', id));
    if (asset.kind !== 'image') {
      const items = db(
        await req.db
          .from('content_items')
          .select('id, status, body')
          .or(`body->>videoAssetId.eq.${id},body->>voiceoverAssetId.eq.${id}`),
      );
      for (const item of items) {
        const body = { ...item.body };
        if (body.videoAssetId === id) body.videoAssetId = null;
        if (body.voiceoverAssetId === id) body.voiceoverAssetId = null;
        // Same rule as editing: approved content goes back for approval.
        const status = item.status === 'approved' ? 'awaiting_approval' : item.status;
        db(
          await req.db
            .from('content_items')
            .update({ body, status, ...(status !== item.status ? { approved_at: null } : {}) })
            .eq('id', item.id),
        );
        publish(req.user.id, { type: 'content.updated', contentId: item.id, status });
      }
    }
    reply.code(204);
  });

  /** Set an asset as the persona's avatar. */
  app.post('/api/media/:id/set-avatar', async (req) => {
    const { id } = parse(Id, req.params);
    const asset = must(
      db(await req.db.from('media_assets').select('*').eq('id', id).maybeSingle()),
      'Asset',
    );
    if (!asset.persona_id) throw new HttpError(400, 'Asset is not linked to a persona');
    db(await req.db.from('personas').update({ avatar_asset_id: id }).eq('id', asset.persona_id));
    return { ok: true };
  });

  app.post('/api/media/images/generate', async (req, reply) => {
    const body = parse(GenerateImageRequest, req.body);
    const persona = must(
      db(await req.db.from('personas').select('*').eq('id', body.personaId).maybeSingle()),
      'Persona',
    );
    const identity = parse(PersonaIdentity, persona.identity);
    const runId = await createRun(req.user.id, 'visual', body.personaId, body);
    runInBackground(req.user.id, runId, 'visual', body.personaId, async (ctx) => {
      const assets = [];
      for (let i = 0; i < body.count; i++) {
        assets.push(
          await generatePersonaImage(ctx, {
            personaId: body.personaId,
            identity,
            category: body.category,
            scene: body.prompt,
            useReference: body.useReference,
            aspectRatio: body.category === 'profile' ? '1:1' : '4:5',
            contentId: body.contentId,
          }),
        );
      }
      return { output: { assetIds: assets.map((a) => a.id) } };
    });
    reply.code(202);
    return { runId };
  });

  app.post('/api/media/videos/generate', async (req, reply) => {
    const body = parse(GenerateVideoRequest, req.body);
    const item = must(
      db(await req.db.from('content_items').select('*').eq('id', body.contentId).maybeSingle()),
      'Content',
    );
    if (item.content_type !== 'short_video' || !item.body)
      throw new HttpError(400, 'Content must be a generated short_video');
    const persona = db(
      await req.db.from('personas').select('*').eq('id', item.persona_id).single(),
    );
    const identity = parse(PersonaIdentity, persona.identity);
    const runId = await createRun(req.user.id, 'video', item.persona_id, body);
    db(await req.db.from('content_items').update({ status: 'generating' }).eq('id', item.id));
    runInBackground(req.user.id, runId, 'video', item.persona_id, (ctx) =>
      videoJob(ctx, {
        contentId: item.id,
        personaId: item.persona_id,
        identity,
        withVoiceover: body.withVoiceover,
        voiceId: body.voiceId,
      }),
    );
    reply.code(202);
    return { runId };
  });
}
