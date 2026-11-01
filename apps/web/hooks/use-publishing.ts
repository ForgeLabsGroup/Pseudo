'use client';
import type { PublishingJob, PublishingRecord } from '@pseudo/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '@/lib/api';

/** Publishing jobs/records indexed by content id (ContentItem itself carries no post URL). */
export function usePublishing() {
  const query = useQuery({ queryKey: ['publishing'], queryFn: api.publishing.list });
  const lookup = useMemo(() => {
    const records = new Map<string, PublishingRecord>();
    const queued = new Map<string, PublishingJob>();
    // API returns newest first, so the first match wins.
    for (const r of query.data?.records ?? [])
      if (r.success && !records.has(r.contentId)) records.set(r.contentId, r);
    for (const j of query.data?.jobs ?? [])
      if (j.status === 'queued' && !queued.has(j.contentId)) queued.set(j.contentId, j);
    return { records, queued };
  }, [query.data]);
  return {
    ...query,
    recordFor: (contentId: string) => lookup.records.get(contentId),
    queuedJobFor: (contentId: string) => lookup.queued.get(contentId),
  };
}
