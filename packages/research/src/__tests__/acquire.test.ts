import { describe, expect, it, vi } from 'vitest';
import { acquireVideo, looksLikeVideo, videoKey } from '../acquire';
import type { SourceVideo, VideoStore } from '../types';

const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
const video: SourceVideo = {
  platform: 'tiktok',
  postUrl: 'https://www.tiktok.com/@someone/video/1',
  videoUrl: 'https://cdn.example.com/v.mp4',
  caption: null,
  postedAt: null,
  views: null,
};
const respond = (body: Buffer | string, init: ResponseInit = {}) =>
  (async () =>
    new Response(body as BodyInit, {
      status: 200,
      headers: { 'content-type': 'video/mp4' },
      ...init,
    })) as unknown as typeof fetch;
const memStore = (): VideoStore & { map: Map<string, Buffer> } => {
  const map = new Map<string, Buffer>();
  return {
    map,
    get: async (k) => (map.has(k) ? { data: map.get(k)!, mimeType: 'video/mp4' } : null),
    put: async (k, d) => void map.set(k, d),
  };
};

describe('videoKey', () => {
  it('is stable, lowercase, filesystem-safe and platform-prefixed', () => {
    const k = videoKey('Fitness_Coach', 'Fitness 1', video);
    expect(k).toMatch(/^fitness_coach\/fitness-1\/tiktok-[0-9a-f]{16}\.mp4$/);
    expect(videoKey('Fitness_Coach', 'Fitness 1', video)).toBe(k);
  });
});

describe('looksLikeVideo', () => {
  it('accepts mp4/mov and webm, rejects html/json error pages', () => {
    expect(looksLikeVideo(mp4)).toBe(true);
    expect(looksLikeVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...Array(20).fill(0)]))).toBe(true);
    expect(looksLikeVideo(Buffer.from('<html>expired</html>'))).toBe(false);
    expect(looksLikeVideo(Buffer.from('{"error":"x"}   '))).toBe(false);
  });
});

describe('acquireVideo', () => {
  it('downloads directly, stores a copy, and hashes it', async () => {
    const store = memStore();
    const ytdlp = vi.fn();
    const a = await acquireVideo(video, { store, key: 'k', fetchImpl: respond(mp4), ytdlp });
    expect(a.fromStore).toBe(false);
    expect(a.storageKey).toBe('k');
    expect(a.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.map.get('k')).toEqual(mp4);
    expect(ytdlp).not.toHaveBeenCalled();
    await a.cleanup();
  });

  it('reuses the stored copy without any network call', async () => {
    const store = memStore();
    store.map.set('k', mp4);
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const ytdlp = vi.fn();
    const a = await acquireVideo(video, { store, key: 'k', fetchImpl, ytdlp });
    expect(a.fromStore).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(ytdlp).not.toHaveBeenCalled();
    await a.cleanup();
  });

  it('falls back to yt-dlp when the link expired (HTML instead of video)', async () => {
    const ytdlp = vi.fn(async () => ({ data: mp4, mimeType: 'video/mp4' }));
    const a = await acquireVideo(video, {
      key: 'k',
      fetchImpl: respond('<html>expired</html>'),
      ytdlp,
    });
    expect(ytdlp).toHaveBeenCalledWith(video.postUrl, expect.any(Number));
    await a.cleanup();
  });

  it('goes straight to yt-dlp when there is no videoUrl (YouTube)', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const ytdlp = vi.fn(async () => ({ data: mp4, mimeType: 'video/mp4' }));
    const a = await acquireVideo({ ...video, videoUrl: null }, { key: 'k', fetchImpl, ytdlp });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(ytdlp).toHaveBeenCalledOnce();
    await a.cleanup();
  });

  it('rejects oversized downloads', async () => {
    const ytdlp = vi.fn(async () => {
      throw new Error('too big');
    });
    await expect(
      acquireVideo(video, { key: 'k', maxBytes: 10, fetchImpl: respond(mp4), ytdlp }),
    ).rejects.toThrow(/direct: video too large.*yt-dlp: too big/);
  });

  it('keeps going (with a warning) if storing fails', async () => {
    const store: VideoStore = {
      get: async () => null,
      put: async () => {
        throw new Error('bucket down');
      },
    };
    const a = await acquireVideo(video, { store, key: 'k', fetchImpl: respond(mp4) });
    expect(a.storageKey).toBeNull();
    expect(a.warnings[0]).toMatch(/bucket down/);
    await a.cleanup();
  });
});
