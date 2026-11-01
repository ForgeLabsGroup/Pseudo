import { EventEmitter } from 'node:events';
import type { LiveEvent } from '@pseudo/shared';

/**
 * In-process pub/sub for SSE. Fine for a single API instance (our Render setup).
 * If we ever scale out, swap for Supabase Realtime or Redis without touching callers.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

export function publish(userId: string, event: LiveEvent) {
  emitter.emit(userId, event);
}

export function subscribe(userId: string, fn: (e: LiveEvent) => void): () => void {
  emitter.on(userId, fn);
  return () => emitter.off(userId, fn);
}
