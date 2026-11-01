import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-accent to-accent-2 text-white shadow-lg shadow-accent/20 hover:brightness-110',
        secondary: 'bg-surface-2 text-fg border border-border hover:bg-border/60',
        ghost: 'text-muted hover:text-fg hover:bg-surface-2',
        danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
        success: 'bg-success/15 text-success border border-success/30 hover:bg-success/25',
      },
      size: { sm: 'h-8 px-3', md: 'h-10 px-4', lg: 'h-12 px-6 text-base', icon: 'h-9 w-9' },
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
