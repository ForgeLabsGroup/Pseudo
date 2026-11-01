import { normalizeImageUpload } from '../lib/image-convert';
import {
  getAdminClient,
  PERSONA_SELECT,
  toMediaAsset,
  toPersona,
  toPersonaVersion,
} from '@pseudo/database';
import {
  CreatePersonaRequest,
  GeneratePersonaRequest,
  Id,
  PersonaIdentity,
  TrainCharacterRequest,
  UpdatePersonaRequest,
  type RunAccepted,
} from '@pseudo/shared';
import type { FastifyInstance } from 'fastify';
import { db, HttpError, must, parse } from '../lib/http';
import { createRun, runInBackground } from '../lib/runs';
import { removeMedia, uploadMedia } from '../lib/storage';
import { characterJob } from '../jobs/character';
import { personaJob, saveIdentityVersion } from '../jobs/persona';

export default async function personaRoutes(app: FastifyInstance) {
  app.get('/api/personas', async (req) => {
    const rows = db(
      await req.db
        .from('personas')
        .select(PERSONA_SELECT)
        .neq('status', 'archived')
        .order('created_at', { ascending: false }),
    );
    return { personas: rows.map((r) => toPersona(r)) };
  });

  app.post('/api/personas', async (req, reply) => {
    const body = parse(CreatePersonaRequest, req.body);
    const basics = { ...(body.name ? { name: body.name } : {}), ...body.basics };
    const row = db(
      await req.db
        .from('personas')
        .insert({
          user_id: req.user.id,
          name: basics.name ?? 'Untitled persona',
          description: body.description,
          archetype_id: body.archetypeId ?? null,
          status: body.generate ? 'generating' : 'draft',
        })
        .select(PERSONA_SELECT)
        .single(),
    );
    let runId: string | null = null;
    if (body.generate) {
      runId = await createRun(req.user.id, 'persona', row.id, body);
      runInBackground(req.user.id, runId, 'persona', row.id, (ctx) =>
        personaJob(ctx, row.id, {
          description: body.description,
          basics,
          archetypeId: body.archetypeId ?? null,
        }),
      );
    }
    reply.code(201);
    return { persona: toPersona(row), runId };
  });

  app.get('/api/personas/:id', async (req) => {
    const { id } = parse(Id, req.params);
    const row = must(
      db(await req.db.from('personas').select(PERSONA_SELECT).eq('id', id).maybeSingle()),
      'Persona',
    );
    const versions = db(
      await req.db
        .from('persona_versions')
        .select('*')
        .eq('persona_id', id)
        .order('version', { ascending: false }),
    );
    return { persona: toPersona(row), versions: versions.map(toPersonaVersion) };
  });

  /** Edits always create a new version (history is never overwritten). */
  app.patch('/api/personas/:id', async (req) => {
    const { id } = parse(Id, req.params);
    const body = parse(UpdatePersonaRequest, req.body);
    const row = must(
      db(await req.db.from('personas').select('*').eq('id', id).maybeSingle()),
      'Persona',
    );
    if (Object.keys(body.identity).length) {
      if (!row.identity) throw new HttpError(409, 'Persona has no identity yet; generate it first');
      const identity = parse(PersonaIdentity, { ...row.identity, ...body.identity });
      await saveIdentityVersion(req.user.id, id, identity, body.changeNote ?? 'Edited by user');
    }
    if (body.status) db(await req.db.from('personas').update({ status: body.status }).eq('id', id));
    const fresh = db(await req.db.from('personas').select(PERSONA_SELECT).eq('id', id).single());
    return { persona: toPersona(fresh) };
  });

  /**
   * Hard delete. Versions, content and campaigns cascade in the DB, but media_assets only set
   * persona_id null, so the persona's photos (including the user's selfies) are deleted here too.
   * Files go first: if that fails nothing is deleted and the request can be retried.
   */
  app.delete('/api/personas/:id', async (req, reply) => {
    const { id } = parse(Id, req.params);
    must(db(await req.db.from('personas').select('id').eq('id', id).maybeSingle()), 'Persona');
    const assets = db(
      await req.db.from('media_assets').select('id, storage_path').eq('persona_id', id),
    );
    await removeMedia(assets.map((a) => a.storage_path as string));
    db(await req.db.from('personas').delete().eq('id', id));
    if (assets.length)
      db(
        await req.db
          .from('media_assets')
          .delete()
          .in(
            'id',
            assets.map((a) => a.id as string),
          ),
      );
    reply.code(204);
  });

  app.post('/api/personas/:id/generate', async (req, reply): Promise<RunAccepted> => {
    const { id } = parse(Id, req.params);
    const body = parse(GeneratePersonaRequest, req.body ?? {});
    const row = must(
      db(await req.db.from('personas').select('*').eq('id', id).maybeSingle()),
      'Persona',
    );
    const runId = await createRun(req.user.id, 'persona', id, body);
    runInBackground(req.user.id, runId, 'persona', id, (ctx) =>
      personaJob(ctx, id, {
        description: row.description,
        instructions: body.instructions,
        existing: row.identity ?? undefined,
        archetypeId: row.archetype_id,
      }),
    );
    reply.code(202);
    return { runId };
  });

  /** Train the user's likeness (Higgsfield Soul ID) from the uploaded selfies. */
  app.post('/api/personas/:id/character', async (req, reply): Promise<RunAccepted> => {
    const { id } = parse(Id, req.params);
    const { provider } = parse(TrainCharacterRequest, req.body ?? {});
    const row = must(
      db(await req.db.from('personas').select('character_refs').eq('id', id).maybeSingle()),
      'Persona',
    );
    // Each training is billed, so claim "training" before responding: a second click (or a
    // concurrent request) matches no row here and gets a 409 instead of paying again.
    const status = `character_refs->${provider}->>status`;
    const claimed = db(
      await req.db
        .from('personas')
        .update({
          character_refs: {
            ...row.character_refs,
            [provider]: { id: null, status: 'training', error: null, updatedAt: new Date().toISOString() },
          },
        })
        .eq('id', id)
        .or(`${status}.is.null,${status}.neq.training`)
        .select('id'),
    );
    if (!claimed.length) throw new HttpError(409, 'Your likeness is already training');
    const runId = await createRun(req.user.id, 'visual', id, { provider, step: 'train_character' });
    runInBackground(req.user.id, runId, 'visual', id, (ctx) => characterJob(ctx, id, provider));
    reply.code(202);
    return { runId };
  });

  /** Reference selfies of the USER. These make generated images feature the user's face. */
  app.post('/api/personas/:id/reference-photos', async (req, reply) => {
    const { id } = parse(Id, req.params);
    must(db(await req.db.from('personas').select('id').eq('id', id).maybeSingle()), 'Persona');
    const file = await req.file();
    if (!file) throw new HttpError(400, 'Missing file');
    const image = await normalizeImageUpload(await file.toBuffer(), file.mimetype).catch(() => null);
    if (!image) throw new HttpError(400, 'Only JPEG, PNG, WebP or HEIC photos');
    const { path, url } = await uploadMedia(req.user.id, id, image.data, image.mimeType);
    const row = db(
      await getAdminClient()
        .from('media_assets')
        .insert({
          user_id: req.user.id,
          persona_id: id,
          kind: 'image',
          source: 'reference_upload',
          category: 'reference',
          storage_path: path,
          url,
          mime_type: image.mimeType,
        })
        .select('*')
        .single(),
    );
    // First reference photo becomes the avatar until the user picks a generated one.
    await req.db
      .from('personas')
      .update({ avatar_asset_id: row.id })
      .eq('id', id)
      .is('avatar_asset_id', null);
    reply.code(201);
    return { asset: toMediaAsset(row) };
  });
}
