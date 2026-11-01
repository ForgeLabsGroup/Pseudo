import { z } from 'zod';

/** Paid provider requests PSEUDO makes on the user's behalf (provider_usage table). */
export const UsageOperation = z.enum(['character', 'image', 'video']);
export type UsageOperation = z.infer<typeof UsageOperation>;

export const UsageStatus = z.enum(['pending', 'succeeded', 'failed']);
export type UsageStatus = z.infer<typeof UsageStatus>;

export const ProviderUsage = z.object({
  id: z.uuid(),
  personaId: z.uuid().nullable(),
  runId: z.uuid().nullable(),
  provider: z.string(),
  operation: UsageOperation,
  status: UsageStatus,
  error: z.string().nullable(),
  videoSeconds: z.number().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type ProviderUsage = z.infer<typeof ProviderUsage>;

/** GET /api/usage/higgsfield */
export const HiggsfieldUsageResponse = z.object({
  /** HIGGSFIELD_API_KEY is set on the server. */
  configured: z.boolean(),
  /** Which generations are currently routed to Higgsfield (vs mock/another provider). */
  routes: z.object({ image: z.boolean(), video: z.boolean() }),
  totals: z.object({
    requests: z.number(),
    succeeded: z.number(),
    failed: z.number(),
    pending: z.number(),
    videoSeconds: z.number(),
  }),
  byOperation: z.array(
    z.object({
      operation: UsageOperation,
      requests: z.number(),
      succeeded: z.number(),
      failed: z.number(),
    }),
  ),
  recent: z.array(ProviderUsage),
  /** Higgsfield has no balance API: credits and spend are only visible in its dashboard. */
  dashboardUrl: z.string(),
});
export type HiggsfieldUsageResponse = z.infer<typeof HiggsfieldUsageResponse>;
