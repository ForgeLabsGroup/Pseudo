import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Inline error for a failed mutation. Shows API validation problems (e.g. 422 details) as a list. */
export function ErrorText({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const details =
    error instanceof ApiError && Array.isArray(error.details)
      ? error.details.filter((d): d is string => typeof d === 'string')
      : [];
  return (
    <div className={cn('text-sm text-danger', className)}>
      <p>{message}</p>
      {details.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
