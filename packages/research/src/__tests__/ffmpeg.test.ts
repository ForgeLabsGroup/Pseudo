import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  extractAudio,
  extractFrames,
  frameTimestamps,
  parseDuration,
  probeDuration,
} from '../media/ffmpeg';
import { makeTestVideo } from './helpers';

describe('ffmpeg pure helpers', () => {
  it('parses the duration banner', () => {
    expect(parseDuration('  Duration: 00:01:02.50, start: 0.000000, bitrate: 10 kb/s')).toBe(62.5);
    expect(parseDuration('no duration here')).toBeNull();
    expect(parseDuration('Duration: 00:00:00.00,')).toBeNull();
  });

  it('spaces frames evenly through the video', () => {
    expect(frameTimestamps(8, 4)).toEqual([1, 3, 5, 7]);
    expect(frameTimestamps(null, 3)).toEqual([0, 2, 4]); // unknown duration: 2s steps
  });
});

describe('ffmpeg binary (real)', () => {
  let video: { path: string; data: Buffer };
  beforeAll(async () => {
    video = await makeTestVideo();
  }, 60_000);

  it('probes duration', async () => {
    const d = await probeDuration(video.path);
    expect(d).toBeGreaterThan(2.5);
    expect(d).toBeLessThan(3.5);
  });

  it('extracts the requested number of JPEG frames', async () => {
    const frames = await extractFrames(video.path, 4, 3);
    expect(frames).toHaveLength(4);
    for (const f of frames) expect(f.jpeg.subarray(0, 2).toString('hex')).toBe('ffd8'); // JPEG magic
  });

  it('extracts audio, and reports false for a file that is not media', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pseudo-audio-test-'));
    const out = join(dir, 'a.mp3');
    expect(await extractAudio(video.path, out)).toBe(true);
    expect((await stat(out)).size).toBeGreaterThan(1000);
    expect(await extractAudio(join(dir, 'missing.mp4'), join(dir, 'b.mp3'))).toBe(false);
  });
});
