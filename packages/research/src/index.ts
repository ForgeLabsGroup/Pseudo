import type { InfluencerHandles, VideoAnalysis } from '@pseudo/shared';
import { buildPlaybook } from './playbook';
import { createApifySource } from './sources/apify';
import { createMockSource } from './sources/mock';
import type {
  ResearchProgress,
  SocialSource,
  SourcePost,
  SourceVideo,
  VideoWatcher,
} from './types';
import { createGeminiWatcher } from './watchers/gemini';
import { createMockWatcher } from './watchers/mock';

export * from './types';
export { buildPlaybook };

/** RESEARCH_SOURCE = mock | apify ; RESEARCH_WATCHER = mock | gemini */
export function getSource(): SocialSource {
  return process.env.RESEARCH_SOURCE === 'apify' ? createApifySource() : createMockSource();
}
export function getWatcher(): VideoWatcher {
  return process.env.RESEARCH_WATCHER === 'gemini' ? createGeminiWatcher() : createMockWatcher();
}

export interface InfluencerInput {
  id: string;
  label: string;
  handles: InfluencerHandles;
}

export interface ResearchDeps {
  source?: SocialSource;
  watcher?: VideoWatcher;
  /** Return a cached analysis for this video, if any (avoid re-watching). */
  getCached?: (influencerId: string, video: SourceVideo) => Promise<VideoAnalysis | null>;
  saveAnalysis?: (
    influencerId: string,
    video: SourceVideo,
    analysis: VideoAnalysis,
    watcher: string,
  ) => Promise<void>;
  progress?: ResearchProgress;
}

/**
 * Full research pass for one archetype:
 * for each influencer -> latest videos (+ X posts) -> watch each video -> merge into a playbook.
 * Partial failures are tolerated (logged via progress) as long as at least one video was analysed.
 */
export async function researchArchetype(
  archetype: { name: string; description: string; guardrails: string[] },
  influencers: InfluencerInput[],
  opts: { videosPerInfluencer?: number; postsPerInfluencer?: number } & ResearchDeps = {},
) {
  const source = opts.source ?? getSource();
  const watcher = opts.watcher ?? getWatcher();
  const progress = opts.progress ?? (() => {});
  const perInfluencer = opts.videosPerInfluencer ?? 3;

  const analyses: VideoAnalysis[] = [];
  const posts: SourcePost[] = [];

  await Promise.all(
    influencers.map(async (inf) => {
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
            await progress('watch', `Watching ${video.platform} video from ${inf.label}`);
            const analysis = await watcher.watch(video, { archetypeName: archetype.name });
            analyses.push(analysis);
            await opts.saveAnalysis?.(inf.id, video, analysis, watcher.name);
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
    }),
  );

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
