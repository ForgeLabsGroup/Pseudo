import { z } from 'zod';
import { Platform, PublishJobStatus, PublishMode } from './enums';

export const SocialAccount = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  platform: Platform,
  handle: z.string(),
  displayName: z.string().nullable(),
  mode: PublishMode,
  status: z.enum(['connected', 'expired', 'revoked']),
  createdAt: z.string(),
  // NOTE: tokens are never part of this schema. They live encrypted in the DB, server-only.
});
export type SocialAccount = z.infer<typeof SocialAccount>;

export const PublishingJob = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  contentId: z.uuid(),
  socialAccountId: z.uuid().nullable(),
  platform: Platform,
  mode: PublishMode,
  status: PublishJobStatus,
  runAt: z.string(),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
});
export type PublishingJob = z.infer<typeof PublishingJob>;

export const PublishingRecord = z.object({
  id: z.uuid(),
  jobId: z.uuid(),
  contentId: z.uuid(),
  platform: Platform,
  mode: PublishMode,
  success: z.boolean(),
  externalId: z.string().nullable(),
  externalUrl: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
});
export type PublishingRecord = z.infer<typeof PublishingRecord>;
