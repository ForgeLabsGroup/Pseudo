import type { ContentItem, Platform, PublishMode } from '@pseudo/shared';

export interface PublishContext {
  content: ContentItem;
  account: { id: string | null; handle: string; mode: PublishMode };
  /** Decrypted OAuth access token (live mode only). Never logged. */
  accessToken?: string;
}

export interface PublishResult {
  externalId: string;
  externalUrl: string | null;
  raw?: unknown;
}

/** Mock and live publishers implement the same interface. */
export interface Publisher {
  platform: Platform;
  mode: PublishMode;
  /** Returns a list of problems; empty = publishable. */
  validate(content: ContentItem): string[];
  publish(ctx: PublishContext): Promise<PublishResult>;
}

export class PublisherNotConfiguredError extends Error {
  constructor(platform: Platform) {
    super(
      `Live publishing for ${platform} is not configured (missing API credentials or permissions)`,
    );
  }
}
