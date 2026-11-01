import type { Platform } from '@pseudo/shared';
import type { Publisher } from './types';
import { validateForPlatform } from './validate';

const URLS: Record<Platform, (handle: string, id: string) => string> = {
  instagram: (h, id) => `https://mock.pseudo.app/instagram/${h}/p/${id}`,
  tiktok: (h, id) => `https://mock.pseudo.app/tiktok/@${h}/video/${id}`,
  youtube_shorts: (h, id) => `https://mock.pseudo.app/youtube/shorts/${id}`,
  x: (h, id) => `https://mock.pseudo.app/x/${h}/status/${id}`,
};

/**
 * First-class demo mode: runs the exact same flow as live, never touches external APIs.
 * Set MOCK_PUBLISH_FAIL_RATE (0-1) to demo failure + retry handling.
 */
export function createMockPublisher(platform: Platform): Publisher {
  return {
    platform,
    mode: 'mock',
    validate: validateForPlatform,
    async publish({ account }) {
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1500));
      const failRate = Number(process.env.MOCK_PUBLISH_FAIL_RATE ?? 0);
      if (Math.random() < failRate)
        throw new Error(`Mock ${platform} API: simulated rate limit (429)`);
      const id = `mock_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      return {
        externalId: id,
        externalUrl: URLS[platform](account.handle, id),
        raw: { simulated: true },
      };
    },
  };
}
