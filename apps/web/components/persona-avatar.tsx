import { cn } from '@/lib/utils';

export function PersonaAvatar({
  url,
  name,
  className,
}: {
  url: string | null | undefined;
  name?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden bg-surface-2 font-mono text-sm text-muted',
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        (name?.[0]?.toUpperCase() ?? '?')
      )}
    </div>
  );
}
