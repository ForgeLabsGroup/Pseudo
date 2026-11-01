/**
 * Vision VideoWatcher for any OpenAI-compatible vision model (Featherless by default, e.g.
 * google/gemma-3-27b-it). These models take images, not video or audio, so we:
 *   ffmpeg -> N evenly spaced frames,  optional STT -> transcript,  caption  ->  one chat call.
 *
 * Env: VIDEO_MODEL_BASE_URL (default https://api.featherless.ai/v1)
 *      VIDEO_MODEL_API_KEY  (falls back to FEATHERLESS_API_KEY)
 *      VIDEO_MODEL_NAME     (default google/gemma-3-27b-it)
 *      VIDEO_FRAMES         (default 8)
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SAFETY_BLOCK } from '@pseudo/ai';
import { VideoAnalysis } from '@pseudo/shared';
import OpenAI from 'openai';
import { z } from 'zod';
import { createLimiter, withRetry, type Limiter } from '../limiter';
import { extractAudio, extractFrames, probeDuration } from '../media/ffmpeg';
import { getTranscriber, type Transcriber } from '../transcribe';
import type { SourceVideo, VideoWatcher } from '../types';

const SYSTEM = (
  archetype: string,
) => `You are a short-form video analyst studying the "${archetype}" creator archetype.
You are shown evenly spaced still frames from ONE short video (in order, with timestamps), plus its caption and, when available, a transcript of the audio.
Describe the reusable PATTERNS: hook technique, beat-by-beat structure, pacing (infer cut frequency from how much the frames change), topics, tone, on-screen text style, and visual style (settings, wardrobe, lighting, camera, editing).
Describe techniques; do NOT quote the transcript or caption, do NOT name the creator, do NOT describe their face or identifying features.
${SAFETY_BLOCK}
Respond with ONE JSON object only (no markdown) matching this JSON Schema:
${JSON.stringify(z.toJSONSchema(VideoAnalysis, { io: 'input' }))}`;

export function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

export interface VisionWatcherOptions {
  client?: OpenAI;
  model?: string;
  frames?: number;
  transcriber?: Transcriber | null;
  /** Model calls in flight at once (default VIDEO_MODEL_CONCURRENCY or 1). */
  concurrency?: number;
  /** Waits between retries after a 429 "concurrency limit" (default 15s, 30s, 60s, 90s). */
  retryDelaysMs?: number[];
}

/**
 * Featherless bills concurrency in "units" per model (Kimi-K3 = 4 units, a 4-unit plan = ONE
 * request at a time). All watchers in the process share this limiter.
 */
let sharedLimiter: Limiter | undefined;
const defaultLimiter = () =>
  (sharedLimiter ??= createLimiter(Number(process.env.VIDEO_MODEL_CONCURRENCY ?? 1)));

const isRateLimit = (err: unknown) => (err as { status?: number })?.status === 429;

export function createVisionWatcher(opts: VisionWatcherOptions = {}): VideoWatcher {
  const model = opts.model ?? process.env.VIDEO_MODEL_NAME ?? 'google/gemma-3-27b-it';
  const frameCount = opts.frames ?? Math.max(1, Number(process.env.VIDEO_FRAMES ?? 8));
  const client =
    opts.client ??
    new OpenAI({
      apiKey: process.env.VIDEO_MODEL_API_KEY || process.env.FEATHERLESS_API_KEY || 'missing',
      baseURL: process.env.VIDEO_MODEL_BASE_URL || 'https://api.featherless.ai/v1',
    });
  const transcriber = opts.transcriber === undefined ? getTranscriber() : opts.transcriber;
  const limiter = opts.concurrency ? createLimiter(opts.concurrency) : defaultLimiter();
  const retryDelays = opts.retryDelaysMs ?? [15_000, 30_000, 60_000, 90_000];

  return {
    name: `vision:${model}`,
    needsMedia: true,
    async watch(video: SourceVideo, { archetypeName, media, onMeta }) {
      if (!media) throw new Error('vision watcher needs the downloaded video file');
      if (client.apiKey === 'missing')
        throw new Error(
          'Set FEATHERLESS_API_KEY (or VIDEO_MODEL_API_KEY) to use the vision watcher',
        );

      const durationSec = await probeDuration(media.path);
      const frames = await extractFrames(media.path, frameCount, durationSec);
      if (!frames.length) throw new Error('Could not extract any frames from the video');

      let transcript = '';
      if (transcriber) {
        const dir = await mkdtemp(join(tmpdir(), 'pseudo-audio-'));
        try {
          const audio = join(dir, 'audio.mp3');
          if (await extractAudio(media.path, audio))
            transcript = await transcriber.transcribe(audio).catch(() => '');
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
      onMeta?.({
        transcript: transcript || undefined,
        durationSec: durationSec ?? undefined,
        framesUsed: frames.length,
      });

      const text = [
        `Platform: ${video.platform}.${durationSec ? ` Duration: ${Math.round(durationSec)}s.` : ''}`,
        video.caption ? `Caption: ${video.caption}` : 'Caption: (none)',
        transcript ? `Audio transcript: ${transcript}` : 'Audio transcript: (not available)',
        `The ${frames.length} frames follow, at ${frames.map((f) => `${f.at}s`).join(', ')}.`,
      ].join('\n');
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM(archetypeName) },
        {
          role: 'user',
          content: [
            { type: 'text', text },
            ...frames.map((f) => ({
              type: 'image_url' as const,
              image_url: { url: `data:image/jpeg;base64,${f.jpeg.toString('base64')}` },
            })),
          ],
        },
      ];

      // Not every Featherless model honours response_format, so rely on the prompt + one repair try.
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await limiter.run(() =>
          withRetry(
            () => client.chat.completions.create({ model, messages, temperature: 0.3 }),
            isRateLimit,
            retryDelays,
            (n, ms) =>
              console.warn(
                `[vision] ${model} concurrency limit (429), retry ${n} in ${ms / 1000}s`,
              ),
          ),
        );
        const raw = res.choices[0]?.message?.content ?? '';
        let parsed: unknown;
        try {
          parsed = JSON.parse(stripFences(raw));
        } catch {
          parsed = undefined;
        }
        const result = VideoAnalysis.safeParse(parsed);
        if (result.success)
          return durationSec
            ? { ...result.data, durationSec: Math.round(durationSec) }
            : result.data;
        messages.push({ role: 'assistant', content: raw });
        messages.push({
          role: 'user',
          content: `That JSON was invalid: ${result.error ? z.prettifyError(result.error) : 'not JSON'}. Return the corrected JSON object only.`,
        });
      }
      throw new Error(`Vision model "${model}" returned invalid analysis JSON twice`);
    },
  };
}
