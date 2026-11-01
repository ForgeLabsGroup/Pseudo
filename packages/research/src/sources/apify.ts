/**
 * Apify implementation of SocialSource (Person A).
 * Uses the run-sync endpoint: POST /v2/acts/{actor}/run-sync-get-dataset-items?token=...
 * Actor IDs are env-configurable so we can swap actors without code changes.
 *
 * TODO(A): verify each actor's INPUT fields and OUTPUT field names on its Apify page, then
 * adjust the `input` objects and `map*` functions below. Test with one Trader influencer first.
 */
import type { InfluencerHandles } from '@pseudo/shared';
import type { SocialSource, SourcePost, SourceVideo } from '../types';

const ACTORS = () => ({
  tiktok: process.env.APIFY_TIKTOK_ACTOR ?? 'clockworks~tiktok-scraper',
  instagram: process.env.APIFY_INSTAGRAM_ACTOR ?? 'apify~instagram-reel-scraper',
  youtube: process.env.APIFY_YOUTUBE_ACTOR ?? 'streamers~youtube-shorts-scraper',
  x: process.env.APIFY_X_ACTOR ?? 'apidojo~tweet-scraper',
});

type Item = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function runActor(actor: string, input: unknown): Promise<Item[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not set');
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=240`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(`Apify ${actor} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as Item[];
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);

// TODO(A): confirm field names against real output.
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
  videoUrl: null, // Gemini watches YouTube URLs directly
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
      const jobs: Promise<SourceVideo[]>[] = [];
      if (handles.tiktok)
        jobs.push(
          runActor(a.tiktok, { profiles: [handles.tiktok], resultsPerPage: limit }).then((r) =>
            r.slice(0, limit).map(mapTikTok),
          ),
        );
      if (handles.instagram)
        jobs.push(
          runActor(a.instagram, { username: [handles.instagram], resultsLimit: limit }).then((r) =>
            r.slice(0, limit).map(mapInstagram),
          ),
        );
      if (handles.youtube)
        jobs.push(
          runActor(a.youtube, { channels: [handles.youtube], maxResults: limit }).then((r) =>
            r.slice(0, limit).map(mapYouTube),
          ),
        );
      // One platform failing must not kill the influencer: keep whatever succeeded.
      const settled = await Promise.allSettled(jobs);
      const videos = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
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
      return items.map(mapTweet).filter((p) => p.text);
    },
  };
}
