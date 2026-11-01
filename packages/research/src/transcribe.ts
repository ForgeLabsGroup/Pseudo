/**
 * Speech-to-text for the vision watcher (Featherless models can't hear audio).
 * TRANSCRIBE_PROVIDER = none | mock | openai | groq   (default none -> no transcript)
 * Any OpenAI-compatible /audio/transcriptions endpoint works via TRANSCRIBE_BASE_URL.
 */
import { createReadStream } from 'node:fs';
import OpenAI from 'openai';

export interface Transcriber {
  name: string;
  transcribe(audioPath: string): Promise<string>;
}

export function getTranscriber(env: NodeJS.ProcessEnv = process.env): Transcriber | null {
  const provider = env.TRANSCRIBE_PROVIDER ?? 'none';
  if (provider === 'none') return null;
  if (provider === 'mock')
    return { name: 'mock', transcribe: async () => '[mock transcript of the spoken audio]' };

  const groq = provider === 'groq';
  if (!groq && provider !== 'openai')
    throw new Error(`Unknown TRANSCRIBE_PROVIDER "${provider}" (none|mock|openai|groq)`);
  const apiKey = env.TRANSCRIBE_API_KEY || (groq ? env.GROQ_API_KEY : env.OPENAI_API_KEY);
  if (!apiKey)
    throw new Error(
      `TRANSCRIBE_PROVIDER=${provider} needs TRANSCRIBE_API_KEY (or ${groq ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'})`,
    );
  const model = env.TRANSCRIBE_MODEL || (groq ? 'whisper-large-v3-turbo' : 'whisper-1');
  const client = new OpenAI({
    apiKey,
    baseURL: env.TRANSCRIBE_BASE_URL || (groq ? 'https://api.groq.com/openai/v1' : undefined),
  });
  return {
    name: `${provider}:${model}`,
    async transcribe(audioPath) {
      const res = await client.audio.transcriptions.create({
        file: createReadStream(audioPath),
        model,
      });
      return res.text.trim();
    },
  };
}
