/**
 * Gemini VideoWatcher — TypeScript port of claude-video's "gemini engine": hand the whole video
 * (picture + audio) to Gemini and get a structured breakdown back.
 *  - YouTube URLs are passed directly (no download).
 *  - Other videos: download -> Files API upload -> wait ACTIVE -> analyse -> delete.
 */
import { GoogleGenAI } from '@google/genai';
import { SAFETY_BLOCK } from '@pseudo/ai';
import { VideoAnalysis } from '@pseudo/shared';
import { z } from 'zod';
import type { SourceVideo, VideoWatcher } from '../types';

const PROMPT = (
  archetype: string,
) => `You are a short-form video analyst studying the "${archetype}" creator archetype.
Watch this video (visuals AND audio) and describe the reusable PATTERNS: hook technique, beat-by-beat structure,
pacing, topics, tone, on-screen text style, and visual style (settings, wardrobe, lighting, camera, editing).
Describe techniques; do NOT transcribe or quote the creator, do NOT name them, do NOT describe their face.
${SAFETY_BLOCK}
Respond with ONE JSON object matching this JSON Schema:
${JSON.stringify(z.toJSONSchema(VideoAnalysis, { io: 'input' }))}`;

const isYouTube = (url: string) => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url);

export function createGeminiWatcher(): VideoWatcher {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_VIDEO_MODEL ?? 'gemini-2.5-flash';
  return {
    name: `gemini:${model}`,
    async watch(video: SourceVideo, { archetypeName }) {
      let fileName: string | null = null;
      let part: { fileData: { fileUri: string; mimeType?: string } };
      if (video.platform === 'youtube' || isYouTube(video.postUrl)) {
        part = { fileData: { fileUri: video.postUrl } };
      } else {
        if (!video.videoUrl) throw new Error(`No downloadable video URL for ${video.postUrl}`);
        const res = await fetch(video.videoUrl);
        if (!res.ok) throw new Error(`Video download failed (${res.status}) for ${video.postUrl}`);
        const blob = new Blob([await res.arrayBuffer()], { type: 'video/mp4' });
        let file = await ai.files.upload({ file: blob, config: { mimeType: 'video/mp4' } });
        fileName = file.name ?? null;
        const started = Date.now();
        while (file.state === 'PROCESSING') {
          if (Date.now() - started > 5 * 60_000)
            throw new Error('Gemini file processing timed out');
          await new Promise((r) => setTimeout(r, 2000));
          file = await ai.files.get({ name: file.name! });
        }
        if (file.state !== 'ACTIVE') throw new Error(`Gemini file state ${file.state}`);
        part = { fileData: { fileUri: file.uri!, mimeType: file.mimeType ?? 'video/mp4' } };
      }
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [part, { text: PROMPT(archetypeName) }] }],
          config: { responseMimeType: 'application/json' },
        });
        const text = res.text ?? '';
        return VideoAnalysis.parse(JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim()));
      } finally {
        if (fileName) await ai.files.delete({ name: fileName }).catch(() => undefined);
      }
    },
  };
}
