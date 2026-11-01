/**
 * Higgsfield provider (Person C). Higgsfield is built for AI influencers:
 *  - Soul ID: train a reusable character from the user's selfies -> consistent likeness
 *  - Soul image generation with that character
 *  - image -> video (DoP and other hosted video models) for real motion in Reels/TikToks
 *
 * Uses the official SDK (@higgsfield/client/v2), server-side only. Auth: HF_CREDENTIALS=key-id:key-secret.
 * Wired: Kling 3.0 video, Marketing Studio Image, Soul 2 + Soul ID. Keep signatures stable.
 */
import { config, higgsfield, type V2Response } from '@higgsfield/client/v2';
import type { GenerateImageArgs, GeneratedImage } from './image';

/** Kling 3.0 (std tier) image-to-video. Billed per second, so keep clips short. */
export const KLING_I2V_MODEL = 'kling-video/v3.0/std/image-to-video';
export const KLING_T2V_MODEL = 'kling-video/v3.0/std/text-to-video';
/** Marketing Studio Image: cheap (~$0.011/img). With image_urls it edits the selfie (e.g. new background). */
export const MARKETING_IMAGE_MODEL = 'marketing-studio/image';
/** Soul 2: photoreal images of a trained Soul ID (custom_reference_id). */
export const SOUL_MODEL = 'higgsfield-ai/soul/v2/standard';

const API = 'https://api.higgsfield.ai';

/** Cost guard: hard cap on clip length (Kling is ~$0.042/s after discount). Override with HIGGSFIELD_MAX_CLIP_SEC. */
const maxClipSec = () => Number(process.env.HIGGSFIELD_MAX_CLIP_SEC ?? 5);

/** Seconds actually requested (and billed) for a scene: Kling min 3s, capped by the cost guard. */
export const higgsfieldClipSeconds = (durationSec: number) =>
  Math.min(Math.max(Math.round(durationSec), 3), maxClipSec());

let configured = false;
function client() {
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials) throw new Error('HF_CREDENTIALS is not set (format key-id:key-secret, server-side only)');
  if (!configured) {
    // Image ~1.5 min, Kling clips 1-3 min: allow 10 min before the SDK gives up (default 5).
    config({ credentials, maxPollTime: 10 * 60_000 });
    configured = true;
  }
  return higgsfield;
}

/** Run a model to completion. Throws unless the request actually completed. */
async function subscribeCompleted(model: string, input: Record<string, unknown>): Promise<V2Response> {
  const result: V2Response = await client().subscribe(model, { input, withPolling: true });
  if (result.status === 'nsfw') throw new Error(`Higgsfield request ${result.request_id} was moderated (nsfw)`);
  if (result.status !== 'completed') throw new Error(`Higgsfield request ${result.request_id} ended as "${result.status}"`);
  return result;
}

export async function subscribeVideo(model: string, input: Record<string, unknown>): Promise<{ url: string; requestId: string }> {
  const result = await subscribeCompleted(model, input);
  const url = result.video?.url;
  if (!url) throw new Error(`Higgsfield request ${result.request_id} completed without a video URL`);
  return { url, requestId: result.request_id };
}

async function subscribeImage(model: string, input: Record<string, unknown>): Promise<{ url: string; requestId: string }> {
  const result = await subscribeCompleted(model, input);
  const url = result.images?.[0]?.url;
  if (!url) throw new Error(`Higgsfield request ${result.request_id} completed without an image URL`);
  return { url, requestId: result.request_id };
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

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials) throw new Error('HF_CREDENTIALS is not set (format key-id:key-secret, server-side only)');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Key ${credentials}`, 'content-type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Higgsfield ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** Train a Soul 2 ID from PUBLIC image URLs of the user. Returns the character id. */
export async function createCharacter(input: {
  name: string;
  imageUrls: string[];
}): Promise<{ id: string }> {
  const res = await rest<{ id: string }>('/v1/custom-references', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      model_version: 'v2', // default is v1, which Soul 2 generation cannot use
      input_images: input.imageUrls.map((image_url) => ({ type: 'image_url', image_url })),
    }),
  });
  return { id: res.id };
}

/** Status of a character being trained. */
export async function getCharacter(
  id: string,
): Promise<{ status: 'training' | 'ready' | 'failed'; error?: string }> {
  const res = await rest<{ status: string }>(`/v1/custom-references/${id}`);
  if (res.status === 'completed') return { status: 'ready' };
  if (res.status === 'failed') return { status: 'failed', error: 'Higgsfield Soul ID training failed' };
  return { status: 'training' };
}

// Neither model supports 4:5, so use the closest portrait ratio.
const IMAGE_RATIO: Record<NonNullable<GenerateImageArgs['aspectRatio']>, string> = {
  '1:1': '1:1',
  '4:5': '3:4',
  '9:16': '9:16',
  '16:9': '16:9',
};

/**
 * Photoreal image of the user as their persona.
 *  - trained Soul ID (args.characterId) -> Soul 2 (best likeness across many shots)
 *  - otherwise selfie URLs (args.referenceUrls) -> Marketing Studio Image edit mode
 *  - otherwise plain text-to-image
 * Cheap defaults: 1 image, lowest resolution.
 */
export async function higgsfieldImage(args: GenerateImageArgs): Promise<GeneratedImage> {
  const aspect_ratio = IMAGE_RATIO[args.aspectRatio ?? '4:5'];
  let model: string;
  let input: Record<string, unknown>;
  if (args.characterId) {
    model = SOUL_MODEL;
    input = {
      prompt: args.prompt,
      custom_reference_id: args.characterId,
      aspect_ratio,
      resolution: '720p',
      batch_size: 1,
      enhance_prompt: false, // our prompt is already written for realism; Soul's enhancer adds a stylised look
    };
  } else {
    model = MARKETING_IMAGE_MODEL;
    const refs = (args.referenceUrls ?? []).slice(0, 2);
    // Edit mode treats the prompt as an instruction on the photo, so say explicitly to keep the face.
    const prompt = refs.length
      ? `Edit this photo of a real person. Keep the exact same person: identical face, skin tone, hair and body. Change only the setting, outfit and lighting to: ${args.prompt}. It must look like an unedited phone photo: natural skin texture with pores and fine lines, no airbrushing, no extra people.`
      : args.prompt;
    input = { prompt, aspect_ratio, resolution: '1k', ...(refs.length ? { image_urls: refs } : {}) };
  }
  const { url } = await subscribeImage(model, input);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Downloading Higgsfield image failed: ${res.status}`);
  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  return { data: Buffer.from(await res.arrayBuffer()), mimeType, provider: 'higgsfield', model };
}

/** Animate a still (public URL) into a short clip with Kling 3.0. Returns a downloadable video URL. */
export async function higgsfieldImageToVideo(input: {
  imageUrl: string;
  prompt: string;
  durationSec: number;
}): Promise<{ url: string; mimeType: string }> {
  const duration = higgsfieldClipSeconds(input.durationSec);
  const { url } = await subscribeVideo(KLING_I2V_MODEL, {
    image_url: input.imageUrl,
    prompt: input.prompt,
    duration,
    sound: 'off', // we add our own voice/music; avoids paying for generated audio
  });
  return { url, mimeType: 'video/mp4' };
}
