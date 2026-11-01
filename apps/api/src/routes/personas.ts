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
  UpdatePersonaRequest,
  type RunAccepted,
} from '@pseudo/shared';
import type { FastifyInstance } from 'fastify';
import { db, HttpError, must, parse } from '../lib/http';
import { createRun, runInBackground } from '../lib/runs';
import { uploadMedia } from '../lib/storage';
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
    const row = db(
      await req.db
        .from('personas')
        .insert({
          user_id: req.user.id,
          name: body.name ?? 'Untitled persona',
          description: body.description,
          status: body.generate ? 'generating' : 'draft',
        })
        .select(PERSONA_SELECT)
        .single(),
    );
    let runId: string | null = null;
    if (body.generate) {
      runId = await createRun(req.user.id, 'persona', row.id, body);
      runInBackground(req.user.id, runId, 'persona', row.id, (ctx) =>
        personaJob(ctx, row.id, { description: body.description }),
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
      }),
    );
    reply.code(202);
    return { runId };
  });

  /** Reference selfies of the USER. These make generated images feature the user's face. */
  app.post('/api/personas/:id/reference-photos', async (req, reply) => {
    const { id } = parse(Id, req.params);
    must(db(await req.db.from('personas').select('id').eq('id', id).maybeSingle()), 'Persona');
    const file = await req.file();
    if (!file) throw new HttpError(400, 'Missing file');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new HttpError(400, 'Only JPEG, PNG or WebP');
    const data = await file.toBuffer();
    const { path, url } = await uploadMedia(req.user.id, id, data, file.mimetype);
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
          mime_type: file.mimetype,
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
