import { z } from 'zod';
import { MediaCategory, MediaKind, MediaSource } from './enums';

export const MediaAsset = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  personaId: z.uuid().nullable(),
  kind: MediaKind,
  source: MediaSource,
  category: MediaCategory,
  url: z.string(),
  storagePath: z.string(),
  mimeType: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationSec: z.number().nullable(),
  prompt: z.string().nullable(),
  provider: z.string().nullable(),
  isFavorite: z.boolean(),
  /** Always true for source=ai_generated|rendered. Shown as a badge in the UI. */
  aiGenerated: z.boolean(),
  createdAt: z.string(),
});
export type MediaAsset = z.infer<typeof MediaAsset>;
