import { Id, RefreshResearchRequest, type Archetype } from '@pseudo/shared';
import type { FastifyInstance } from 'fastify';
import { ensurePlaybook, latestPlaybook } from '../jobs/research';
import { db, must, parse } from '../lib/http';
import { createRun, runInBackground } from '../lib/runs';

const toArchetype = (r: Record<string, any>, playbookUpdatedAt: string | null): Archetype => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  guardrails: r.guardrails ?? [],
  playbookUpdatedAt,
});

export default async function archetypeRoutes(app: FastifyInstance) {
  app.get('/api/archetypes', async (req) => {
    const rows = db(await req.db.from('archetypes').select('*').order('name'));
    const archetypes = await Promise.all(
      rows.map(async (r) => toArchetype(r, (await latestPlaybook(r.id))?.createdAt ?? null)),
    );
    return { archetypes };
  });

  app.get('/api/archetypes/:id', async (req) => {
    const { id } = parse(Id, req.params);
    const row = must(
      db(await req.db.from('archetypes').select('*').eq('id', id).maybeSingle()),
      'Archetype',
    );
    const latest = await latestPlaybook(id);
    return {
      archetype: toArchetype(row, latest?.createdAt ?? null),
      playbook: latest?.playbook ?? null,
    };
  });

  /** Run (or refresh) research for an archetype. Progress over SSE. */
  app.post('/api/archetypes/:id/research', async (req, reply) => {
    const { id } = parse(Id, req.params);
    const { force } = parse(RefreshResearchRequest, req.body ?? {});
    must(db(await req.db.from('archetypes').select('id').eq('id', id).maybeSingle()), 'Archetype');
    const runId = await createRun(req.user.id, 'research', null, { archetypeId: id, force });
    runInBackground(req.user.id, runId, 'research', null, async (ctx) => {
      const playbook = await ensurePlaybook(ctx, id, { force });
      return { output: { archetypeId: id, hookFormulas: playbook.hookFormulas.length } };
    });
    reply.code(202);
    return { runId };
  });
}
