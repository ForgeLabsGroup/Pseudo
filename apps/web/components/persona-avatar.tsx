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
        'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-accent-2 text-sm font-semibold text-white',
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
