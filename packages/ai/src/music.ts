import { aiConfig } from './config';
import { synthMusicWav } from './mock/music';

export interface GeneratedMusic {
  data: Buffer;
  mimeType: string;
  durationSec: number;
  provider: string;
}

/**
 * Instrumental background track for a short video.
 *  - ElevenLabs Music when AI_VOICE_PROVIDER=elevenlabs (same key as the voiceover)
 *  - otherwise (or if ElevenLabs refuses, e.g. plan without Music) a locally synthesised lo-fi loop,
 *    so mock mode and zero-key demos still have audio.
 */
export async function generateMusic(input: {
  durationSec: number;
  /** Mood/genre hint, e.g. the persona's aesthetic. */
  style?: string;
}): Promise<GeneratedMusic> {
  const seconds = Math.max(10, Math.min(60, Math.ceil(input.durationSec) + 2));
  if (aiConfig().voice === 'elevenlabs' && process.env.ELEVENLABS_API_KEY) {
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: `Instrumental background music for a short vertical social video${input.style ? `, ${input.style}` : ''}. Chill modern lo-fi house, steady beat around 90 BPM, soft pads and warm bass, no vocals, no big drops, sits quietly under a voiceover.`,
          music_length_ms: seconds * 1000,
          force_instrumental: true,
        }),
      });
      if (!res.ok) throw new Error(`ElevenLabs Music ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return {
        data: Buffer.from(await res.arrayBuffer()),
        mimeType: 'audio/mpeg',
        durationSec: seconds,
        provider: 'elevenlabs',
      };
    } catch (err) {
      console.warn('[music] ElevenLabs failed, using synthesised track:', (err as Error).message);
    }
  }
  const synth = synthMusicWav(seconds);
  return { data: synth.data, mimeType: 'audio/wav', durationSec: synth.durationSec, provider: 'synth' };
}
