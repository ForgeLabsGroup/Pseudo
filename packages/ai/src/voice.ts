import { aiConfig } from './config';

export interface WordTiming {
  text: string;
  startSec: number;
  endSec: number;
}

export interface GeneratedVoice {
  data: Buffer;
  mimeType: string;
  durationSec: number;
  /** Word-level timings for subtitles. */
  words: WordTiming[];
  provider: string;
}

/** Returns null in mock mode: the video plays without audio and uses scene durations. */
export async function generateVoice(
  text: string,
  voiceId?: string,
): Promise<GeneratedVoice | null> {
  if (aiConfig().voice !== 'elevenlabs') return null;
  const id = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2',
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    audio_base64: string;
    alignment?: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };
  const words = charsToWords(json.alignment);
  return {
    data: Buffer.from(json.audio_base64, 'base64'),
    mimeType: 'audio/mpeg',
    durationSec: words.at(-1)?.endSec ?? 0,
    words,
    provider: 'elevenlabs',
  };
}

function charsToWords(a?: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): WordTiming[] {
  if (!a) return [];
  const words: WordTiming[] = [];
  let cur: WordTiming | null = null;
  a.characters.forEach((ch, i) => {
    const start = a.character_start_times_seconds[i] ?? 0;
    const end = a.character_end_times_seconds[i] ?? start;
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
    } else if (cur) {
      cur.text += ch;
      cur.endSec = end;
    } else {
      cur = { text: ch, startSec: start, endSec: end };
    }
  });
  if (cur) words.push(cur);
  return words;
}
