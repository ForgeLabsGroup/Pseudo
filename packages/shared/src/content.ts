import { z } from 'zod';
import { ContentStatus, ContentType, Platform } from './enums';

export const InstagramPostBody = z.object({
  type: z.literal('instagram_post'),
  caption: z.string(),
  hashtags: z.array(z.string()),
  imagePrompt: z.string().describe('Scene description for the Visual Agent'),
  altText: z.string(),
  storyIdeas: z.array(z.string()).default([]),
});

export const XPostBody = z.object({
  type: z.literal('x_post'),
  text: z.string().max(280),
});

export const XThreadBody = z.object({
  type: z.literal('x_thread'),
  posts: z.array(z.string().max(280)).min(2),
});

export const VideoScene = z.object({
  durationSec: z.number().min(1).max(15),
  visual: z.string().describe('What is on screen; used to pick/generate an image'),
  voiceover: z.string(),
  onScreenText: z.string(),
});
export type VideoScene = z.infer<typeof VideoScene>;

export const ShortVideoBody = z.object({
  type: z.literal('short_video'),
  title: z.string(),
  hook: z.string().describe('First 1-2 seconds, spoken + on screen'),
  scenes: z.array(VideoScene).min(1),
  caption: z.string(),
  hashtags: z.array(z.string()),
  /** Filled in by the video pipeline, not the Content Agent. */
  voiceoverAssetId: z.uuid().nullable().default(null),
  videoAssetId: z.uuid().nullable().default(null),
});

export const ContentBody = z.discriminatedUnion('type', [
  InstagramPostBody,
  XPostBody,
  XThreadBody,
  ShortVideoBody,
]);
export type ContentBody = z.infer<typeof ContentBody>;
export type InstagramPostBody = z.infer<typeof InstagramPostBody>;
export type XPostBody = z.infer<typeof XPostBody>;
export type XThreadBody = z.infer<typeof XThreadBody>;
export type ShortVideoBody = z.infer<typeof ShortVideoBody>;

export const ContentItem = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  personaId: z.uuid(),
  campaignId: z.uuid().nullable(),
  platform: Platform,
  contentType: ContentType,
  status: ContentStatus,
  title: z.string(),
  body: ContentBody.nullable(),
  /** Media attached via content_media, in position order. */
  media: z.array(
    z.object({ assetId: z.uuid(), url: z.string(), kind: z.string(), role: z.string() }),
  ),
  scheduledAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ContentItem = z.infer<typeof ContentItem>;
