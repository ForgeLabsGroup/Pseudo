import { randomUUID } from 'node:crypto';
import type { CallModule } from '@pseudo/shared';

export type CallTrace =
  | { phase: 'start'; callId: string; module: CallModule; label: string }
  | { phase: 'end'; callId: string; module: CallModule; label: string; ok: boolean; ms: number };

type CallObserver = (trace: CallTrace) => void;

let observer: CallObserver | null = null;

/**
 * One observer for every provider call (the API turns them into `call.*` SSE events).
 * This package knows nothing about users or runs; the observer adds that context.
 */
export function setCallObserver(fn: CallObserver | null) {
  observer = fn;
}

function notify(trace: CallTrace) {
  try {
    observer?.(trace);
  } catch (err) {
    console.warn('[trace] observer failed', err);
  }
}

/** Runs `fn` between a start and an end trace. Errors are reported (ok: false) and rethrown. */
export async function traced<T>(
  module: CallModule,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const callId = randomUUID();
  const started = performance.now();
  notify({ phase: 'start', callId, module, label });
  const end = (ok: boolean) =>
    notify({
      phase: 'end',
      callId,
      module,
      label,
      ok,
      ms: Math.round(performance.now() - started),
    });
  try {
    const result = await fn();
    end(true);
    return result;
  } catch (err) {
    end(false);
    throw err;
  }
}
