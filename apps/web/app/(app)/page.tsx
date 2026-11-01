'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';
import { timeAgo } from '@/lib/utils';

/** Command Center. Owner: Person B (UI). Basic version wired to real data. */
export default function CommandCenter() {
  const { data } = useQuery({ queryKey: ['analytics'], queryFn: api.analytics });
  const { data: personas } = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const activity = useUI((s) => s.activity);

  const stats = data
    ? [
        ['Personas', data.counts.personas],
        ['Awaiting approval', data.counts.awaitingApproval],
        ['Scheduled', data.counts.scheduled],
        ['Published', data.counts.published],
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
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
              <div className="mt-2 text-3xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active personas</CardTitle>
            <Link href="/personas/new" className="text-xs text-accent">
              + New persona
            </Link>
          </CardHeader>
          <CardContent>
            {personas?.personas.length ? (
              <ul className="divide-y divide-border">
                {personas.personas.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/personas/${p.id}`}
                      className="flex items-center gap-3 py-3 hover:opacity-80"
                    >
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-accent to-accent-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.avatarUrl && (
                          <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted">
                          {p.handle ? `@${p.handle}` : p.status}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No alter egos yet"
                body="Create your first persona to get started."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live agent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 && data?.recentRuns.length === 0 && (
              <p className="text-sm text-muted">Quiet for now.</p>
            )}
            <ul className="space-y-3 text-sm">
              {activity.slice(0, 8).map((e, i) => (
                <li key={i} className="text-muted">
                  <span className="text-fg">{'agent' in e ? e.agent : e.type}</span>{' '}
                  {'message' in e ? e.message : e.type.replace('.', ' ')}
                </li>
              ))}
              {activity.length === 0 &&
                data?.recentRuns.map((r) => (
                  <li key={r.id} className="flex justify-between text-muted">
                    <span>
                      <span className="text-fg">{r.agent}</span> {r.status}
                    </span>
                    <span>{timeAgo(r.createdAt)}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
