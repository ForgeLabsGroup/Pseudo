'use client';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { PersonaAvatar } from '@/components/persona-avatar';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';

/** The one place the accent blue appears: a full-width nudge while anything awaits approval. */
function ApprovalBanner() {
  const { data } = useQuery({ queryKey: ['analytics'], queryFn: api.analytics });
  const n = data?.counts.awaitingApproval ?? 0;
  if (n === 0) return null;
  return (
    <Link
      href="/content?status=awaiting_approval"
      className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 bg-accent px-4 py-2 text-[13px] text-white"
    >
      <span className="mono-label border border-white/50 px-1.5">Queue</span>
      <span>
        {n} {n === 1 ? 'post is' : 'posts are'} waiting for your approval
      </span>
      <span className="mono-label text-xs">Review →</span>
    </Link>
  );
}

function PersonaSwitcher() {
  const { data } = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const activeId = useUI((s) => s.activePersonaId);
  const setActivePersona = useUI((s) => s.setActivePersona);
  const personas = data?.personas ?? [];
  const active = personas.find((p) => p.id === activeId) ?? personas[0];
  if (!active) return null;
  return (
    <label className="relative hidden h-9 items-center gap-2.5 border border-border-strong pl-1 pr-9 text-sm transition-colors hover:border-subtle sm:flex">
      <PersonaAvatar url={active.avatarUrl} name={active.name} className="h-7 w-7 text-xs" />
      <span className="max-w-40 truncate">{active.name}</span>
      <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-subtle" />
      <select
        aria-label="Active persona"
        value={active.id}
        onChange={(e) => setActivePersona(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TopBar() {
  return (
    <>
      <ApprovalBanner />
      <header className="flex min-h-[60px] items-center gap-3 border-b border-border px-4 md:px-6">
        <Link href="/" className="font-mono text-sm font-medium tracking-[0.24em]">
          PSEUDO
        </Link>
        <span className="flex-1" />
        <PersonaSwitcher />
        <Link href="/studio">
          <Button>Generate content</Button>
        </Link>
      </header>
    </>
  );
}
