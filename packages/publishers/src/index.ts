import type { Platform, PublishMode } from '@pseudo/shared';
import { createLivePublisher } from './live';
import { createMockPublisher } from './mock';
import type { Publisher } from './types';

export * from './types';
export * from './validate';

export function getPublisher(platform: Platform, mode: PublishMode): Publisher {
  return mode === 'live' ? createLivePublisher(platform) : createMockPublisher(platform);
}
