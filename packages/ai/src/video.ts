import { aiConfig } from './config';
import { higgsfieldImageToVideo } from './higgsfield';
import { traced } from './trace';

export interface GeneratedClip {
  data: Buffer;
  mimeType: string;
  provider: string;
}

export interface VideoClipInput {
  imageUrl: string;
  prompt: string;
  durationSec: number;
  subject?: 'persona' | 'broll';
}

/**
 * Turn a scene still into a moving clip. Returns null in mock mode: the template then animates
 * the still image (Ken Burns), so the pipeline still works with no video provider.
 */
export function generateVideoClip(input: VideoClipInput): Promise<GeneratedClip | null> {
  return traced('video', aiConfig().video, () => higgsfieldClip(input));
}

async function higgsfieldClip(input: VideoClipInput): Promise<GeneratedClip | null> {
  if (aiConfig().video !== 'higgsfield') return null;
  const { url, mimeType } = await higgsfieldImageToVideo(input);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Downloading clip failed: ${res.status}`);
  return { data: Buffer.from(await res.arrayBuffer()), mimeType, provider: 'higgsfield' };
}
