'use client';
import type { ContentItem } from '@pseudo/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ContentEditor } from '@/components/content-editor';
import { ErrorText } from '@/components/error-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePublishing } from '@/hooks/use-publishing';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

/** `datetime-local` wants local time without a zone. */
function localInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Review + publish controls for one content item. Only approved (or failed-after-approval)
 * items can be published; the API enforces this too.
 */
export function ContentActions({ item, compact }: { item: ContentItem; compact?: boolean }) {
  const qc = useQueryClient();
  const { recordFor, queuedJobFor } = usePublishing();
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [runAt, setRunAt] = useState(() => localInputValue(new Date(Date.now() + 3600_000)));
  const [pending, setPending] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: async ({ fn }: { label: string; fn: () => Promise<unknown> }) => fn(),
    onMutate: ({ label }) => setPending(label),
    onSuccess: () => setScheduling(false),
    onSettled: () => {
      setPending(null);
      void qc.invalidateQueries({ queryKey: ['content'] });
      void qc.invalidateQueries({ queryKey: ['publishing'] });
    },
  });
  const run = (label: string, fn: () => Promise<unknown>) => act.mutate({ label, fn });
  const busy = (label: string) => pending === label;

  if (editing) return <ContentEditor item={item} onDone={() => setEditing(false)} />;

  const record = recordFor(item.id);
  const queued = queuedJobFor(item.id);
  const needsVideo = item.body?.type === 'short_video' && !item.body.videoAssetId;
  const reviewable = ['awaiting_approval', 'rejected', 'draft'].includes(item.status);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {item.status === 'generating' && (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating…
          </span>
        )}

        {reviewable && item.body && (
          <>
            <Button
              size="sm"
              variant="success"
              disabled={!!pending}
              onClick={() => run('approve', () => api.content.approve(item.id))}
            >
              {busy('approve') ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve
            </Button>
            {item.status !== 'rejected' && (
              <Button
                size="sm"
                variant="danger"
                disabled={!!pending}
                onClick={() =>
                  run('reject', () => api.content.approve(item.id, { approved: false }))
                }
              >
                <X className="h-4 w-4" /> Reject
              </Button>
            )}
          </>
        )}

        {(item.status === 'approved' || (item.status === 'failed' && item.body)) && (
          <>
            <Button
              size="sm"
              disabled={!!pending}
              onClick={() => run('publish', () => api.publishing.publishNow(item.id))}
            >
              {busy('publish') ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {item.status === 'failed' ? 'Retry publish' : 'Publish now'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!pending}
              onClick={() => setScheduling(!scheduling)}
            >
              <CalendarClock className="h-4 w-4" /> Schedule
            </Button>
          </>
        )}

        {item.status === 'scheduled' && (
          <>
            <span className="flex items-center gap-1.5 text-sm text-accent">
              <CalendarClock className="h-4 w-4" />
              {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Scheduled'}
            </span>
            {queued && (
              <Button
                size="sm"
                variant="ghost"
                disabled={!!pending}
                onClick={() => run('cancel', () => api.publishing.cancel(queued.id))}
              >
                Cancel
              </Button>
            )}
          </>
        )}

        {item.status === 'publishing' && (
          <span className="flex items-center gap-2 text-sm text-accent-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Publishing…
          </span>
        )}

        {item.status === 'published' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-success">
              Published {item.publishedAt ? timeAgo(item.publishedAt) : ''}
            </span>
            {record?.externalUrl && (
              <a
                href={record.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-accent-2 hover:underline"
              >
                Open post <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {record?.mode === 'mock' && <span className="text-xs text-muted">(simulated)</span>}
          </div>
        )}

        {!compact &&
          item.body &&
          ['awaiting_approval', 'approved', 'rejected', 'draft'].includes(item.status) && (
            <Button size="sm" variant="ghost" disabled={!!pending} onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}

        {!compact && ['awaiting_approval', 'rejected', 'failed', 'draft'].includes(item.status) && (
          <Button
            size="sm"
            variant="ghost"
            disabled={!!pending}
            onClick={() => run('regenerate', () => api.content.regenerate(item.id))}
          >
            <RefreshCw className={busy('regenerate') ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Regenerate
          </Button>
        )}
      </div>

      {scheduling && (item.status === 'approved' || item.status === 'failed') && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="datetime-local"
            className="h-8 w-auto"
            value={runAt}
            min={localInputValue(new Date())}
            onChange={(e) => setRunAt(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!!pending || !runAt}
            onClick={() =>
              run('schedule', () =>
                api.publishing.schedule(item.id, { runAt: new Date(runAt).toISOString() }),
              )
            }
          >
            Confirm
          </Button>
        </div>
      )}

      {needsVideo && !compact && ['approved', 'awaiting_approval'].includes(item.status) && (
        <Link href="/video" className="block text-xs text-accent hover:underline">
          This script needs a video before it can publish. Build it in Video Studio →
        </Link>
      )}
      {item.status === 'failed' && item.body && item.error && (
        <p className="text-xs text-danger">{item.error}</p>
      )}
      <ErrorText error={act.error} />
    </div>
  );
}
