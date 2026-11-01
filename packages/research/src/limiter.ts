/**
 * Concurrency + retry helpers for rate-limited providers.
 * Apify free plan: 5 concurrent actor runs. Featherless: plan "units" (e.g. Kimi-K3 costs 4 of a
 * 4-unit plan, so only ONE request at a time). Limiters are module-level so they are shared by
 * every influencer being researched in parallel.
 */
export interface Limiter {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export function createLimiter(max: number): Limiter {
  const limit = Math.max(1, Math.floor(max));
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = () =>
    new Promise<void>((resolve) => {
      if (active < limit) {
        active++;
        resolve();
      } else waiting.push(() => (active++, resolve()));
    });
  return {
    async run(fn) {
      await acquire();
      try {
        return await fn();
      } finally {
        active--;
        waiting.shift()?.();
      }
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry `fn` while `shouldRetry(err)` is true, waiting delaysMs[n] before attempt n+2.
 * Gives up (rethrows) after delaysMs.length retries or on any other error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (err: unknown) => boolean,
  delaysMs: number[],
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const delay = delaysMs[attempt];
      if (delay === undefined || !shouldRetry(err)) throw err;
      onRetry?.(attempt + 1, delay, err);
      await sleep(delay);
    }
  }
}
