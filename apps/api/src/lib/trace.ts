import { AsyncLocalStorage } from 'node:async_hooks';
import { setCallObserver } from '@pseudo/ai';
import type { AgentName } from '@pseudo/shared';
import { publish } from './bus';

export interface TraceCtx {
  userId: string;
  runId: string | null;
  agent: AgentName;
}

/** Who a provider call belongs to. Set around every run (runs.ts) and publishing job. */
export const traceStore = new AsyncLocalStorage<TraceCtx>();

/**
 * Turns every traced provider call (packages/ai `traced`) into a `call.*` SSE event for the
 * user whose run made it. Calls outside a run (boot, scripts) are skipped.
 */
export function initCallTracing() {
  setCallObserver((t) => {
    const ctx = traceStore.getStore();
    if (!ctx) return;
    const base = {
      callId: t.callId,
      runId: ctx.runId,
      agent: ctx.agent,
      module: t.module,
      label: t.label,
    };
    if (t.phase === 'start') publish(ctx.userId, { type: 'call.started', ...base });
    else publish(ctx.userId, { type: 'call.finished', ...base, ok: t.ok, ms: t.ms });
  });
}
