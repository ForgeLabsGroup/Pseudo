import { toAgentEvent, toAgentRun } from '@pseudo/database';
import { Id, PLATFORMS, type DashboardResponse } from '@pseudo/shared';
import { isMockMode } from '@pseudo/ai';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env';
import { subscribe } from '../lib/bus';
import { db, must, parse } from '../lib/http';

export default async function miscRoutes(app: FastifyInstance) {
  app.get('/api/auth/session', async (req) => {
    const profile = db(await req.db.from('users').select('*').eq('id', req.user.id).maybeSingle());
    return {
      user: { id: req.user.id, email: req.user.email, displayName: profile?.display_name ?? null },
      config: { aiMode: isMockMode() ? 'mock' : 'live', publishMode: env.publishMode },
    };
  });

  // ---------- campaigns (minimal) ----------
  app.get('/api/campaigns', async (req) => ({
    campaigns: db(
      await req.db.from('campaigns').select('*').order('created_at', { ascending: false }),
    ),
  }));
  app.post('/api/campaigns', async (req, reply) => {
    const body = parse(
      z.object({ personaId: z.uuid(), name: z.string().min(1), brief: z.string().optional() }),
      req.body,
    );
    const row = db(
      await req.db
        .from('campaigns')
        .insert({
          user_id: req.user.id,
          persona_id: body.personaId,
          name: body.name,
          brief: body.brief ?? null,
        })
        .select('*')
        .single(),
    );
    reply.code(201);
    return { campaign: row };
  });
  app.get('/api/campaigns/:id', async (req) => {
    const { id } = parse(Id, req.params);
    return {
      campaign: must(
        db(await req.db.from('campaigns').select('*').eq('id', id).maybeSingle()),
        'Campaign',
      ),
    };
  });

  // ---------- agents ----------
  app.get('/api/agents/runs', async (req) => {
    const q = parse(
      z.object({
        personaId: z.uuid().optional(),
        limit: z.coerce.number().int().max(100).default(30),
      }),
      req.query,
    );
    let query = req.db
      .from('agent_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(q.limit);
    if (q.personaId) query = query.eq('persona_id', q.personaId);
    return { runs: db(await query).map(toAgentRun) };
  });
  app.get('/api/agents/runs/:id', async (req) => {
    const { id } = parse(Id, req.params);
    const run = must(
      db(await req.db.from('agent_runs').select('*').eq('id', id).maybeSingle()),
      'Run',
    );
    const events = db(
      await req.db.from('agent_events').select('*').eq('run_id', id).order('created_at'),
    );
    return { run: toAgentRun(run), events: events.map(toAgentEvent) };
  });

  // ---------- dashboard / analytics ----------
  app.get('/api/analytics', async (req): Promise<DashboardResponse> => {
    const [personas, content, runs, snaps] = await Promise.all([
      req.db
        .from('personas')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'archived'),
      req.db.from('content_items').select('platform, status'),
      req.db.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(10),
      req.db.from('analytics_snapshots').select('*').order('captured_on').limit(500),
    ]);
    const items = db(content);
    const count = (s: string) => items.filter((i) => i.status === s).length;
    const snapshots = db(snaps);
    return {
      counts: {
        personas: personas.count ?? 0,
        content: items.length,
        awaitingApproval: count('awaiting_approval'),
        approved: count('approved'),
        scheduled: count('scheduled'),
        published: count('published'),
        failed: count('failed'),
      },
      byPlatform: PLATFORMS.map((platform) => ({
        platform,
        total: items.filter((i) => i.platform === platform).length,
        published: items.filter((i) => i.platform === platform && i.status === 'published').length,
      })),
      recentRuns: db(runs).map(toAgentRun),
      engagementIsSample: snapshots.length === 0 || snapshots.some((s) => s.is_sample),
      engagement: snapshots.map((s) => ({
        date: s.captured_on,
        platform: s.platform,
        impressions: s.impressions,
        likes: s.likes,
      })),
    };
  });

  // ---------- SSE ----------
  app.get('/api/events', (req, reply) => {
    reply.hijack();
    const origin = req.headers.origin;
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      ...(origin && env.corsOrigins.includes(origin)
        ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' }
        : {}),
    });
    reply.raw.write(`event: ready\ndata: {}\n\n`);
    const unsub = subscribe(req.user.id, (e) => reply.raw.write(`data: ${JSON.stringify(e)}\n\n`));
    const ping = setInterval(() => reply.raw.write(`: ping\n\n`), 15_000);
    req.raw.on('close', () => {
      clearInterval(ping);
      unsub();
    });
  });
}
