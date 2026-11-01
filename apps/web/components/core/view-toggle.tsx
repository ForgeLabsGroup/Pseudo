'use client';
import { useUI, type HomeView } from '@/lib/store';
import { cn } from '@/lib/utils';

const VIEWS: { value: HomeView; label: string }[] = [
  { value: 'core', label: 'Core' },
  { value: 'classic', label: 'Classic' },
];

/** Core / Classic switch for the home page. The choice is persisted in the UI store. */
export function ViewToggle({ className }: { className?: string }) {
  const view = useUI((s) => s.homeView);
  const setView = useUI((s) => s.setHomeView);
  return (
    <div
      role="radiogroup"
      aria-label="Home view"
      className={cn('flex border border-border-strong bg-bg/70 backdrop-blur', className)}
    >
      {VIEWS.map((v) => (
        <button
          key={v.value}
          type="button"
          role="radio"
          aria-checked={view === v.value}
          onClick={() => setView(v.value)}
          className={cn(
            'mono-label h-8 px-3 transition-colors focus-visible:outline-2 focus-visible:outline-link',
            view === v.value ? 'bg-fg text-bg' : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
