import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { VideoAnalysis } from '@pseudo/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { researchArchetype, type AnalysisDetails } from '../index';
import type { SocialSource, SourceVideo, VideoStore, VideoWatcher } from '../types';
import { createMockWatcher } from '../watchers/mock';
import { makeTestVideo, SAMPLE_ANALYSIS } from './helpers';

const archetype = { slug: 'trader', name: 'Trader', description: 'd', guardrails: [] };
const influencers = [
  { id: 'i1', label: 'trader-1', handles: { tiktok: 'a' } },
  { id: 'i2', label: 'trader-2', handles: { tiktok: 'b' } },
  { id: 'i3', label: 'trader-3', handles: { tiktok: 'c' } },
];

describe('researchArchetype with a media-hungry watcher', () => {
  let server: Server;
  let base: string;
  let data: Buffer;

  beforeAll(async () => {
    data = (await makeTestVideo()).data;
    server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'video/mp4' }).end(data);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);
  afterAll(() => void server.close());

  const source = (): SocialSource => ({
    name: 'fake',
    getRecentVideos: async (h) => {
      const id = h.tiktok!;
      return [
        {
          platform: 'tiktok',
          postUrl: `https://tiktok.test/${id}`,
          videoUrl: `${base}/${id}.mp4`,
          caption: 'cap',
          postedAt: null,
          views: 10,
        },
      ] satisfies SourceVideo[];
    },
    getRecentPosts: async () => [],
  });

  it('downloads, stores, watches with the local file, and saves details', async () => {
    const puts: string[] = [];
    const store: VideoStore = {
      get: async () => null,
      put: async (k) => void puts.push(k),
    };
    let inFlight = 0;
    let maxInFlight = 0;
    const watcher: VideoWatcher = {
      name: 'fake-vision',
      needsMedia: true,
      async watch(_v, ctx) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        expect(ctx.media?.sizeBytes).toBe(data.length);
        ctx.onMeta?.({ transcript: 'hello', framesUsed: 4, durationSec: 3 });
        await new Promise((r) => setTimeout(r, 30));
        inFlight--;
        return SAMPLE_ANALYSIS;
      },
    };
    const saved: { details?: AnalysisDetails; watcher: string }[] = [];

    const { playbook, sourceCount } = await researchArchetype(archetype, influencers, {
      source: source(),
      watcher,
      store,
      concurrency: 2,
      saveAnalysis: async (_i, _v, _a, w, details) => void saved.push({ watcher: w, details }),
    });

    expect(sourceCount).toBe(3);
    expect(playbook.hookFormulas.length).toBeGreaterThan(0); // mock text provider
    expect(maxInFlight).toBeLessThanOrEqual(2); // concurrency cap respected
    expect(puts).toHaveLength(3);
    expect(puts[0]).toMatch(/^trader\/trader-\d\/tiktok-[0-9a-f]{16}\.mp4$/);
    expect(saved[0]).toMatchObject({
      watcher: 'fake-vision',
      details: {
        transcript: 'hello',
        framesUsed: 4,
        sizeBytes: data.length,
        mimeType: 'video/mp4',
      },
    });
    // Influencers run in parallel, so compare as sets rather than by position.
    expect(saved.map((s) => s.details!.storagePath).sort()).toEqual([...puts].sort());
    expect(saved[0]!.details!.contentHash).toMatch(/^[0-9a-f]{64}$/);
  }, 60_000);

  it('skips a video whose download fails and still builds from the rest', async () => {
    const failing: SocialSource = {
      ...source(),
      getRecentVideos: async (h) =>
        h.tiktok === 'a'
          ? [
              {
                platform: 'tiktok',
                postUrl: 'https://tiktok.test/a',
                videoUrl: `${base}/a.mp4`,
                caption: null,
                postedAt: null,
                views: 1,
              },
            ]
          : source().getRecentVideos(h, 1),
    };
    const progress = vi.fn();
    const watcher: VideoWatcher = {
      name: 'w',
      needsMedia: true,
      watch: vi.fn(async (v) => {
        if (v.postUrl.endsWith('/a')) throw new Error('model exploded');
        return SAMPLE_ANALYSIS as VideoAnalysis;
      }),
    };
    const { sourceCount } = await researchArchetype(archetype, influencers, {
      source: failing,
      watcher,
      progress,
    });
    expect(sourceCount).toBe(2);
    expect(progress).toHaveBeenCalledWith(
      'watch_failed',
      expect.stringContaining('model exploded'),
    );
  }, 60_000);

  it('does not download anything for watchers that fetch the video themselves (mock mode)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sourceCount } = await researchArchetype(archetype, influencers, {
      source: source(),
      watcher: createMockWatcher(),
    });
    expect(sourceCount).toBe(3);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  }, 30_000);
});
