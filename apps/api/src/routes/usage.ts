import { aiConfig } from '@pseudo/ai';
import { toProviderUsage } from '@pseudo/database';
import { UsageOperation, type HiggsfieldUsageResponse } from '@pseudo/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../lib/http';

export default async function usageRoutes(app: FastifyInstance) {
  app.get('/api/usage/higgsfield', async (req): Promise<HiggsfieldUsageResponse> => {
    const rows = db(
      await req.db
        .from('provider_usage')
        .select('*')
        .eq('provider', 'higgsfield')
        .order('started_at', { ascending: false })
        .limit(1000),
    ).map(toProviderUsage);
    const by = (list: typeof rows) => ({
      requests: list.length,
      succeeded: list.filter((r) => r.status === 'succeeded').length,
      failed: list.filter((r) => r.status === 'failed').length,
    });
    const config = aiConfig();
    return {
      configured: Boolean(process.env.HIGGSFIELD_API_KEY),
      routes: { image: config.image === 'higgsfield', video: config.video === 'higgsfield' },
      totals: {
        ...by(rows),
        pending: rows.filter((r) => r.status === 'pending').length,
        videoSeconds: rows
          .filter((r) => r.status === 'succeeded')
          .reduce((sum, r) => sum + (r.videoSeconds ?? 0), 0),
      },
      byOperation: UsageOperation.options.map((operation) => ({
        operation,
        ...by(rows.filter((r) => r.operation === operation)),
      })),
      recent: rows.slice(0, 25),
      dashboardUrl: 'https://cloud.higgsfield.ai',
    };
  });
}
