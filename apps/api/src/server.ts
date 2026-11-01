import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { env } from './env';
import { HttpError } from './lib/http';
import authPlugin from './plugins/auth';
import contentRoutes from './routes/content';
import mediaRoutes from './routes/media';
import miscRoutes from './routes/misc';
import personaRoutes from './routes/personas';
import publishingRoutes from './routes/publishing';
import { startPublishingWorker } from './jobs/publisher';

export async function buildServer() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(cors, { origin: env.corsOrigins, credentials: true });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError)
      return reply.code(err.statusCode).send({ error: err.message, details: err.details });
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode && e.statusCode < 500)
      return reply.code(e.statusCode).send({ error: e.message });
    req.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  app.get('/health', async () => ({ ok: true }));
  await app.register(authPlugin);
  await app.register(personaRoutes);
  await app.register(contentRoutes);
  await app.register(mediaRoutes);
  await app.register(publishingRoutes);
  await app.register(miscRoutes);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    console.error(
      `Missing env: ${missing.join(', ')}. Copy .env.example to .env (see docs/ENVIRONMENT.md).`,
    );
    process.exit(1);
  }
  const app = await buildServer();
  startPublishingWorker();
  await app.listen({ port: env.port, host: env.host });
}
