/**
 * Get a source video onto local disk and into durable storage.
 * store hit -> direct download (Apify URL) -> yt-dlp on the post URL. CDN links expire, so a fresh
 * download is written to the store immediately; later runs (e.g. with another watcher model) reuse it.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadWithYtdlp } from './media/ytdlp';
import type { LocalVideo, SourceVideo, VideoStore } from './types';

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // matches the research-videos bucket limit

export interface AcquiredVideo extends LocalVideo {
  /** Key in the VideoStore, or null if it could not be stored. */
  storageKey: string | null;
  contentHash: string;
  fromStore: boolean;
  /** Non-fatal problems (e.g. the copy could not be stored). */
  warnings: string[];
  cleanup(): Promise<void>;
}

export interface AcquireOptions {
  store?: VideoStore;
  /** Store key, e.g. `trader/trader-1/tiktok-ab12cd34ef56ab78.mp4`. */
  key: string;
  maxBytes?: number;
  /** Test seam; defaults to the yt-dlp wrapper. */
  ytdlp?: (url: string, maxBytes: number) => Promise<{ data: Buffer; mimeType: string }>;
  fetchImpl?: typeof fetch;
}

/** Stable, filesystem-safe store key for a video. */
export function videoKey(
  archetypeSlug: string,
  influencerLabel: string,
  video: Pick<SourceVideo, 'platform' | 'postUrl'>,
): string {
  const hash = createHash('sha1').update(video.postUrl).digest('hex').slice(0, 16);
  const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return `${safe(archetypeSlug)}/${safe(influencerLabel)}/${video.platform}-${hash}.mp4`;
}

/** Recognise real video containers so an expired-link HTML/JSON error page is never stored. */
export function looksLikeVideo(b: Buffer): boolean {
  if (b.length < 12) return false;
  if (b.subarray(4, 8).toString('latin1') === 'ftyp') return true; // mp4 / mov
  return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3; // webm / mkv
}

async function directDownload(
  url: string,
  maxBytes: number,
  fetchImpl: typeof fetch,
): Promise<{ data: Buffer; mimeType: string }> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(120_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new Error(`video too large (${declared} bytes)`);
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length > maxBytes) throw new Error(`video too large (${data.length} bytes)`);
  if (!looksLikeVideo(data)) throw new Error('response is not a video (expired link?)');
  const ct = res.headers.get('content-type') ?? '';
  return {
    data,
    mimeType: /^video\/(mp4|quicktime|webm)/.test(ct) ? ct.split(';')[0]! : 'video/mp4',
  };
}

export async function acquireVideo(
  video: SourceVideo,
  opts: AcquireOptions,
): Promise<AcquiredVideo> {
  const maxBytes = opts.maxBytes ?? MAX_VIDEO_BYTES;
  let data: Buffer | null = null;
  let mimeType = 'video/mp4';
  let fromStore = false;

  const stored = await opts.store?.get(opts.key).catch(() => null);
  if (stored?.data.length) {
    ({ data, mimeType } = stored);
    fromStore = true;
  }

  const errors: string[] = [];
  if (!data && video.videoUrl) {
    try {
      ({ data, mimeType } = await directDownload(
        video.videoUrl,
        maxBytes,
        opts.fetchImpl ?? fetch,
      ));
    } catch (err) {
      errors.push(`direct: ${(err as Error).message}`);
    }
  }
  if (!data) {
    try {
      ({ data, mimeType } = await (opts.ytdlp ?? downloadWithYtdlp)(video.postUrl, maxBytes));
    } catch (err) {
      errors.push(`yt-dlp: ${(err as Error).message}`);
    }
  }
  if (!data) throw new Error(`Could not download ${video.postUrl} (${errors.join('; ')})`);

  let storageKey: string | null = null;
  const warnings: string[] = [];
  if (opts.store && !fromStore) {
    try {
      await opts.store.put(opts.key, data, mimeType);
      storageKey = opts.key;
    } catch (err) {
      warnings.push(`could not store video: ${(err as Error).message}`); // analysis still proceeds
    }
  } else if (fromStore) {
    storageKey = opts.key;
  }

  const dir = await mkdtemp(join(tmpdir(), 'pseudo-video-'));
  const path = join(dir, mimeType === 'video/webm' ? 'video.webm' : 'video.mp4');
  await writeFile(path, data);
  return {
    path,
    mimeType,
    sizeBytes: data.length,
    storageKey,
    contentHash: createHash('sha256').update(data).digest('hex'),
    fromStore,
    warnings,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
