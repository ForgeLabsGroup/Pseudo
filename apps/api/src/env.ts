export const env = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  /** Comma-separated list of allowed web origins. */
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim()),
  publishMode: (process.env.PUBLISH_MODE ?? 'mock') as 'mock' | 'live',
};
