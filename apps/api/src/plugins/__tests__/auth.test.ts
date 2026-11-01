import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authPlugin, { WRITE_LIMIT_PER_MINUTE } from '../auth';

const { getUser, getUserClient, handler } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserClient: vi.fn(),
  handler: vi.fn(),
}));
vi.mock('@pseudo/database', () => ({
  getAdminClient: () => ({ auth: { getUser } }),
  getUserClient,
}));

let app: FastifyInstance;
beforeEach(async () => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: 'existing-user', email: 'user@example.com' } },
    error: null,
  });
  getUserClient.mockReturnValue({ scoped: true });
  app = Fastify();
  await app.register(cors, { origin: 'https://app.example.com' });
  await app.register(authPlugin);
  app.get('/health', async () => ({ ok: true }));
  app.get('/api/events', async (req) => ({ userId: req.user.id }));
  app.get('/api/read', async (req) => ({ userId: req.user.id, db: req.db }));
  for (const path of [
    '/api/content/generate',
    '/api/archetypes/id/research',
    '/api/media/videos/generate',
    '/outside-api',
  ]) {
    app.post(path, async () => {
      handler();
      return { ok: true };
    });
  }
});
afterEach(async () => {
  await app.close();
  vi.restoreAllMocks();
});

describe('API authentication and request limits', () => {
  it('keeps health checks and CORS preflights public', async () => {
    expect((await app.inject('/health')).statusCode).toBe(200);
    expect((await app.inject({ method: 'HEAD', url: '/health' })).statusCode).toBe(200);
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/content/generate',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'POST',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each([
    '/api/content/generate',
    '/api/archetypes/id/research',
    '/api/media/videos/generate',
    '/outside-api',
  ])('blocks unauthenticated work at %s before the handler', async (url) => {
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects invalid and expired sessions before invoking handlers', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/content/generate',
          headers: { authorization: 'Bearer expired' },
        })
      ).statusCode,
    ).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(getUserClient).not.toHaveBeenCalled();
  });

  it('accepts existing and newly created project users and scopes their database clients', async () => {
    for (const id of ['existing-user', 'new-user']) {
      getUser.mockResolvedValue({
        data: { user: { id, email: id + '@example.com' } },
        error: null,
      });
      const result = await app.inject({
        url: '/api/read',
        headers: { authorization: 'bearer verified-token' },
      });
      expect(result.statusCode).toBe(200);
      expect(result.json()).toEqual({ userId: id, db: { scoped: true } });
    }
    expect(getUser).toHaveBeenLastCalledWith('verified-token');
    expect(getUserClient).toHaveBeenLastCalledWith('verified-token');
  });

  it('accepts query tokens only for GET events, never for writes or other reads', async () => {
    expect((await app.inject('/api/events?access_token=verified-token')).statusCode).toBe(200);
    expect((await app.inject('/api/read?access_token=verified-token')).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/content/generate?access_token=verified-token',
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: '/api/events?access_token=verified-token',
          headers: { authorization: 'Basic invalid' },
        })
      ).statusCode,
    ).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('limits writes across routes per user, preserves reads, and resets after a minute', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const headers = { authorization: 'Bearer verified-token' };
    for (let i = 0; i < WRITE_LIMIT_PER_MINUTE; i++) {
      expect(
        (await app.inject({ method: 'POST', url: '/api/content/generate', headers })).statusCode,
      ).toBe(200);
    }
    const limited = await app.inject({
      method: 'POST',
      url: '/api/media/videos/generate',
      headers,
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBe('60');
    expect(handler).toHaveBeenCalledTimes(WRITE_LIMIT_PER_MINUTE);
    expect((await app.inject({ url: '/api/read', headers })).statusCode).toBe(200);
    getUser.mockResolvedValueOnce({ data: { user: { id: 'another-user' } }, error: null });
    expect(
      (await app.inject({ method: 'POST', url: '/api/content/generate', headers })).statusCode,
    ).toBe(200);
    now.mockReturnValue(61_000);
    expect(
      (await app.inject({ method: 'POST', url: '/api/content/generate', headers })).statusCode,
    ).toBe(200);
  });
});
