import { z } from 'zod';

export const PLATFORMS = ['instagram', 'tiktok', 'youtube_shorts', 'x'] as const;
export const Platform = z.enum(PLATFORMS);
export type Platform = z.infer<typeof Platform>;

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube_shorts: 'YouTube Shorts',
  x: 'X',
};

/** What kind of thing a content item is. Platform + type decide the body shape. */
export const CONTENT_TYPES = ['instagram_post', 'x_post', 'x_thread', 'short_video'] as const;
export const ContentType = z.enum(CONTENT_TYPES);
export type ContentType = z.infer<typeof ContentType>;

/** Which content types are valid for which platform. */
export const PLATFORM_CONTENT_TYPES: Record<Platform, ContentType[]> = {
  instagram: ['instagram_post'],
  x: ['x_post', 'x_thread'],
  tiktok: ['short_video'],
  youtube_shorts: ['short_video'],
};

export const CONTENT_STATUSES = [
  'draft',
  'generating',
  'awaiting_approval',
  'approved',
  'rejected',
  'scheduled',
  'publishing',
  'published',
  'failed',
] as const;
export const ContentStatus = z.enum(CONTENT_STATUSES);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const PERSONA_STATUSES = ['generating', 'draft', 'active', 'archived', 'failed'] as const;
export const PersonaStatus = z.enum(PERSONA_STATUSES);
export type PersonaStatus = z.infer<typeof PersonaStatus>;

export const MEDIA_KINDS = ['image', 'video', 'audio'] as const;
export const MediaKind = z.enum(MEDIA_KINDS);
export type MediaKind = z.infer<typeof MediaKind>;

/** reference = a real selfie the user uploaded of themselves. Everything else is AI-generated. */
export const MEDIA_SOURCES = ['reference_upload', 'ai_generated', 'rendered'] as const;
export const MediaSource = z.enum(MEDIA_SOURCES);
export type MediaSource = z.infer<typeof MediaSource>;

export const MEDIA_CATEGORIES = [
  'reference',
  'profile',
  'lifestyle',
  'car',
  'interior',
  'travel',
  'yacht',
  'fitness',
  'workspace',
  'other',
] as const;
export const MediaCategory = z.enum(MEDIA_CATEGORIES);
export type MediaCategory = z.infer<typeof MediaCategory>;

export const AGENT_NAMES = [
  'persona',
  'strategy',
  'content',
  'visual',
  'video',
  'distribution',
  'analytics',
  'research',
] as const;
export const AgentName = z.enum(AGENT_NAMES);
export type AgentName = z.infer<typeof AgentName>;

export const RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;
export const RunStatus = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatus>;

export const PUBLISH_JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export const PublishJobStatus = z.enum(PUBLISH_JOB_STATUSES);
export type PublishJobStatus = z.infer<typeof PublishJobStatus>;

export const PUBLISH_MODES = ['mock', 'live'] as const;
export const PublishMode = z.enum(PUBLISH_MODES);
export type PublishMode = z.infer<typeof PublishMode>;
