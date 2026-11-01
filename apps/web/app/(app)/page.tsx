'use client';
import { PLATFORM_LABELS, type LiveEvent } from '@pseudo/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ContentActions } from '@/components/content-actions';
import { EmptyState, PageHeader } from '@/components/page-header';
import { PersonaAvatar } from '@/components/persona-avatar';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublishing } from '@/hooks/use-publishing';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';
import { cn, timeAgo } from '@/lib/utils';

function describe(e: LiveEvent): { who: string; text: string; tone?: string } {
  switch (e.type) {
    case 'run.started':
      return { who: e.agent, text: 'Started' };
    case 'run.progress':
      return { who: e.agent, text: e.message };
    case 'run.succeeded':
      return { who: e.agent, text: 'Finished' };
    case 'run.failed':
      return { who: e.agent, text: `Failed: ${e.error}`, tone: 'text-danger' };
    case 'persona.updated':
      return { who: 'persona', text: 'Identity updated' };
    case 'archetype.updated':
      return { who: 'research', text: 'Playbook refreshed' };
    case 'content.updated':
      return { who: 'content', text: e.status.replace('_', ' ') };
    case 'media.created':
      return { who: 'visual', text: 'New photo ready' };
    case 'usage.updated':
      return { who: e.provider, text: 'Paid request logged' };
    case 'publish.updated':
      return {
        who: 'distribution',
        text: e.status,
        tone:
          e.status === 'published'
            ? 'text-success'
            : e.status === 'failed'
              ? 'text-danger'
              : undefined,
      };
  }
}

const clock = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

/** Command Center: what needs you, what went out, and what the agents are doing right now. */
export default function CommandCenter() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics'], queryFn: api.analytics });
  const personas = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const queue = useQuery({
    queryKey: ['content', { status: 'awaiting_approval', limit: 5 }],
    queryFn: () => api.content.list({ status: 'awaiting_approval', limit: 5 }),
  });
  const published = useQuery({
    queryKey: ['content', { status: 'published', limit: 5 }],
    queryFn: () => api.content.list({ status: 'published', limit: 5 }),
  });
  const { recordFor } = usePublishing();
  const activity = useUI((s) => s.activity);
  const personaById = new Map(personas.data?.personas.map((p) => [p.id, p]));

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
    <>
      <PageHeader
        title="Command Center"
        subtitle="What your alter egos are doing, and what needs you."
      />

      <div className="grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
        {isLoading &&
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[106px]" />)}
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={cn(
              'flex flex-col gap-3.5 px-5 py-[18px] transition-colors hover:bg-surface-2',
              s.highlight ? 'bg-surface' : 'bg-bg',
            )}
          >
            <span className={cn('mono-label', s.highlight ? 'text-fg' : 'text-subtle')}>
              {s.label}
            </span>
            <span className="text-[40px] font-normal leading-none tracking-[-0.04em] tabular-nums">
              {s.value}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-px border border-border bg-border lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Approval queue"
          count={queue.data?.items.length}
          href="/content?status=awaiting_approval"
        >
          {queue.isLoading && <RowSkeletons />}
          {queue.data?.items.length === 0 && (
            <div className="p-5">
              <EmptyState
                title="Inbox zero"
                body="Nothing waiting for your approval."
                action={
                  <Link href="/studio">
                    <Button variant="secondary" size="sm">
                      Generate content
                    </Button>
                  </Link>
                }
              />
            </div>
          )}
          <ul>
            {queue.data?.items.map((item) => {
              const p = personaById.get(item.personaId);
              const image = item.media.find((m) => m.kind === 'image');
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-5 py-3 last:border-b-0"
                >
                  <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden bg-surface-2">
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                    )}
                    {image && (
                      <span className="absolute bottom-1 left-1 bg-black/75 px-1 font-mono text-[9px] tracking-[0.06em] text-white">
                        AI
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="truncate">{item.title}</div>
                    <div className="text-[13px] text-subtle">
                      {p?.name ?? 'Persona'} · {PLATFORM_LABELS[item.platform]}
                    </div>
                  </div>
                  <span className="w-16 font-mono text-xs text-subtle">
                    {timeAgo(item.createdAt)}
                  </span>
                  <ContentActions item={item} compact />
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Agent activity" aside={<span className="mono-label text-subtle">Live</span>}>
          {activity.length > 0 ? (
            <ol className="py-1.5">
              {activity.slice(0, 10).map((e, i) => {
                const d = describe(e);
                return (
                  <LogRow key={`${e.at}-${i}`} time={clock(new Date(e.at))} who={d.who}>
                    <span className={d.tone ?? 'text-muted'}>{d.text}</span>
                  </LogRow>
                );
              })}
            </ol>
          ) : data?.recentRuns.length ? (
            <ol className="py-1.5">
              {data.recentRuns.map((r) => (
                <LogRow key={r.id} time={clock(new Date(r.createdAt))} who={r.agent}>
                  <span
                    className={
                      r.status === 'failed'
                        ? 'text-danger'
                        : r.status === 'succeeded'
                          ? 'text-muted'
                          : 'text-fg'
                    }
                  >
                    {r.status}
                  </span>
                </LogRow>
              ))}
            </ol>
          ) : isLoading ? (
            <RowSkeletons />
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted">
              Quiet for now. Agent steps show up here live.
            </p>
          )}
        </Panel>

        <Panel title="Recently published" href="/content?status=published">
          {published.isLoading && <RowSkeletons />}
          {published.data?.items.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted">
              Nothing published yet. Approve a post, then hit Publish.
            </p>
          )}
          <ul>
            {published.data?.items.map((item) => {
              const record = recordFor(item.id);
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-4 border-b border-border/60 px-5 py-3 text-sm last:border-b-0"
                >
                  <span className="w-20 shrink-0 text-muted">{PLATFORM_LABELS[item.platform]}</span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="font-mono text-xs text-subtle">
                    {item.publishedAt && timeAgo(item.publishedAt)}
                  </span>
                  {record?.externalUrl && (
                    <a
                      href={record.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mono-label text-muted hover:text-fg"
                    >
                      Open ↗
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Alter egos" href="/personas/new" linkLabel="New">
          {personas.isLoading && <RowSkeletons />}
          {personas.data?.personas.length === 0 && (
            <div className="p-5">
              <EmptyState
                title="No alter egos yet"
                body="Create your first persona to get started."
                action={
                  <Link href="/personas/new">
                    <Button size="sm">Create persona</Button>
                  </Link>
                }
              />
            </div>
          )}
          <ul>
            {personas.data?.personas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/personas/${p.id}`}
                  className="flex min-h-11 items-center gap-3 border-b border-border/60 px-5 py-2.5 transition-colors hover:bg-surface"
                >
                  <PersonaAvatar url={p.avatarUrl} name={p.name} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{p.name}</div>
                    <div className="truncate font-mono text-xs text-subtle">
                      {p.handle ? `@${p.handle}` : 'identity pending'}
                    </div>
                  </div>
                  <span className="mono-label text-subtle">{p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

/** One cell of the hairline grid: a header strip plus its rows. */
function Panel({
  title,
  count,
  href,
  linkLabel = 'View all',
  aside,
  children,
}: {
  title: string;
  count?: number;
  href?: string;
  linkLabel?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 bg-bg">
      <CardHeader className="justify-start gap-2.5">
        <CardTitle>{title}</CardTitle>
        {!!count && <span className="font-mono text-xs text-subtle">{count}</span>}
        <span className="flex-1" />
        {aside}
        {href && (
          <Link href={href} className="mono-label text-muted hover:text-fg">
            {linkLabel} →
          </Link>
        )}
      </CardHeader>
      {children}
    </section>
  );
}

function LogRow({ time, who, children }: { time: string; who: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[44px_88px_minmax(0,1fr)] gap-3 px-5 py-2 text-[13px]">
      <span className="font-mono text-xs leading-5 text-subtle">{time}</span>
      <span className="truncate capitalize">{who}</span>
      {children}
    </li>
  );
}

function RowSkeletons() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}
