import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full border border-border-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-subtle transition-colors focus:border-subtle focus:outline-none';

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, 'h-10', className)} {...p} />;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, 'min-h-24', className)} {...p} />;
}
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(base, 'h-10 pr-8', className)} {...p} />;
}
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mono-label mb-2 block text-subtle', className)} {...p} />;
}
