'use client';
import {
  BarChart3,
  Clapperboard,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
  Library,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Command Center', icon: LayoutDashboard },
  { href: '/personas', label: 'Persona Studio', icon: UserRound },
  { href: '/studio', label: 'Proof of Life', icon: Sparkles },
  { href: '/content', label: 'Content Studio', icon: Library },
  { href: '/media', label: 'Media Library', icon: ImageIcon },
  { href: '/video', label: 'Video Studio', icon: Clapperboard },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface/60 p-4 md:flex">
      <Link href="/" className="mb-8 px-2">
        <div className="text-xl font-bold tracking-[0.2em] text-gradient">PSEUDO</div>
        <div className="text-[11px] text-muted">Your alter ego.</div>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon className={cn('h-4 w-4', active && 'text-accent')} />
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        }}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </aside>
  );
}
