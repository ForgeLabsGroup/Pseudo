import { getAdminClient, getUserClient, type SupabaseClient } from '@pseudo/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { HttpError } from '../lib/http';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string | null };
    /** Supabase client scoped to the caller's JWT (RLS enforced). */
    db: SupabaseClient;
  }
}

/** Persona creation alone is 1 create + up to 20 parallel selfie uploads, so leave headroom. */
export const WRITE_LIMIT_PER_MINUTE = 60;

/** Require a session verified by this Supabase project before any route runs. */
export default fp(async (app: FastifyInstance) => {
  // Per-process protection for the single API instance, not a monetary spending cap.
  const writes = new Map<string, { count: number; resetAt: number }>();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, window] of writes) if (window.resetAt <= now) writes.delete(id);
  }, 60_000);
  cleanup.unref();
  app.addHook('onClose', async () => {
    clearInterval(cleanup);
  });
  app.decorateRequest('user', null as never);
  app.decorateRequest('db', null as never);
  app.addHook('onRequest', async (req: FastifyRequest, reply) => {
    if (req.routeOptions.url === '/health' && ['GET', 'HEAD'].includes(req.method)) return;
    if (req.method === 'OPTIONS') return;
    const header = req.headers.authorization;
    // Only EventSource needs a query token. Mutations must use the Authorization header.
    const bearer = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const eventToken =
      req.method === 'GET' && req.routeOptions.url === '/api/events'
        ? (req.query as Record<string, unknown> | undefined)?.access_token
        : undefined;
    const token =
      header !== undefined ? bearer : typeof eventToken === 'string' ? eventToken : null;
    if (!token) throw new HttpError(401, 'Missing access token');
    const { data, error } = await getAdminClient().auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'Invalid or expired session');
    if (!['GET', 'HEAD'].includes(req.method)) {
      const now = Date.now();
      let window = writes.get(data.user.id);
      if (!window || window.resetAt <= now) {
        window = { count: 0, resetAt: now + 60_000 };
        writes.set(data.user.id, window);
      }
      if (window.count >= WRITE_LIMIT_PER_MINUTE) {
        reply.header('Retry-After', Math.ceil((window.resetAt - now) / 1000));
        throw new HttpError(429, 'Too many changes. Please wait a minute and try again.');
      }
      window.count += 1;
    }
    req.user = { id: data.user.id, email: data.user.email ?? null };
    req.db = getUserClient(token);
  });
});
