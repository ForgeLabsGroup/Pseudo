/**
 * DB rows are snake_case; API types (packages/shared) are camelCase.
 * Every read goes through one of these so the shape is consistent everywhere.
 */
import type {
  AgentEvent,
  AgentRun,
  ContentItem,
  MediaAsset,
  Persona,
  PersonaVersion,
  PublishingJob,
  PublishingRecord,
  SocialAccount,
} from '@pseudo/shared';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const toPersona = (r: Row, avatarUrl: string | null = null): Persona => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  handle: r.handle,
  tagline: r.tagline,
  description: r.description,
  status: r.status,
  identity: r.identity,
  currentVersion: r.current_version,
  avatarUrl: avatarUrl ?? r.avatar?.url ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toPersonaVersion = (r: Row): PersonaVersion => ({
  id: r.id,
  personaId: r.persona_id,
  version: r.version,
  identity: r.identity,
  changeNote: r.change_note,
  createdAt: r.created_at,
});

export const toMediaAsset = (r: Row): MediaAsset => ({
  id: r.id,
  userId: r.user_id,
  personaId: r.persona_id,
  kind: r.kind,
  source: r.source,
  category: r.category,
  url: r.url,
  storagePath: r.storage_path,
  mimeType: r.mime_type,
  width: r.width,
  height: r.height,
  durationSec: r.duration_sec === null ? null : Number(r.duration_sec),
  prompt: r.prompt,
  provider: r.provider,
  isFavorite: r.is_favorite,
  aiGenerated: r.ai_generated,
  createdAt: r.created_at,
});

/** Expects the row selected with CONTENT_SELECT (joins content_media -> media_assets). */
export const toContentItem = (r: Row): ContentItem => ({
  id: r.id,
  userId: r.user_id,
  personaId: r.persona_id,
  campaignId: r.campaign_id,
  platform: r.platform,
  contentType: r.content_type,
  status: r.status,
  title: r.title,
  body: r.body,
  media: ((r.content_media ?? []) as Row[])
    .sort((a, b) => a.position - b.position)
    .filter((cm) => cm.media_assets)
    .map((cm) => ({
      assetId: cm.asset_id,
      url: cm.media_assets.url,
      kind: cm.media_assets.kind,
      role: cm.role,
    })),
  scheduledAt: r.scheduled_at,
  publishedAt: r.published_at,
  error: r.error,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const CONTENT_SELECT = '*, content_media(asset_id, role, position, media_assets(url, kind))';
export const PERSONA_SELECT = '*, avatar:media_assets!personas_avatar_fk(url)';

export const toAgentRun = (r: Row): AgentRun => ({
  id: r.id,
  userId: r.user_id,
  personaId: r.persona_id,
  agent: r.agent,
  status: r.status,
  input: r.input,
  output: r.output,
  error: r.error,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  createdAt: r.created_at,
});

export const toAgentEvent = (r: Row): AgentEvent => ({
  id: r.id,
  runId: r.run_id,
  step: r.step,
  message: r.message,
  data: r.data,
  createdAt: r.created_at,
});

export const toSocialAccount = (r: Row): SocialAccount => ({
  id: r.id,
  userId: r.user_id,
  platform: r.platform,
  handle: r.handle,
  displayName: r.display_name,
  mode: r.mode,
  status: r.status,
  createdAt: r.created_at,
});

export const toPublishingJob = (r: Row): PublishingJob => ({
  id: r.id,
  userId: r.user_id,
  contentId: r.content_id,
  socialAccountId: r.social_account_id,
  platform: r.platform,
  mode: r.mode,
  status: r.status,
  runAt: r.run_at,
  attempts: r.attempts,
  lastError: r.last_error,
  createdAt: r.created_at,
});

export const toPublishingRecord = (r: Row): PublishingRecord => ({
  id: r.id,
  jobId: r.job_id,
  contentId: r.content_id,
  platform: r.platform,
  mode: r.mode,
  success: r.success,
  externalId: r.external_id,
  externalUrl: r.external_url,
  error: r.error,
  createdAt: r.created_at,
});
