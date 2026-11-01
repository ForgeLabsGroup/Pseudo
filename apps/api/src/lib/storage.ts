import { randomUUID } from 'node:crypto';
import { getAdminClient, MEDIA_BUCKET } from '@pseudo/database';

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'video/mp4': 'mp4',
};

/** Upload bytes to the media bucket under {userId}/{personaId}/ and return path + public URL. */
export async function uploadMedia(
  userId: string,
  personaId: string | null,
  data: Buffer,
  mimeType: string,
) {
  const path = `${userId}/${personaId ?? 'shared'}/${randomUUID()}.${EXT[mimeType] ?? 'bin'}`;
  const storage = getAdminClient().storage.from(MEDIA_BUCKET);
  const { error } = await storage.upload(path, data, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { path, url: storage.getPublicUrl(path).data.publicUrl };
}

export async function removeMedia(paths: string[]) {
  if (!paths.length) return;
  const { error } = await getAdminClient().storage.from(MEDIA_BUCKET).remove(paths);
  if (error) throw new Error(`Storage remove failed: ${error.message}`);
}

export async function downloadMedia(path: string): Promise<Buffer> {
  const { data, error } = await getAdminClient().storage.from(MEDIA_BUCKET).download(path);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}
