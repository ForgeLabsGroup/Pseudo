import type { LiveEvent } from '@pseudo/shared';

/**
 * Raw live-event fan-out outside React state, so the 60 fps Core scene can react to every
 * event (including high-frequency `call.*`) without re-rendering anything.
 */
type Listener = (e: LiveEvent) => void;

const listeners = new Set<Listener>();

export function emitLive(e: LiveEvent) {
  for (const fn of listeners) fn(e);
}

export function onLive(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
