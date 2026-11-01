/**
 * Apify implementation of SocialSource (Person A).
 * Uses the run-sync endpoint: POST /v2/acts/{actor}/run-sync-get-dataset-items?token=...
 * Actor IDs are env-configurable so we can swap actors without code changes.
 *
 * Input/output fields below were verified against each actor's page AND live output (Nov 2026):
 * Instagram reels return a direct `videoUrl`; TikTok returns only `webVideoUrl` (no file URL) and
 * YouTube Shorts only `url`, so those are downloaded with yt-dlp (acquire.ts).
 *
 * Media URLs from Instagram/TikTok are signed CDN links that EXPIRE, so videoUrl is only a first
 * attempt: the acquire step falls back to yt-dlp on postUrl and stores the file.
 *
 * Apify's free plan allows 5 concurrent actor runs: runs share one limiter (APIFY_MAX_CONCURRENT,
 * default 3) and retry with backoff if Apify still answers "concurrent-runs-limit-exceeded".
 */
import type { InfluencerHandles } from '@pseudo/shared';
import { createLimiter, withRetry, type Limiter } from '../limiter';
import type { SocialSource, SourcePost, SourceVideo } from '../types';

const ACTORS = () => ({
  tiktok: process.env.APIFY_TIKTOK_ACTOR ?? 'clockworks~tiktok-scraper',
  instagram: process.env.APIFY_INSTAGRAM_ACTOR ?? 'apify~instagram-reel-scraper',
  youtube: process.env.APIFY_YOUTUBE_ACTOR ?? 'streamers~youtube-shorts-scraper',
  x: process.env.APIFY_X_ACTOR ?? 'apidojo~tweet-scraper',
});

type Item = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

class ApifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
  get isConcurrencyLimit() {
    return this.status === 402 && /concurrent-runs-limit/.test(this.body);
  }
}

let limiter: Limiter | undefined;
const apifyLimiter = () =>
  (limiter ??= createLimiter(Number(process.env.APIFY_MAX_CONCURRENT ?? 3)));

/** Backoff between retries when Apify reports too many concurrent runs (overridable for tests). */
export const APIFY_RETRY_DELAYS_MS = [10_000, 20_000, 40_000];

async function runActor(actor: string, input: unknown): Promise<Item[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not set');
  const once = async () => {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=240`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new ApifyError(`Apify ${actor} ${res.status}: ${body.slice(0, 300)}`, res.status, body);
    }
    return (await res.json()) as Item[];
  };
  return apifyLimiter().run(() =>
    withRetry(
      once,
      (e) => e instanceof ApifyError && e.isConcurrencyLimit,
      APIFY_RETRY_DELAYS_MS,
      (n, ms) =>
        console.warn(`[apify] ${actor}: concurrent-run limit, retry ${n} in ${ms / 1000}s`),
    ),
  );
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);

// TikTok: `webVideoUrl` is the post page (also the yt-dlp fallback); the media link is undocumented.
const mapTikTok = (i: Item): SourceVideo => ({
  platform: 'tiktok',
  postUrl: i.webVideoUrl ?? i.url,
  videoUrl: str(i.videoMeta?.downloadAddr) ?? str(i.mediaUrls?.[0]),
  caption: str(i.text),
  postedAt: str(i.createTimeISO),
  views: num(i.playCount),
});
const mapInstagram = (i: Item): SourceVideo => ({
  platform: 'instagram',
  postUrl: i.url,
  videoUrl: str(i.videoUrl),
  caption: str(i.caption),
  postedAt: str(i.timestamp),
  views: num(i.videoPlayCount ?? i.videoViewCount),
});
const mapYouTube = (i: Item): SourceVideo => ({
  platform: 'youtube',
  postUrl: i.url,
  videoUrl: null, // actor returns no file URL; downloaded from postUrl with yt-dlp
  caption: str(i.title),
  postedAt: str(i.date),
  views: num(i.viewCount),
});
const mapTweet = (i: Item): SourcePost => ({
  text: i.fullText ?? i.text ?? '',
  url: str(i.url),
  postedAt: str(i.createdAt),
  likes: num(i.likeCount),
});

export function createApifySource(): SocialSource {
  const a = ACTORS();
  return {
    name: 'apify',
    async getRecentVideos(handles: InfluencerHandles, limit: number) {
      const jobs: { platform: string; handle: string; run: Promise<SourceVideo[]> }[] = [];
      if (handles.tiktok)
        jobs.push({
          platform: 'tiktok',
          handle: handles.tiktok,
          run: runActor(a.tiktok, { profiles: [handles.tiktok], resultsPerPage: limit }).then(
            (r) => {
              // No-result profiles come back as one placeholder item ({authorMeta,input,note}).
              const note = r.find((i) => i.note)?.note;
              if (note)
                console.warn(`[apify] tiktok @${handles.tiktok}: ${String(note).slice(0, 160)}`);
              return r
                .filter((i) => !i.error && i.webVideoUrl)
                .slice(0, limit)
                .map(mapTikTok);
            },
          ),
        });
      if (handles.instagram)
        jobs.push({
          platform: 'instagram',
          handle: handles.instagram,
          run: runActor(a.instagram, { username: [handles.instagram], resultsLimit: limit }).then(
            // The actor can return a placeholder/error item (profile URL, no media): drop it.
            (r) =>
              r
                .filter(
                  (i) =>
                    !i.error && (i.videoUrl || /instagram\.com\/(p|reels?|tv)\//.test(i.url ?? '')),
                )
                .slice(0, limit)
                .map(mapInstagram),
          ),
        });
      if (handles.youtube)
        jobs.push({
          platform: 'youtube',
          handle: handles.youtube,
          run: runActor(a.youtube, { channels: [handles.youtube], maxResultsShorts: limit }).then(
            (r) =>
              r
                .filter((i) => !i.error)
                .slice(0, limit)
                .map(mapYouTube),
          ),
        });
      // One platform failing must not kill the influencer: keep whatever succeeded, but say so.
      const settled = await Promise.allSettled(jobs.map((j) => j.run));
      const videos: SourceVideo[] = [];
      settled.forEach((s, n) => {
        const { platform, handle } = jobs[n]!;
        if (s.status === 'rejected')
          console.warn(`[apify] ${platform} @${handle} failed: ${(s.reason as Error).message}`);
        else if (!s.value.length)
          console.warn(
            `[apify] ${platform} @${handle} returned no videos (wrong handle, or no ${platform === 'youtube' ? 'Shorts' : 'public videos'})`,
          );
        else videos.push(...s.value);
      });
      const errors = settled.filter((s) => s.status === 'rejected');
      if (!videos.length && errors.length) throw (errors[0] as PromiseRejectedResult).reason;
      return videos.filter((v) => v.postUrl);
    },
    async getRecentPosts(handles: InfluencerHandles, limit: number) {
      if (!handles.x) return [];
      const items = await runActor(a.x, {
        twitterHandles: [handles.x],
        maxItems: limit,
        sort: 'Latest',
      });
      // Original posts only: retweets/replies aren't the creator's own voice.
      const posts = items
        .filter((i) => !i.noResults && !i.isRetweet && !i.isReply)
        .map(mapTweet)
        .filter((p) => p.text);
      // The actor answers with {noResults:true} placeholders when it has nothing (seen on a free plan).
      if (!posts.length)
        console.warn(
          `[apify] x @${handles.x}: no tweets returned${items.some((i) => i.noResults) ? ' (actor sent noResults; may need a paid Apify plan)' : ''}`,
        );
      return posts;
    },
  };
}
