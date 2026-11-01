import { describe, expect, it, vi } from 'vitest';
import { createLimiter, withRetry } from '../limiter';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('createLimiter', () => {
  it('never exceeds the max in flight and runs everything', async () => {
    const limiter = createLimiter(2);
    let active = 0;
    let peak = 0;
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, n) =>
        limiter.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await sleep(10);
          active--;
          return n;
        }),
      ),
    );
    expect(peak).toBe(2);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('releases the slot when a task throws', async () => {
    const limiter = createLimiter(1);
    await expect(limiter.run(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(limiter.run(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('withRetry', () => {
  it('retries only matching errors and then succeeds', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('busy'))
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValue('done');
    const onRetry = vi.fn();
    await expect(
      withRetry(fn, (e) => (e as Error).message === 'busy', [1, 1, 1], onRetry),
    ).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'));
    await expect(withRetry(fn, (e) => (e as Error).message === 'busy', [1, 1])).rejects.toThrow(
      'fatal',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last delay', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('busy'));
    await expect(withRetry(fn, () => true, [1, 1])).rejects.toThrow('busy');
    expect(fn).toHaveBeenCalledTimes(3); // first try + 2 retries
  });
});
