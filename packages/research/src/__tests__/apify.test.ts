import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIFY_RETRY_DELAYS_MS, createApifySource } from '../sources/apify';

type Reply = { status?: number; body: unknown };

/** Fake Apify: answers per actor, records the JSON input each actor received. */
function mockApify(replies: Record<string, Reply[]>) {
  const inputs: Record<string, unknown[]> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body: string }) => {
      const actor = /acts\/([^/]+)\//.exec(url)![1]!;
      (inputs[actor] ??= []).push(JSON.parse(init.body));
      const queue = replies[actor] ?? [{ body: [] }];
      const r = queue.length > 1 ? queue.shift()! : queue[0]!;
      const status = r.status ?? 200;
      return new Response(JSON.stringify(r.body), { status });
    }),
  );
  return inputs;
}

const HANDLES = { tiktok: 'tt', instagram: 'ig', youtube: 'yt' };
const reel = {
  url: 'https://www.instagram.com/p/ABC/',
  videoUrl: 'https://cdn/x.mp4',
  videoPlayCount: 5,
  caption: 'c',
};
const tiktok = { webVideoUrl: 'https://www.tiktok.com/@tt/video/1', playCount: 7, text: 't' };
const short = { url: 'https://www.youtube.com/shorts/xyz', viewCount: 9, title: 'y' };

beforeEach(() => {
  process.env.APIFY_TOKEN = 'test-token';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apify source', () => {
  it('maps the three video platforms and sends the verified input fields', async () => {
    const inputs = mockApify({
      'clockworks~tiktok-scraper': [{ body: [tiktok] }],
      'apify~instagram-reel-scraper': [{ body: [reel] }],
      'streamers~youtube-shorts-scraper': [{ body: [short] }],
    });
    const videos = await createApifySource().getRecentVideos(HANDLES, 2);
    expect(videos.map((v) => v.platform).sort()).toEqual(['instagram', 'tiktok', 'youtube']);
    expect(videos.find((v) => v.platform === 'instagram')).toMatchObject({
      videoUrl: reel.videoUrl,
      views: 5,
    });
    expect(videos.find((v) => v.platform === 'tiktok')?.videoUrl).toBeNull(); // yt-dlp downloads it
    expect(inputs['streamers~youtube-shorts-scraper']![0]).toEqual({
      channels: ['yt'],
      maxResultsShorts: 2,
    });
    expect(inputs['apify~instagram-reel-scraper']![0]).toEqual({
      username: ['ig'],
      resultsLimit: 2,
    });
  });

  it('drops placeholder items instead of mapping them to bogus videos', async () => {
    mockApify({
      // TikTok "no results" placeholder, Instagram profile-URL placeholder (both seen live).
      'clockworks~tiktok-scraper': [
        { body: [{ authorMeta: {}, input: 'tt', note: 'No videos found' }] },
      ],
      'apify~instagram-reel-scraper': [
        { body: [{ url: 'https://www.instagram.com/ig', error: 'no_items' }, reel] },
      ],
      'streamers~youtube-shorts-scraper': [{ body: [{ error: 'boom' }] }],
    });
    const videos = await createApifySource().getRecentVideos(HANDLES, 3);
    expect(videos).toHaveLength(1);
    expect(videos[0]!.postUrl).toBe(reel.url);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('tiktok @tt: No videos found'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('youtube @yt returned no videos'),
    );
  });

  it('retries when Apify reports the concurrent-run limit, then succeeds', async () => {
    APIFY_RETRY_DELAYS_MS.splice(0, APIFY_RETRY_DELAYS_MS.length, 1, 1, 1);
    mockApify({
      'apify~instagram-reel-scraper': [
        {
          status: 402,
          body: { error: { type: 'concurrent-runs-limit-exceeded', message: 'too many' } },
        },
        { body: [reel] },
      ],
    });
    const videos = await createApifySource().getRecentVideos({ instagram: 'ig' }, 1);
    expect(videos).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('concurrent-run limit, retry 1'),
    );
  });

  it('does not retry other 402s (e.g. out of credits) and surfaces them', async () => {
    mockApify({
      'apify~instagram-reel-scraper': [
        { status: 402, body: { error: { type: 'not-enough-usage' } } },
      ],
    });
    await expect(createApifySource().getRecentVideos({ instagram: 'ig' }, 1)).rejects.toThrow(
      /402/,
    );
  });

  it('keeps original X posts only', async () => {
    mockApify({
      'apidojo~tweet-scraper': [
        {
          body: [
            { text: 'mine', isRetweet: false, isReply: false },
            { text: 'rt', isRetweet: true },
            { text: 'reply', isReply: true },
          ],
        },
      ],
    });
    const posts = await createApifySource().getRecentPosts({ x: 'handle' }, 5);
    expect(posts.map((p) => p.text)).toEqual(['mine']);
  });
});
