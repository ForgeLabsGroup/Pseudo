import type { ContentStatus, Platform } from '@pseudo/shared';
import { PLATFORM_LABELS } from '@pseudo/shared';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ className, ...p }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted',
        className,
      )}
      {...p}
    />
  );
}

const STATUS_STYLE: Record<ContentStatus, string> = {
  draft: 'text-muted',
  generating: 'text-accent border-accent/40 animate-pulse',
  awaiting_approval: 'text-warning border-warning/40',
  approved: 'text-accent-2 border-accent-2/40',
  rejected: 'text-muted line-through',
  scheduled: 'text-accent border-accent/40',
  publishing: 'text-accent-2 border-accent-2/40 animate-pulse',
  published: 'text-success border-success/40',
  failed: 'text-danger border-danger/40',
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <Badge className={STATUS_STYLE[status]}>{status.replace('_', ' ')}</Badge>;
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return <Badge>{PLATFORM_LABELS[platform]}</Badge>;
}

/** Responsible-design requirement: generated media is always labelled. */
export function AiBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn('bg-black/60 text-white/90 backdrop-blur', className)}>AI-generated</Badge>
  );
}

/** Simulated data must never be presented as real. */
export function SampleDataBadge() {
  return <Badge className="border-warning/40 text-warning">Sample data</Badge>;
}
