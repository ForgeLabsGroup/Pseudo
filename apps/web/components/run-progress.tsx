'use client';
import type { AgentEvent, AgentRun } from '@pseudo/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, CircleDashed, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** A background run plus its events. Refetched by useLiveEvents on every run.* event (no polling). */
export function useRun(runId: string | null | undefined) {
  return useQuery({
    queryKey: ['runs', runId],
    queryFn: () => api.runs.get(runId!),
    enabled: !!runId,
  });
}

const isDone = (run?: AgentRun) => run?.status === 'succeeded' || run?.status === 'failed';

/** Live log of what an agent run is doing. */
export function RunProgress({ runId, className }: { runId: string; className?: string }) {
  const { data } = useRun(runId);
  const run = data?.run;
  const events = data?.events ?? [];
  return (
    <div className={cn('space-y-3', className)}>
      <ul className="space-y-2 text-sm">
        {events.map((e, i) => {
          const last = i === events.length - 1;
          const active = last && !isDone(run);
          return (
            <li key={e.id} className="flex items-start gap-2">
              {active ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-link" />
              ) : (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              )}
              <span className={active ? 'text-fg' : 'text-muted'}>{e.message}</span>
            </li>
          );
        })}
        {!isDone(run) && events.length === 0 && (
          <li className="flex items-center gap-2 text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-link" /> Starting agents…
          </li>
        )}
      </ul>
      {run?.status === 'failed' && (
        <p className="flex items-start gap-2 text-sm text-danger">
          <X className="mt-0.5 h-4 w-4 shrink-0" /> {run.error ?? 'Run failed'}
        </p>
      )}
    </div>
  );
}

export interface Stage {
  label: string;
  /** Backend progress `step` names that belong to this stage. */
  steps: string[];
}

type StageState = 'pending' | 'active' | 'done' | 'skipped' | 'failed';

function stageStates(stages: Stage[], run: AgentRun | undefined, events: AgentEvent[]) {
  const stageOf = (step: string) => stages.findIndex((s) => s.steps.includes(step));
  const seen = new Set(events.map((e) => stageOf(e.step)).filter((i) => i >= 0));
  const latest = events.length ? Math.max(-1, ...seen) : -1;
  return stages.map((_, i): StageState => {
    if (run?.status === 'succeeded') return seen.has(i) ? 'done' : 'skipped';
    if (i === latest) return run?.status === 'failed' ? 'failed' : 'active';
    if (i < latest) return seen.has(i) ? 'done' : 'skipped';
    return run?.status === 'failed' ? 'skipped' : 'pending';
  });
}

/** Horizontal stepper (e.g. Research → Ideas → Writing → Visual) driven by a run's events. */
export function StageStepper({ runId, stages }: { runId: string; stages: Stage[] }) {
  const { data } = useRun(runId);
  const states = stageStates(stages, data?.run, data?.events ?? []);
  const lastMessage = data?.events.at(-1)?.message;
  return (
    <div>
      <ol className="flex items-center gap-2">
        {stages.map((s, i) => {
          const state = states[i]!;
          return (
            <li key={s.label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center border font-mono text-xs',
                  state === 'done' && 'border-success/50 bg-success/15 text-success',
                  state === 'active' && 'border-link/60 bg-link/10 text-link',
                  state === 'failed' && 'border-danger/50 bg-danger/15 text-danger',
                  (state === 'pending' || state === 'skipped') && 'border-border text-muted',
                )}
              >
                {state === 'done' && <Check className="h-4 w-4" />}
                {state === 'active' && <Loader2 className="h-4 w-4 animate-spin" />}
                {state === 'failed' && <X className="h-4 w-4" />}
                {state === 'skipped' && <CircleDashed className="h-4 w-4" />}
                {state === 'pending' && i + 1}
              </div>
              <div className="min-w-0">
                <div className={cn('text-sm', state === 'active' ? 'text-fg' : 'text-muted')}>
                  {s.label}
                </div>
                {state === 'skipped' && <div className="text-[11px] text-muted">skipped</div>}
              </div>
              {i < stages.length - 1 && <div className="h-px flex-1 bg-border" />}
            </li>
          );
        })}
      </ol>
      {data?.run.status === 'failed' ? (
        <p className="mt-3 text-sm text-danger">{data.run.error ?? 'Run failed'}</p>
      ) : (
        lastMessage && <p className="mt-3 truncate text-sm text-muted">{lastMessage}</p>
      )}
    </div>
  );
}
