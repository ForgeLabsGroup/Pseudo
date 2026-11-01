'use client';
import type { AgentName, LiveEvent } from '@pseudo/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Camera,
  Clapperboard,
  Compass,
  ExternalLink,
  PenLine,
  Search,
  Send,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { ContentActions } from '@/components/content-actions';
import { EmptyState, PageHeader } from '@/components/page-header';
import { PersonaAvatar } from '@/components/persona-avatar';
import { PlatformBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublishing } from '@/hooks/use-publishing';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';
import { timeAgo } from '@/lib/utils';

const AGENT_ICONS: Record<AgentName, LucideIcon> = {
  persona: UserRound,
  strategy: Compass,
  content: PenLine,
  visual: Camera,
  video: Clapperboard,
  distribution: Send,
  analytics: BarChart3,
  research: Search,
};

function describe(e: LiveEvent): { icon: LucideIcon; who: string; text: string; tone?: string } {
  switch (e.type) {
    case 'run.started':
      return { icon: AGENT_ICONS[e.agent], who: e.agent, text: 'started' };
    case 'run.progress':
      return { icon: AGENT_ICONS[e.agent], who: e.agent, text: e.message };
    case 'run.succeeded':
      return { icon: AGENT_ICONS[e.agent], who: e.agent, text: 'finished', tone: 'text-success' };
    case 'run.failed':
      return {
        icon: AGENT_ICONS[e.agent],
        who: e.agent,
        text: `failed: ${e.error}`,
        tone: 'text-danger',
      };
    case 'persona.updated':
      return { icon: UserRound, who: 'persona', text: 'identity updated' };
    case 'archetype.updated':
      return { icon: Search, who: 'research', text: 'playbook refreshed' };
    case 'content.updated':
      return { icon: PenLine, who: 'content', text: e.status.replace('_', ' ') };
    case 'media.created':
      return { icon: Camera, who: 'visual', text: 'new photo ready' };
    case 'publish.updated':
      return {
        icon: Send,
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
        { label: 'Personas', value: data.counts.personas, href: '/personas' },
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
        subtitle="Everything your alter egos are doing, in one place."
        actions={
          <Link href="/studio">
            <Button>Generate content</Button>
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading &&
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card
              className={
                s.highlight
                  ? 'border-warning/40 transition hover:border-warning'
                  : 'transition hover:border-muted'
              }
            >
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-muted">{s.label}</div>
                <div className={`mt-2 text-3xl font-semibold ${s.highlight ? 'text-warning' : ''}`}>
                  {s.value}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Approval queue</CardTitle>
              <Link href="/content?status=awaiting_approval" className="text-xs text-accent">
                Review all →
              </Link>
            </CardHeader>
            <CardContent>
              {queue.isLoading && <RowSkeletons />}
              {queue.data?.items.length === 0 && (
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
              )}
              <ul className="divide-y divide-border">
                {queue.data?.items.map((item) => {
                  const p = personaById.get(item.personaId);
                  return (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                      <PersonaAvatar url={p?.avatarUrl} name={p?.name} className="h-8 w-8" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <PlatformBadge platform={item.platform} />
                          {p?.name} · {timeAgo(item.createdAt)}
                        </div>
                      </div>
                      <ContentActions item={item} compact />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent publishes</CardTitle>
              <Link href="/content?status=published" className="text-xs text-accent">
                See all →
              </Link>
            </CardHeader>
            <CardContent>
              {published.isLoading && <RowSkeletons />}
              {published.data?.items.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">
                  Nothing published yet. Approve a post, then hit Publish.
                </p>
              )}
              <ul className="divide-y divide-border">
                {published.data?.items.map((item) => {
                  const record = recordFor(item.id);
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-3 text-sm">
                      <PlatformBadge platform={item.platform} />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      <span className="text-xs text-muted">
                        {item.publishedAt && timeAgo(item.publishedAt)}
                      </span>
                      {record?.externalUrl && (
                        <a
                          href={record.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-accent-2 hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Live agent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {activity.slice(0, 10).map((e, i) => {
                    const d = describe(e);
                    const Icon = d.icon;
                    return (
                      <li key={`${e.at}-${i}`} className="flex gap-2.5">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium capitalize">{d.who}</span>{' '}
                          <span className={d.tone ?? 'text-muted'}>{d.text}</span>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted">
                          {timeAgo(new Date(e.at).toISOString())}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : data?.recentRuns.length ? (
                <ul className="space-y-3 text-sm">
                  {data.recentRuns.map((r) => {
                    const Icon = AGENT_ICONS[r.agent];
                    return (
                      <li key={r.id} className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-muted" />
                        <span className="flex-1">
                          <span className="font-medium capitalize">{r.agent}</span>{' '}
                          <span
                            className={
                              r.status === 'failed'
                                ? 'text-danger'
                                : r.status === 'succeeded'
                                  ? 'text-muted'
                                  : 'text-accent'
                            }
                          >
                            {r.status}
                          </span>
                        </span>
                        <span className="text-[11px] text-muted">{timeAgo(r.createdAt)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : isLoading ? (
                <RowSkeletons />
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted">
                  <Activity className="h-5 w-5" />
                  Quiet for now. Agent steps show up here live.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alter egos</CardTitle>
              <Link href="/personas/new" className="text-xs text-accent">
                + New
              </Link>
            </CardHeader>
            <CardContent>
              {personas.isLoading && <RowSkeletons />}
              {personas.data?.personas.length === 0 && (
                <EmptyState
                  title="No alter egos yet"
                  body="Create your first persona to get started."
                  action={
                    <Link href="/personas/new">
                      <Button size="sm">Create persona</Button>
                    </Link>
                  }
                />
              )}
              <ul className="divide-y divide-border">
                {personas.data?.personas.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/personas/${p.id}`}
                      className="flex items-center gap-3 py-3 hover:opacity-80"
                    >
                      <PersonaAvatar url={p.avatarUrl} name={p.name} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="truncate text-xs text-muted">
                          {p.handle ? `@${p.handle}` : p.status}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function RowSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}
