/**
 * yt-dlp fallback downloader: YouTube Shorts (Apify gives no file URL), TikTok, and Instagram
 * links that expired. Binary lookup: YTDLP_PATH -> <repo>/.cache/bin -> `yt-dlp` on PATH.
 * Install the standalone binary with: pnpm --filter @pseudo/research setup:ytdlp
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpegPath } from './ffmpeg';

const BIN = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

export function ytdlpPath(): string {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  // packages/research/src/media -> repo root
  const local = join(dirname(fileURLToPath(import.meta.url)), '../../../..', '.cache', 'bin', BIN);
  return existsSync(local) ? local : BIN;
}

export async function downloadWithYtdlp(
  url: string,
  maxBytes: number,
): Promise<{ data: Buffer; mimeType: string }> {
  if (!/^https?:\/\//i.test(url)) throw new Error('yt-dlp: refusing non-http(s) URL');
  const dir = await mkdtemp(join(tmpdir(), 'pseudo-ytdlp-'));
  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        ytdlpPath(),
        [
          '--no-playlist',
          '--no-warnings',
          '--max-filesize',
          String(maxBytes),
          '-f',
          'bv*[height<=720]+ba/b[height<=720]/b',
          '--merge-output-format',
          'mp4',
          '--ffmpeg-location',
          ffmpegPath(),
          '-o',
          join(dir, 'video.%(ext)s'),
          '--',
          url,
        ],
        { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 },
        (err, _out, stderr) => {
          if (!err) return resolve();
          if ((err as NodeJS.ErrnoException).code === 'ENOENT')
            return reject(
              new Error('yt-dlp not found: run `pnpm --filter @pseudo/research setup:ytdlp`'),
            );
          reject(new Error(`yt-dlp failed: ${stderr.trim().split('\n').pop() || err.message}`));
        },
      );
    });
    const file = (await readdir(dir)).find((f) => f.startsWith('video.'));
    if (!file) throw new Error('yt-dlp produced no file (over the size limit?)');
    const data = await readFile(join(dir, file));
    if (data.length > maxBytes) throw new Error('yt-dlp video exceeds size limit');
    return { data, mimeType: file.endsWith('.webm') ? 'video/webm' : 'video/mp4' };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
