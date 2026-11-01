import Image from 'next/image';
import { cn } from '@/lib/utils';

/** PSEUDO brand: `mark` = the P only, `full` = P + wordmark (transparent PNGs in /public). */
export function Logo({
  variant = 'mark',
  size = 28,
  className,
}: {
  variant?: 'mark' | 'full';
  /** Height in px. */
  size?: number;
  className?: string;
}) {
  const full = variant === 'full';
  return (
    <Image
      src={full ? '/logo.png' : '/logo-mark.png'}
      alt="PSEUDO"
      width={full ? Math.round(size * (640 / 618)) : size}
      height={size}
      priority
      className={cn('select-none', className)}
    />
  );
}
