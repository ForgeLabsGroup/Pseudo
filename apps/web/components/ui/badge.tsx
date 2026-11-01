import type { ContentStatus, PersonaStatus, Platform } from '@pseudo/shared';
import { PLATFORM_LABELS } from '@pseudo/shared';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ className, ...p }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'mono-label inline-flex items-center gap-1 border border-border-strong px-1.5 py-px text-[10px] text-muted',
        className,
      )}
      {...p}
    />
  );
}

const STATUS_STYLE: Record<ContentStatus, string> = {
  draft: 'text-muted',
  generating: 'text-fg animate-pulse',
  awaiting_approval: 'text-warning border-warning/40',
  approved: 'text-fg border-subtle',
  rejected: 'text-subtle line-through',
  scheduled: 'text-link border-link/40',
  publishing: 'text-link border-link/40 animate-pulse',
  published: 'text-success border-success/40',
  failed: 'text-danger border-danger/40',
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <Badge className={STATUS_STYLE[status]}>{status.replace('_', ' ')}</Badge>;
}

const PERSONA_STATUS_STYLE: Record<PersonaStatus, string> = {
  generating: 'text-fg animate-pulse',
  draft: 'text-warning border-warning/40',
  active: 'text-success border-success/40',
  archived: 'text-subtle',
  failed: 'text-danger border-danger/40',
};

export function PersonaStatusBadge({ status }: { status: PersonaStatus }) {
  return <Badge className={PERSONA_STATUS_STYLE[status]}>{status}</Badge>;
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return <Badge>{PLATFORM_LABELS[platform]}</Badge>;
}

/** Responsible-design requirement: generated media is always labelled. */
export function AiBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn('border-transparent bg-black/75 text-white', className)}>
      AI-generated
    </Badge>
  );
}

/** Simulated data must never be presented as real. */
export function SampleDataBadge() {
  return <Badge className="border-warning/40 text-warning">Sample data</Badge>;
}
