import type { Platform } from '@pseudo/shared';
import { PublisherNotConfiguredError, type Publisher } from './types';
import { validateForPlatform } from './validate';

/**
 * Live adapters (Phase 10). Each one uses the platform's official API with the user's OAuth token.
 * Until implemented they fail clearly instead of pretending to succeed.
 * - X: POST https://api.x.com/2/tweets (OAuth2 user context, tweet.write)
 * - Instagram: Graph API container -> media_publish (Business/Creator account, instagram_content_publish)
 * - TikTok: Content Posting API (video.publish; unaudited apps can only post privately)
 * - YouTube: Data API v3 videos.insert (youtube.upload) with #Shorts
 */
export function createLivePublisher(platform: Platform): Publisher {
  return {
    platform,
    mode: 'live',
    validate: validateForPlatform,
    async publish() {
      throw new PublisherNotConfiguredError(platform);
    },
  };
}
