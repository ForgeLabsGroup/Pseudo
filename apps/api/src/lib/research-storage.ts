import { getAdminClient } from '@pseudo/database';
import type { VideoStore } from '@pseudo/research';

/** Private bucket (no policies, service role only). See supabase/migrations/*_research_storage.sql */
export const RESEARCH_BUCKET = 'research-videos';

const bucket = () => getAdminClient().storage.from(RESEARCH_BUCKET);

/** VideoStore backed by the private Supabase bucket. Keys are `{archetype}/{influencer}/{file}`. */
export function researchVideoStore(): VideoStore {
  return {
    async get(key) {
      const { data, error } = await bucket().download(key);
      if (error || !data) return null; // not stored yet
      return { data: Buffer.from(await data.arrayBuffer()), mimeType: data.type || 'video/mp4' };
    },
    async put(key, data, mimeType) {
      const { error } = await bucket().upload(key, data, { contentType: mimeType, upsert: true });
      if (error) throw new Error(error.message);
    },
  };
}

/** Short-lived link for viewing a stored research video (the bucket itself is never public). */
export async function researchVideoUrl(path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(path, expiresInSec);
  if (error || !data) throw new Error(`Could not sign ${path}: ${error?.message}`);
  return data.signedUrl;
}
