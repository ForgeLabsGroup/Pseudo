'use client';
import { Check, ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export const SELFIE_MIN = 3;
export const SELFIE_MAX = 6;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

export type UploadState = 'idle' | 'uploading' | 'done' | 'error';

/** Pick 3–6 selfies of yourself. Upload happens in the parent (needs the persona id). */
export function SelfieDropzone({
  files,
  onChange,
  states,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  states?: UploadState[];
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => ACCEPT.includes(f.type));
    onChange([...files, ...picked].slice(0, SELFIE_MAX));
  };

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center transition',
          over && 'border-accent bg-accent/5',
          (disabled || files.length >= SELFIE_MAX) && 'pointer-events-none opacity-50',
        )}
      >
        <ImagePlus className="h-6 w-6 text-accent" />
        <span className="text-sm">
          Drop {SELFIE_MIN}–{SELFIE_MAX} selfies or click to choose
        </span>
        <span className="text-xs text-muted">
          Clear face, good light, different angles. JPEG, PNG or WebP.
        </span>
        <input
          type="file"
          accept={ACCEPT.join(',')}
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {files.map((f, i) => {
            const state = states?.[i] ?? 'idle';
            return (
              <div
                key={previews[i]}
                className="relative aspect-square overflow-hidden rounded-xl border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previews[i]} alt="" className="h-full w-full object-cover" />
                {state === 'idle' && !disabled && (
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => onChange(files.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {state !== 'idle' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    {state === 'uploading' && (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    )}
                    {state === 'done' && <Check className="h-5 w-5 text-success" />}
                    {state === 'error' && <X className="h-5 w-5 text-danger" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted">
        {files.length}/{SELFIE_MAX} selected. These are only used to put your face on your alter
        ego&apos;s photos.
      </p>
    </div>
  );
}
