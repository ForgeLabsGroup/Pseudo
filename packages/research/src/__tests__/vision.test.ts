import type OpenAI from 'openai';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getTranscriber } from '../transcribe';
import type { SourceVideo, WatchMeta } from '../types';
import { createVisionWatcher, stripFences } from '../watchers/vision';
import { makeTestVideo, SAMPLE_ANALYSIS } from './helpers';

const video: SourceVideo = {
  platform: 'instagram',
  postUrl: 'https://www.instagram.com/reel/abc/',
  videoUrl: null,
  caption: 'a caption',
  postedAt: null,
  views: null,
};

/** Minimal stand-in for the OpenAI client: replies with the queued strings. */
function fakeClient(replies: string[]) {
  const create = vi.fn(async (_req: unknown) => ({
    choices: [{ message: { content: replies.shift() ?? '' } }],
  }));
  return {
    client: { apiKey: 'test', chat: { completions: { create } } } as unknown as OpenAI,
    create,
  };
}

describe('stripFences', () => {
  it('removes a markdown json fence', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe('vision watcher', () => {
  let media: { path: string; mimeType: string; sizeBytes: number };
  beforeAll(async () => {
    const v = await makeTestVideo();
    media = { path: v.path, mimeType: 'video/mp4', sizeBytes: v.data.length };
  }, 60_000);

  it('sends frames + caption + transcript and returns the parsed analysis', async () => {
    const { client, create } = fakeClient([
      '```json\n' + JSON.stringify(SAMPLE_ANALYSIS) + '\n```',
    ]);
    const transcriber = { name: 't', transcribe: async () => 'spoken words here' };
    const watcher = createVisionWatcher({ client, model: 'm', frames: 3, transcriber });
    let meta: WatchMeta = {};
    const out = await watcher.watch(video, {
      archetypeName: 'Trader',
      media,
      onMeta: (m) => (meta = m),
    });

    expect(out.hook).toBe(SAMPLE_ANALYSIS.hook);
    expect(out.durationSec).toBe(3); // overridden with the probed duration
    expect(meta).toMatchObject({ transcript: 'spoken words here', framesUsed: 3 });

    const req = create.mock.calls[0]![0] as {
      model: string;
      messages: { role: string; content: unknown }[];
    };
    expect(req.model).toBe('m');
    const parts = req.messages[1]!.content as { type: string; text?: string }[];
    expect(parts.filter((p) => p.type === 'image_url')).toHaveLength(3);
    expect(parts[0]!.text).toContain('a caption');
    expect(parts[0]!.text).toContain('spoken words here');
    expect(req.messages[0]!.content).toContain('RULES (non-negotiable)'); // SAFETY_BLOCK present
  });

  it('retries once with the validation error, then succeeds', async () => {
    const { client, create } = fakeClient(['not json at all', JSON.stringify(SAMPLE_ANALYSIS)]);
    const watcher = createVisionWatcher({ client, frames: 1, transcriber: null });
    const out = await watcher.watch(video, { archetypeName: 'Trader', media });
    expect(out.hookType).toBe('contrarian claim');
    expect(create).toHaveBeenCalledTimes(2);
    const second = create.mock.calls[1]![0] as { messages: { content: unknown }[] };
    expect(JSON.stringify(second.messages.at(-1))).toContain('invalid');
  });

  it('gives up after two invalid replies', async () => {
    const { client } = fakeClient(['{}', '{"hook":1}']);
    const watcher = createVisionWatcher({ client, frames: 1, transcriber: null });
    await expect(watcher.watch(video, { archetypeName: 'Trader', media })).rejects.toThrow(
      /invalid analysis JSON/,
    );
  });

  it('waits and retries when the provider answers 429 (concurrency limit)', async () => {
    let calls = 0;
    const create = vi.fn(async () => {
      if (++calls === 1)
        throw Object.assign(new Error('429 Concurrency limit exceeded'), { status: 429 });
      return { choices: [{ message: { content: JSON.stringify(SAMPLE_ANALYSIS) } }] };
    });
    const client = { apiKey: 'test', chat: { completions: { create } } } as unknown as OpenAI;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const watcher = createVisionWatcher({
      client,
      frames: 1,
      transcriber: null,
      retryDelaysMs: [1, 1],
    });
    const out = await watcher.watch(video, { archetypeName: 'Trader', media });
    expect(out.hook).toBe(SAMPLE_ANALYSIS.hook);
    expect(create).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('runs model calls one at a time with concurrency 1 (4-unit plan + 4-unit model)', async () => {
    let active = 0;
    let peak = 0;
    const create = vi.fn(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 30));
      active--;
      return { choices: [{ message: { content: JSON.stringify(SAMPLE_ANALYSIS) } }] };
    });
    const client = { apiKey: 'test', chat: { completions: { create } } } as unknown as OpenAI;
    const watcher = createVisionWatcher({ client, frames: 1, transcriber: null, concurrency: 1 });
    await Promise.all(
      [1, 2, 3].map(() => watcher.watch(video, { archetypeName: 'Trader', media })),
    );
    expect(create).toHaveBeenCalledTimes(3);
    expect(peak).toBe(1);
  });

  it('requires the downloaded file', async () => {
    const { client } = fakeClient([]);
    const watcher = createVisionWatcher({ client, transcriber: null });
    expect(watcher.needsMedia).toBe(true);
    await expect(watcher.watch(video, { archetypeName: 'Trader' })).rejects.toThrow(/video file/);
  });
});

describe('getTranscriber', () => {
  it('is off by default and for "none"', () => {
    expect(getTranscriber({})).toBeNull();
    expect(getTranscriber({ TRANSCRIBE_PROVIDER: 'none' })).toBeNull();
  });
  it('mock works without keys', async () => {
    expect(await getTranscriber({ TRANSCRIBE_PROVIDER: 'mock' })!.transcribe('x')).toContain(
      'mock',
    );
  });
  it('fails loudly on a missing key or unknown provider', () => {
    expect(() => getTranscriber({ TRANSCRIBE_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
    expect(() => getTranscriber({ TRANSCRIBE_PROVIDER: 'groq' })).toThrow(/GROQ_API_KEY/);
    expect(() => getTranscriber({ TRANSCRIBE_PROVIDER: 'nope' })).toThrow(/Unknown/);
  });
  it('names the provider and model when configured', () => {
    const t = getTranscriber({ TRANSCRIBE_PROVIDER: 'groq', GROQ_API_KEY: 'k' });
    expect(t?.name).toBe('groq:whisper-large-v3-turbo');
  });
});
