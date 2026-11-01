'use client';
import { PLATFORM_LABELS, type LiveEvent } from '@pseudo/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { describe } from '@/lib/describe-event';
import { onLive } from '@/lib/pulse-bus';
import { useUI } from '@/lib/store';
import { cn } from '@/lib/utils';
import { AGENT_LABEL, MODULE_LABEL, resolveSource } from './topology';

interface LogLine {
  key: string;
  at: number;
  who: string;
  text: string;
  tone?: string;
  call?: boolean;
}

const MAX_CALL_LINES = 30;

const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

/** Finished provider calls, kept locally (they never enter the shared activity feed). */
function useCallLines() {
  const [lines, setLines] = useState<LogLine[]>([]);
  useEffect(
    () =>
      onLive((e) => {
        if (e.type !== 'call.finished') return;
        const src = resolveSource(e);
        const line: LogLine = {
          key: e.callId,
          at: Date.now(),
          who: src ? AGENT_LABEL[src] : e.agent,
          text: `${src ? AGENT_LABEL[src] : e.agent} → ${MODULE_LABEL[e.module]} · ${e.ms}ms`,
          tone: e.ok ? undefined : 'text-danger',
          call: true,
        };
        setLines((prev) => [line, ...prev].slice(0, MAX_CALL_LINES));
      }),
    [],
  );
  return lines;
}

/** Runs that started (or were running at load) and haven't finished yet. */
function useActiveRuns() {
  const activity = useUI((s) => s.activity);
  const { data } = useQuery({ queryKey: ['analytics'], queryFn: api.analytics });
  return useMemo(() => {
    const live = new Map<string, { agent: string; message: string }>();
    const done = new Set<string>();
    for (const e of [...activity].reverse()) {
      if (e.type === 'run.started') live.set(e.runId, { agent: e.agent, message: 'Started' });
      else if (e.type === 'run.progress') live.set(e.runId, { agent: e.agent, message: e.message });
      else if (e.type === 'run.succeeded' || e.type === 'run.failed') {
        live.delete(e.runId);
        done.add(e.runId);
      }
    }
    for (const r of data?.recentRuns ?? []) {
      if ((r.status === 'running' || r.status === 'queued') && !done.has(r.id) && !live.has(r.id))
        live.set(r.id, { agent: r.agent, message: r.status });
    }
    return [...live.entries()].map(([id, v]) => ({ id, ...v }));
  }, [activity, data?.recentRuns]);
}

function Panel({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col border border-border bg-surface/70 backdrop-blur',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <h2 className="mono-label text-fg">{title}</h2>
        <span className="flex-1" />
        {aside}
      </div>
      {children}
    </section>
  );
}

function Counts() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics'], queryFn: api.analytics });
  const stats = data
    ? [
        { label: 'Alter egos', value: data.counts.personas, href: '/personas' },
        {
          label: 'Awaiting approval',
          value: data.counts.awaitingApproval,
          href: '/content?status=awaiting_approval',
          highlight: data.counts.awaitingApproval > 0,
        },
        { label: 'Scheduled', value: data.counts.scheduled, href: '/content?status=scheduled' },
        { label: 'Published', value: data.counts.published, href: '/content?status=published' },
      ]
    : [];
  return (
    <div className="grid grid-cols-2 gap-px border border-border bg-border/70 backdrop-blur lg:w-[300px]">
      {isLoading && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[74px]" />)}
      {stats.map((s) => (
        <Link
          key={s.label}
          href={s.href}
          className={cn(
            'flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-2',
            s.highlight ? 'bg-surface/90' : 'bg-bg/70',
          )}
        >
          <span className={cn('mono-label text-[10px]', s.highlight ? 'text-fg' : 'text-subtle')}>
            {s.label}
          </span>
          <span className="text-[28px] leading-none tracking-[-0.04em] tabular-nums">
            {s.value}
          </span>
        </Link>
      ))}
    </div>
  );
}

function LiveLog() {
  const activity = useUI((s) => s.activity);
  const calls = useCallLines();
  const { data } = useQuery({ queryKey: ['analytics'], queryFn: api.analytics });
  const lines = useMemo(() => {
    const events: LogLine[] = activity.map((e: LiveEvent & { at: number }, i) => {
      const d = describe(e);
      return { key: `${e.at}-${i}`, at: e.at, ...d };
    });
    // Fresh session with no live events yet: show the latest runs, like the classic feed.
    const recent: LogLine[] =
      events.length || calls.length
        ? []
        : (data?.recentRuns ?? []).map((r) => ({
            key: r.id,
            at: new Date(r.createdAt).getTime(),
            who: r.agent,
            text: r.status,
            tone: r.status === 'failed' ? 'text-danger' : undefined,
          }));
    return [...events, ...calls, ...recent].sort((a, b) => b.at - a.at).slice(0, 40);
  }, [activity, calls, data?.recentRuns]);

  return (
    <Panel
      title="Live log"
      aside={
        <span className="mono-label flex items-center gap-1.5 text-[10px] text-subtle">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-link" />
          Live
        </span>
      }
      className="max-h-72 lg:max-h-none lg:flex-1"
    >
      {lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted">
          Quiet for now. Every agent step and provider call shows up here.
        </p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {lines.map((l) => (
            <li
              key={l.key}
              className="grid grid-cols-[40px_minmax(0,1fr)] gap-2.5 px-4 py-1 text-[12px]"
            >
              <span className="font-mono text-[11px] leading-5 text-subtle">{clock(l.at)}</span>
              {l.call ? (
                <span
                  className={cn(
                    'truncate font-mono text-[11px] uppercase leading-5',
                    l.tone ?? 'text-link',
                  )}
                >
                  {l.text}
                </span>
              ) : (
                <span className="truncate leading-5">
                  <span className="capitalize text-fg">{l.who}</span>{' '}
                  <span className={l.tone ?? 'text-muted'}>{l.text}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function ApprovalQueue() {
  const queue = useQuery({
    queryKey: ['content', { status: 'awaiting_approval', limit: 5 }],
    queryFn: () => api.content.list({ status: 'awaiting_approval', limit: 5 }),
  });
  const items = queue.data?.items ?? [];
  return (
    <Panel
      title="Approval queue"
      aside={
        <Link
          href="/content?status=awaiting_approval"
          className="mono-label text-[10px] text-muted hover:text-fg"
        >
          Review →
        </Link>
      }
    >
      {queue.isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted">Inbox zero. Nothing waiting for you.</p>
      ) : (
        <ul className="py-1">
          {items.slice(0, 3).map((item) => (
            <li key={item.id}>
              <Link
                href="/content?status=awaiting_approval"
                className="flex items-center gap-3 px-4 py-1.5 text-[13px] transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="mono-label shrink-0 text-[10px] text-subtle">
                  {PLATFORM_LABELS[item.platform]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ActiveRuns() {
  const runs = useActiveRuns();
  return (
    <Panel
      title="Active runs"
      aside={<span className="font-mono text-xs text-subtle">{runs.length}</span>}
    >
      {runs.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted">No agents running.</p>
      ) : (
        <ul className="py-1">
          {runs.slice(0, 3).map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-1.5 text-[13px]">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-link" />
              <span className="w-20 shrink-0 capitalize">{r.agent}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{r.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Glass panels over the Core canvas: counts (top-left), live log (right), approval queue,
 * active runs and Generate (bottom). Below `lg` they stack under the canvas instead.
 */
export function Hud() {
  return (
    <div className="flex flex-col gap-3 px-4 pb-6 lg:pointer-events-none lg:absolute lg:inset-0 lg:p-0">
      <div className="lg:pointer-events-auto lg:absolute lg:left-6 lg:top-5">
        <Counts />
      </div>
      <div className="flex flex-col lg:pointer-events-auto lg:absolute lg:bottom-5 lg:right-6 lg:top-16 lg:w-[320px]">
        <LiveLog />
      </div>
      <div className="grid gap-3 lg:pointer-events-auto lg:absolute lg:bottom-5 lg:left-6 lg:right-[calc(320px+2.25rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <ApprovalQueue />
        <ActiveRuns />
        <Link href="/studio" className="lg:self-end">
          <Button className="w-full lg:h-11 lg:px-6">Generate content</Button>
        </Link>
      </div>
    </div>
  );
}
