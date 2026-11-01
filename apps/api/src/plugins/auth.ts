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

/** Verifies the Supabase access token on every /api route except health. */
export default fp(async (app: FastifyInstance) => {
  app.decorateRequest('user', null as never);
  app.decorateRequest('db', null as never);
  app.addHook('onRequest', async (req: FastifyRequest) => {
    if (!req.url.startsWith('/api') || req.method === 'OPTIONS') return;
    const header = req.headers.authorization;
    // EventSource cannot send headers, so SSE passes the token as ?access_token=
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : ((req.query as Record<string, string> | undefined)?.access_token ?? null);
    if (!token) throw new HttpError(401, 'Missing access token');
    const { data, error } = await getAdminClient().auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'Invalid or expired session');
    req.user = { id: data.user.id, email: data.user.email ?? null };
    req.db = getUserClient(token);
  });
});
