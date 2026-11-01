/**
 * ffmpeg helpers. Uses the `ffmpeg-static` binary (no system install needed, works on Render);
 * FFMPEG_PATH overrides it. There is no ffprobe, so duration is parsed from ffmpeg's banner.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';

export function ffmpegPath(): string {
  const p = process.env.FFMPEG_PATH || ffmpegStatic;
  if (!p) throw new Error('ffmpeg binary not found (install ffmpeg-static or set FFMPEG_PATH)');
  return p;
}

function run(args: string[], timeoutMs = 120_000) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    execFile(
      ffmpegPath(),
      ['-hide_banner', '-nostdin', ...args],
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') return reject(err);
        const code = err ? ((err as { code?: number }).code ?? 1) : 0;
        resolve({ stdout, stderr, code: typeof code === 'number' ? code : 1 });
      },
    );
  });
}

/** Parse "Duration: 00:00:22.45" from ffmpeg's banner. Returns seconds, or null. */
export function parseDuration(banner: string): number | null {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(banner);
  if (!m) return null;
  const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number.isFinite(sec) && sec > 0 ? sec : null;
}

export async function probeDuration(file: string): Promise<number | null> {
  // `-i` with no output exits non-zero but prints the banner we need on stderr.
  const { stderr } = await run(['-i', file]);
  return parseDuration(stderr);
}

/** Evenly spaced timestamps (centre of each of n equal slices). */
export function frameTimestamps(durationSec: number | null, n: number): number[] {
  if (!durationSec) return Array.from({ length: n }, (_, i) => i * 2);
  return Array.from({ length: n }, (_, i) => Number((((i + 0.5) / n) * durationSec).toFixed(2)));
}

/** Extract up to n evenly spaced JPEG frames (768px wide). Frames that fail are skipped. */
export async function extractFrames(
  file: string,
  n: number,
  durationSec: number | null,
): Promise<{ at: number; jpeg: Buffer }[]> {
  const dir = await mkdtemp(join(tmpdir(), 'pseudo-frames-'));
  try {
    const frames: { at: number; jpeg: Buffer }[] = [];
    for (const [i, at] of frameTimestamps(durationSec, n).entries()) {
      const out = join(dir, `f${i}.jpg`);
      const { code } = await run([
        '-ss',
        String(at),
        '-i',
        file,
        '-frames:v',
        '1',
        '-vf',
        'scale=768:-2',
        '-q:v',
        '4',
        '-y',
        out,
      ]);
      if (code !== 0) continue;
      try {
        frames.push({ at, jpeg: await readFile(out) });
      } catch {
        /* seek past the end, etc. */
      }
    }
    return frames;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Extract mono 16 kHz mp3 audio to `outFile`. Returns false if the video has no audio. */
export async function extractAudio(file: string, outFile: string): Promise<boolean> {
  const { code } = await run([
    '-i',
    file,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-b:a',
    '32k',
    '-y',
    outFile,
  ]);
  return code === 0;
}
