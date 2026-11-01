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

/** A video file on local disk (a temp copy; the durable copy lives in the VideoStore). */
export interface LocalVideo {
  path: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Durable storage for downloaded source videos (Supabase Storage in the API). Keeps this package
 * free of Supabase. Keys look like `{archetype}/{influencer}/{platform}-{hash}.mp4`.
 */
export interface VideoStore {
  get(key: string): Promise<{ data: Buffer; mimeType: string } | null>;
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
}

/** What a watcher learned besides the analysis itself (persisted for re-analysis/debugging). */
export interface WatchMeta {
  transcript?: string;
  durationSec?: number;
  framesUsed?: number;
}

/** Watches one video (picture + audio) and returns a structured breakdown. */
export interface VideoWatcher {
  name: string;
  /** True if the watcher needs the video file on disk (`context.media`); false = fetches it itself. */
  needsMedia?: boolean;
  watch(
    video: SourceVideo,
    context: {
      archetypeName: string;
      /** Local copy of the video, set by the orchestrator when `needsMedia` is true. */
      media?: LocalVideo;
      onMeta?: (meta: WatchMeta) => void;
    },
  ): Promise<VideoAnalysis>;
}

export type ResearchProgress = (step: string, message: string) => void | Promise<void>;
