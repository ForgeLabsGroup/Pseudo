'use client';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useLiveEvents } from '@/hooks/use-live-events';
import { supabase } from '@/lib/supabase';

/** Client-side auth guard for the (app) route group. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session, router]);

  useLiveEvents(!!session);

  if (!session)
    return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  return <>{children}</>;
}
