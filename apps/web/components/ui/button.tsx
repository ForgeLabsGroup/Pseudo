import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 border font-mono text-xs font-medium uppercase tracking-[0.06em] transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link [&_svg]:h-3.5 [&_svg]:w-3.5',
  {
    variants: {
      variant: {
        primary: 'border-fg bg-fg text-bg hover:bg-white',
        secondary: 'border-border-strong text-fg hover:border-subtle hover:bg-surface-2',
        ghost: 'border-transparent text-muted hover:bg-surface-2 hover:text-fg',
        danger: 'border-border-strong text-danger hover:border-danger/60 hover:bg-danger/10',
        success: 'border-border-strong text-success hover:border-success/60 hover:bg-success/10',
      },
      size: { sm: 'h-8 px-3 text-[11px]', md: 'h-9 px-4', lg: 'h-11 px-6', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
