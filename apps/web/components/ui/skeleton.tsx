import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse bg-surface-2', className)} {...p} />;
}
