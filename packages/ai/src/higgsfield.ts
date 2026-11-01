/**
 * Higgsfield provider (Person C). Higgsfield is built for AI influencers:
 *  - Soul ID: train a reusable character from the user's selfies -> consistent likeness
 *  - Soul image generation with that character
 *  - image -> video (DoP and other hosted video models) for real motion in Reels/TikToks
 *
 * API: https://docs.higgsfield.ai  (key from https://cloud.higgsfield.ai / console; needs a funded balance)
 * Everything is async: submit -> poll request status -> download result URL.
 *
 * TODO(C): fill in the request bodies/paths from the docs. The function signatures are what the
 * rest of the app depends on — keep them stable.
 */
import type { GenerateImageArgs, GeneratedImage } from './image';

const BASE = () => process.env.HIGGSFIELD_BASE_URL ?? 'https://platform.higgsfield.ai';

function authHeaders(): Record<string, string> {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key) throw new Error('HIGGSFIELD_API_KEY is not set');
  // TODO(C): confirm header format in docs (key id + secret).
  return {
    authorization: `Key ${key}${secret ? `:${secret}` : ''}`,
    'content-type': 'application/json',
  };
}

export async function higgsfieldFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Higgsfield ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** Poll an async request until it finishes. */
export async function waitFor<T>(
  poll: () => Promise<{ done: boolean; failed?: string; value?: T }>,
  timeoutMs = 10 * 60_000,
): Promise<T> {
  const start = Date.now();
  let delay = 2000;
  while (Date.now() - start < timeoutMs) {
    const r = await poll();
    if (r.failed) throw new Error(r.failed);
    if (r.done) return r.value as T;
    await new Promise((res) => setTimeout(res, delay));
    delay = Math.min(delay * 1.5, 10_000);
  }
  throw new Error('Higgsfield request timed out');
}

/** Train a Soul ID character from PUBLIC image URLs of the user. Returns the character id. */
export async function createCharacter(_input: {
  name: string;
  imageUrls: string[];
}): Promise<{ id: string }> {
  throw new Error(
    'Higgsfield createCharacter not wired yet (TODO C: docs.higgsfield.ai, Soul ID / character reference)',
  );
}

/** Status of a character being trained. */
export async function getCharacter(
  _id: string,
): Promise<{ status: 'training' | 'ready' | 'failed'; error?: string }> {
  throw new Error('Higgsfield getCharacter not wired yet');
}

/** Photoreal image of the character (args.characterId) in the scene described by args.prompt. */
export async function higgsfieldImage(_args: GenerateImageArgs): Promise<GeneratedImage> {
  throw new Error('Higgsfield image generation not wired yet');
}

/** Animate a still (public URL) into a short vertical clip. Returns a downloadable video URL. */
export async function higgsfieldImageToVideo(_input: {
  imageUrl: string;
  prompt: string;
  durationSec: number;
}): Promise<{ url: string; mimeType: string }> {
  throw new Error('Higgsfield image-to-video not wired yet');
}
