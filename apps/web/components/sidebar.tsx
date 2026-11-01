'use client';
import { useQuery } from '@tanstack/react-query';
import {
  Clapperboard,
  LayoutDashboard,
  Library,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type CountKey = 'awaitingApproval' | 'personas';

const GROUPS: { label: string; items: { href: string; label: string; count?: CountKey }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/', label: 'Command Center' },
      { href: '/studio', label: 'Proof of Life' },
      { href: '/content', label: 'Content', count: 'awaitingApproval' },
      { href: '/analytics', label: 'Analytics' },
    ],
  },
  {
    label: 'Library',
    items: [
      { href: '/personas', label: 'Personas', count: 'personas' },
      { href: '/media', label: 'Media' },
      { href: '/video', label: 'Video' },
    ],
  },
  { label: 'Account', items: [{ href: '/settings', label: 'Settings' }] },
];

const MOBILE_NAV = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/personas', label: 'Personas', icon: UserRound },
  { href: '/studio', label: 'Create', icon: Sparkles },
  { href: '/content', label: 'Content', icon: Library },
  { href: '/video', label: 'Video', icon: Clapperboard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const isActive = (path: string, href: string) =>
  href === '/' ? path === '/' : path.startsWith(href);

/** Phones: the sidebar is hidden, so the main sections live in a bottom bar. */
function MobileNav({ path }: { path: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-bg md:hidden">
      {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 border-t py-2.5 font-mono text-[10px] uppercase tracking-[0.06em]',
            isActive(path, href) ? 'border-fg text-fg' : 'border-transparent text-subtle',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ['analytics'], queryFn: api.analytics });
  return (
    <>
      <MobileNav path={path} />
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <nav className="sticky top-0 flex flex-col gap-6 px-3 py-5">
          {GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col gap-px">
              <span className="mono-label px-2.5 pb-2 text-subtle">{g.label}</span>
              {g.items.map(({ href, label, count }) => {
                const n = count && data ? data.counts[count] : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex min-h-[34px] items-center justify-between px-2.5 text-sm transition-colors',
                      isActive(path, href)
                        ? 'bg-surface-2 text-white'
                        : 'text-muted hover:bg-surface hover:text-fg',
                    )}
                  >
                    {label}
                    {n > 0 && <span className="font-mono text-[11px] text-subtle">{n}</span>}
                  </Link>
                );
              })}
              {g.label === 'Account' && (
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.replace('/login');
                  }}
                  className="flex min-h-[34px] items-center px-2.5 text-left text-sm text-muted transition-colors hover:bg-surface hover:text-fg"
                >
                  Sign out
                </button>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
