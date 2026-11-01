import type { InfluencerHandles, ResearchPlatform, VideoAnalysis } from '@pseudo/shared';

/** One short-form video found for an influencer. */
export interface SourceVideo {
  platform: Exclude<ResearchPlatform, 'x'>;
  /** Public post URL (used as cache key; YouTube URLs can be watched directly by Gemini). */
  postUrl: string;
  /** Direct, downloadable media URL if the source provides one. */
  videoUrl: string | null;
  caption: string | null;
  postedAt: string | null;
  views: number | null;
}

/** One text post (X). */
export interface SourcePost {
  text: string;
  url: string | null;
  postedAt: string | null;
  likes: number | null;
}

/**
 * Where research data comes from. Apify today; swap for ScrapeCreators/official APIs later by
 * adding another implementation — nothing else in the app changes.
 */
export interface SocialSource {
  name: string;
  /** Latest N short-form videos across the influencer's video platforms. */
  getRecentVideos(handles: InfluencerHandles, perPlatformLimit: number): Promise<SourceVideo[]>;
  /** Latest N X posts (empty if no X handle). */
  getRecentPosts(handles: InfluencerHandles, limit: number): Promise<SourcePost[]>;
}

/** Watches one video (picture + audio) and returns a structured breakdown. */
export interface VideoWatcher {
  name: string;
  watch(video: SourceVideo, context: { archetypeName: string }): Promise<VideoAnalysis>;
}

export type ResearchProgress = (step: string, message: string) => void | Promise<void>;
