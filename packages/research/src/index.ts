import type { InfluencerHandles, VideoAnalysis } from '@pseudo/shared';
import { acquireVideo, videoKey } from './acquire';
import { buildPlaybook } from './playbook';
import { createApifySource } from './sources/apify';
import { createMockSource } from './sources/mock';
import type {
  ResearchProgress,
  SocialSource,
  SourcePost,
  SourceVideo,
  VideoStore,
  VideoWatcher,
  WatchMeta,
} from './types';
import { createGeminiWatcher } from './watchers/gemini';
import { createMockWatcher } from './watchers/mock';
import { createVisionWatcher } from './watchers/vision';

export * from './types';
export { acquireVideo, buildPlaybook, createMockWatcher, videoKey };

/** RESEARCH_SOURCE = mock | apify ; RESEARCH_WATCHER = mock | vision | gemini */
export function getSource(): SocialSource {
  return process.env.RESEARCH_SOURCE === 'apify' ? createApifySource() : createMockSource();
}
export function getWatcher(): VideoWatcher {
  switch (process.env.RESEARCH_WATCHER) {
    case 'vision':
      return createVisionWatcher();
    case 'gemini':
      return createGeminiWatcher();
    default:
      return createMockWatcher();
  }
}

export interface InfluencerInput {
  id: string;
  label: string;
  handles: InfluencerHandles;
}

/** Extra facts persisted next to an analysis (all optional; mock/gemini watchers set none). */
export interface AnalysisDetails extends WatchMeta {
  storagePath?: string | null;
  contentHash?: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface ResearchDeps {
  source?: SocialSource;
  watcher?: VideoWatcher;
  /** Durable storage for downloaded videos (only used by watchers with `needsMedia`). */
  store?: VideoStore;
  /** Return a cached analysis for this video, if any (avoid re-watching). */
  getCached?: (influencerId: string, video: SourceVideo) => Promise<VideoAnalysis | null>;
  saveAnalysis?: (
    influencerId: string,
    video: SourceVideo,
    analysis: VideoAnalysis,
    watcher: string,
    details?: AnalysisDetails,
  ) => Promise<void>;
  progress?: ResearchProgress;
}

/** Run `fn` over `items` with at most `limit` in flight (Featherless/Apify concurrency limits). */
async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
  );
}

/**
 * Full research pass for one archetype:
 * for each influencer -> latest videos (+ X posts) -> watch each video -> merge into a playbook.
 * Partial failures are tolerated (logged via progress) as long as at least one video was analysed.
 */
export async function researchArchetype(
  archetype: { slug?: string; name: string; description: string; guardrails: string[] },
  influencers: InfluencerInput[],
  opts: {
    videosPerInfluencer?: number;
    postsPerInfluencer?: number;
    /** Influencers processed in parallel (default RESEARCH_CONCURRENCY or 2). */
    concurrency?: number;
  } & ResearchDeps = {},
) {
  const source = opts.source ?? getSource();
  const watcher = opts.watcher ?? getWatcher();
  const progress = opts.progress ?? (() => {});
  const perInfluencer = opts.videosPerInfluencer ?? 3;
  const concurrency = Math.max(
    1,
    opts.concurrency ?? Number(process.env.RESEARCH_CONCURRENCY ?? 2),
  );

  const analyses: VideoAnalysis[] = [];
  const posts: SourcePost[] = [];

  await mapPool(influencers, concurrency, async (inf) => {
    try {
      await progress('fetch', `Fetching latest content for ${inf.label}`);
      const [videos, xPosts] = await Promise.all([
        source.getRecentVideos(inf.handles, perInfluencer),
        source.getRecentPosts(inf.handles, opts.postsPerInfluencer ?? 15).catch(() => []),
      ]);
      posts.push(...xPosts);
      // Prefer the most-viewed videos when a creator is on several platforms.
      const picked = [...videos]
        .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
        .slice(0, perInfluencer);
      for (const video of picked) {
        try {
          const cached = await opts.getCached?.(inf.id, video);
          if (cached) {
            analyses.push(cached);
            continue;
          }
          let acquired: Awaited<ReturnType<typeof acquireVideo>> | null = null;
          const meta: WatchMeta = {};
          try {
            if (watcher.needsMedia) {
              await progress('download', `Downloading ${video.platform} video from ${inf.label}`);
              acquired = await acquireVideo(video, {
                store: opts.store,
                key: videoKey(archetype.slug ?? archetype.name, inf.label, video),
              });
              for (const w of acquired.warnings) await progress('download_warning', w);
            }
            await progress('watch', `Watching ${video.platform} video from ${inf.label}`);
            const analysis = await watcher.watch(video, {
              archetypeName: archetype.name,
              media: acquired ?? undefined,
              onMeta: (m) => Object.assign(meta, m),
            });
            analyses.push(analysis);
            await opts.saveAnalysis?.(inf.id, video, analysis, watcher.name, {
              ...meta,
              ...(acquired && {
                storagePath: acquired.storageKey,
                contentHash: acquired.contentHash,
                sizeBytes: acquired.sizeBytes,
                mimeType: acquired.mimeType,
              }),
            });
          } finally {
            await acquired?.cleanup();
          }
        } catch (err) {
          await progress(
            'watch_failed',
            `Skipped a video from ${inf.label}: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      await progress('fetch_failed', `Could not fetch ${inf.label}: ${(err as Error).message}`);
    }
  });

  if (!analyses.length) throw new Error('Research found no analysable videos');
  await progress(
    'synthesize',
    `Building playbook from ${analyses.length} videos and ${posts.length} posts`,
  );
  const playbook = await buildPlaybook({
    archetypeName: archetype.name,
    archetypeDescription: archetype.description,
    guardrails: archetype.guardrails,
    analyses,
    posts,
  });
  return { playbook, sourceCount: analyses.length };
}
