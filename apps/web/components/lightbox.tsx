'use client';
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { AiBadge, Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface LightboxImage {
  url: string;
  alt?: string;
  aiGenerated: boolean;
  caption?: ReactNode;
}

const control =
  'flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-white/80 transition hover:bg-black/80 hover:text-white [&_svg]:h-4 [&_svg]:w-4';

/**
 * Full-screen photo viewer. Uses a native modal <dialog> so it renders in the top layer
 * (above every overlay) and gets focus trapping and Esc for free.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = index !== null && index < images.length;
  const image = open ? images[index] : undefined;
  const count = images.length;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  const step = (delta: number) => {
    if (index === null || count < 2) return;
    onIndexChange((index + delta + count) % count);
  };

  return (
    <dialog
      ref={ref}
      aria-label="Photo viewer"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none bg-black/95 p-0 text-white backdrop:bg-transparent"
    >
      {image && (
        <div
          className="flex h-full flex-col"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="flex items-center gap-2 p-3">
            {image.aiGenerated ? (
              <AiBadge />
            ) : (
              <Badge className="border-transparent bg-black/75 text-white">Selfie</Badge>
            )}
            {count > 1 && (
              <span className="font-mono text-xs text-white/60">
                {index! + 1} / {count}
              </span>
            )}
            <div className="ml-auto flex gap-1">
              <a href={image.url} download className={control} aria-label="Download">
                <Download />
              </a>
              <a
                href={image.url}
                target="_blank"
                rel="noreferrer"
                className={control}
                aria-label="Open original"
              >
                <ExternalLink />
              </a>
              <button onClick={onClose} className={control} aria-label="Close">
                <X />
              </button>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-16"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={image.url}
              src={image.url}
              alt={image.alt ?? ''}
              className="max-h-full max-w-full select-none object-contain"
            />
            {count > 1 && (
              <>
                <button
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                  className={cn(control, 'absolute left-3 top-1/2 -translate-y-1/2 p-2')}
                >
                  <ChevronLeft />
                </button>
                <button
                  onClick={() => step(1)}
                  aria-label="Next photo"
                  className={cn(control, 'absolute right-3 top-1/2 -translate-y-1/2 p-2')}
                >
                  <ChevronRight />
                </button>
              </>
            )}
          </div>

          <div className="min-h-12 px-4 py-3 text-center text-sm text-white/70">
            {image.caption}
          </div>
        </div>
      )}
    </dialog>
  );
}
