'use client';
import { CONTENT_STATUSES, PLATFORM_LABELS, PLATFORMS } from '@pseudo/shared';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ContentActions } from '@/components/content-actions';
import { ErrorText } from '@/components/error-text';
import { EmptyState, PageHeader } from '@/components/page-header';
import { PostCard } from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

const FILTER_KEYS = ['personaId', 'platform', 'status'] as const;

export default function ContentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ContentStudio />
    </Suspense>
  );
}

/** Content Studio: review, edit, approve and publish everything the agents wrote. */
function ContentStudio() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = {
    personaId: params.get('personaId') ?? undefined,
    platform: (params.get('platform') ?? undefined) as (typeof PLATFORMS)[number] | undefined,
    status: (params.get('status') ?? undefined) as (typeof CONTENT_STATUSES)[number] | undefined,
  };
  const setFilter = (key: (typeof FILTER_KEYS)[number], value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const personas = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const content = useQuery({
    queryKey: ['content', filters],
    queryFn: () => api.content.list({ ...filters, limit: 100 }),
  });
  const personaById = new Map(personas.data?.personas.map((p) => [p.id, p]));
  const filtered = FILTER_KEYS.some((k) => filters[k]);

  return (
    <>
      <PageHeader
        title="Content Studio"
        subtitle="Nothing goes out until you approve it."
        actions={
          <Link href="/studio">
            <Button>
              <Sparkles className="h-4 w-4" /> Generate more
            </Button>
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Select
          aria-label="Persona"
          className="w-auto"
          value={filters.personaId ?? ''}
          onChange={(e) => setFilter('personaId', e.target.value)}
        >
          <option value="">All personas</option>
          {personas.data?.personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Platform"
          className="w-auto"
          value={filters.platform ?? ''}
          onChange={(e) => setFilter('platform', e.target.value)}
        >
          <option value="">All platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          className="w-auto"
          value={filters.status ?? ''}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">All statuses</option>
          {CONTENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </Select>
        {filtered && (
          <Button variant="ghost" onClick={() => router.replace(pathname)}>
            Clear
          </Button>
        )}
      </div>

      <ErrorText error={content.error} className="mb-4" />
      {content.isLoading && (
        <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="mb-4 h-80 break-inside-avoid rounded-2xl" />
          ))}
        </div>
      )}
      {content.data?.items.length === 0 && (
        <EmptyState
          title={filtered ? 'Nothing matches these filters' : 'No content yet'}
          body={
            filtered
              ? 'Try a different persona, platform or status.'
              : 'Head to Proof of Life and let your alter ego post something.'
          }
          action={
            !filtered && (
              <Link href="/studio">
                <Button>Generate content</Button>
              </Link>
            )
          }
        />
      )}
      <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
        {content.data?.items.map((item) => (
          <PostCard
            key={item.id}
            item={item}
            persona={personaById.get(item.personaId)}
            className="mb-4 break-inside-avoid"
            footer={<ContentActions item={item} />}
          />
        ))}
      </div>
    </>
  );
}
