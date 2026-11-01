'use client';
import { PLATFORM_LABELS, PLATFORMS, type DashboardResponse, type Platform } from '@pseudo/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorText } from '@/components/error-text';
import { PageHeader } from '@/components/page-header';
import { SampleDataBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

/** Categorical slots 1-4 (dataviz reference palette, dark steps), validated on --color-surface. */
const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: '#3987e5',
  tiktok: '#d95926',
  youtube_shorts: '#199e70',
  x: '#c98500',
};

const fmt = (n: number) => n.toLocaleString();

type Day = { date: string } & Record<Platform, number>;

/** One row per day; multiple snapshots for the same platform and day are summed. */
function byDay(engagement: DashboardResponse['engagement'], key: 'impressions' | 'likes') {
  const days = new Map<string, Day>();
  for (const e of engagement) {
    const day =
      days.get(e.date) ??
      ({ date: e.date, instagram: 0, tiktok: 0, youtube_shorts: 0, x: 0 } satisfies Day);
    day[e.platform as Platform] += e[key];
    days.set(e.date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['analytics'], queryFn: api.analytics });

  const impressions = data ? byDay(data.engagement, 'impressions') : [];
  const totals = (key: 'impressions' | 'likes', platform?: Platform) =>
    data?.engagement
      .filter((e) => !platform || e.platform === platform)
      .reduce((s, e) => s + e[key], 0) ?? 0;
  const totalImpressions = totals('impressions');
  const totalLikes = totals('likes');

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="How your alter egos' posts are doing."
        actions={data?.engagementIsSample && <SampleDataBadge />}
      />
      <ErrorText error={error} className="mb-4" />
      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-28" />
          <Skeleton className="h-80" />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {data.engagementIsSample && (
            <p className="border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">
              Engagement below is sample data, not real results. Real numbers appear once posts go
              out through connected accounts. Content counts are real.
            </p>
          )}

          <div className="grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
            <Stat label="Impressions" value={fmt(totalImpressions)} />
            <Stat label="Likes" value={fmt(totalLikes)} />
            <Stat
              label="Like rate"
              value={
                totalImpressions ? `${((totalLikes / totalImpressions) * 100).toFixed(1)}%` : '—'
              }
            />
            <Stat label="Posts published" value={fmt(data.counts.published)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily impressions by platform</CardTitle>
              <Legend />
            </CardHeader>
            <CardContent>
              {impressions.length > 1 ? (
                <LineChart days={impressions} />
              ) : (
                <p className="py-10 text-center text-sm text-muted">Not enough data yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By platform</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {['Platform', 'Posts', 'Published', 'Impressions', 'Likes'].map((h, i) => (
                      <th
                        key={h}
                        className={`mono-label px-5 py-3 font-normal text-subtle ${i ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.byPlatform.map((p) => (
                    <tr key={p.platform}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: PLATFORM_COLORS[p.platform] }}
                          />
                          {PLATFORM_LABELS[p.platform]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">{p.total}</td>
                      <td className="px-5 py-3 text-right font-mono">{p.published}</td>
                      <td className="px-5 py-3 text-right font-mono">
                        {fmt(totals('impressions', p.platform))}
                      </td>
                      <td className="px-5 py-3 text-right font-mono">
                        {fmt(totals('likes', p.platform))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
                {(
                  [
                    ['Total', data.counts.content],
                    ['Awaiting approval', data.counts.awaitingApproval],
                    ['Approved', data.counts.approved],
                    ['Scheduled', data.counts.scheduled],
                    ['Published', data.counts.published],
                    ['Failed', data.counts.failed],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="mono-label text-subtle">{label}</dt>
                    <dd className="mt-1 font-mono text-xl">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-3.5 bg-bg px-5 py-[18px]">
      <span className="mono-label text-subtle">{label}</span>
      <span className="text-[40px] font-normal leading-none tracking-[-0.04em] tabular-nums">
        {value}
      </span>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {PLATFORMS.map((p) => (
        <li key={p} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3" style={{ background: PLATFORM_COLORS[p] }} />
          {PLATFORM_LABELS[p]}
        </li>
      ))}
    </ul>
  );
}

const W = 760;
const H = 260;
const PAD = { top: 12, right: 96, bottom: 28, left: 48 };

function LineChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.flatMap((d) => PLATFORMS.map((p) => d[p])), 1);
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const x = (i: number) => PAD.left + (i / (days.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(top * t));
  const label = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const last = days[days.length - 1]!;
  // Direct labels at line ends, nudged apart so they never overlap.
  const ends = PLATFORMS.map((p) => ({ p, y: y(last[p]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 14);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Daily impressions by platform"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (days.length - 1));
          setHover(Math.min(days.length - 1, Math.max(0, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--color-subtle)"
            >
              {fmt(t)}
            </text>
          </g>
        ))}
        {days.map((d, i) =>
          i % Math.ceil(days.length / 7) === 0 || i === days.length - 1 ? (
            <text
              key={d.date}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-subtle)"
            >
              {label(d.date)}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--color-border-strong)"
            strokeWidth={1}
          />
        )}
        {PLATFORMS.map((p) => (
          <path
            key={p}
            d={days.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[p])}`).join('')}
            fill="none"
            stroke={PLATFORM_COLORS[p]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {hover !== null &&
          PLATFORMS.map((p) => (
            <circle
              key={p}
              cx={x(hover)}
              cy={y(days[hover]![p])}
              r={4}
              fill={PLATFORM_COLORS[p]}
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ))}
        {ends.map(({ p, y: ly }) => (
          <text
            key={p}
            x={W - PAD.right + 8}
            y={ly}
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--color-muted)"
          >
            {PLATFORM_LABELS[p]}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 border border-border-strong bg-bg px-3 py-2 text-xs shadow-lg"
          style={
            x(hover) > W / 2
              ? { right: `${((W - x(hover)) / W) * 100 + 2}%` }
              : { left: `${(x(hover) / W) * 100 + 2}%` }
          }
        >
          <div className="mb-1 text-muted">{label(days[hover]!.date)}</div>
          {PLATFORMS.map((p) => (
            <div key={p} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_COLORS[p] }} />
                {PLATFORM_LABELS[p]}
              </span>
              <span className="font-mono text-fg">{fmt(days[hover]![p])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
