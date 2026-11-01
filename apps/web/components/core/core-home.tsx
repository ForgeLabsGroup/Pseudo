'use client';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useLayoutEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';
import { Hud } from './hud';
import { ViewToggle } from './view-toggle';

// three.js + postprocessing only load when the Core view is actually shown.
const CoreScene = dynamic(() => import('./core-scene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <span className="mono-label animate-pulse text-subtle">Booting core…</span>
    </div>
  ),
});

/** Bottom edge of the top bar (it grows when the approval banner shows), so the layer sits below it. */
function useTopBarBottom() {
  const [top, setTop] = useState(60);
  useLayoutEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const update = () => setTop(Math.max(0, Math.round(header.getBoundingClientRect().bottom)));
    update();
    const resize = new ResizeObserver(update);
    resize.observe(header);
    const banner = new MutationObserver(update);
    if (header.parentElement) banner.observe(header.parentElement, { childList: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      resize.disconnect();
      banner.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, []);
  return top;
}

/**
 * Core: a fixed layer over the main area (right of the sidebar, below the top bar) so the shared
 * (app) layout and its max-width wrapper stay untouched.
 */
export function CoreHome() {
  const top = useTopBarBottom();
  const personas = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const activeId = useUI((s) => s.activePersonaId);
  const list = personas.data?.personas ?? [];
  const persona = list.find((p) => p.id === activeId) ?? list[0];

  return (
    <div
      style={{ top }}
      className="fixed inset-x-0 bottom-0 z-10 overflow-y-auto bg-bg pb-16 md:left-56 md:pb-0 lg:overflow-hidden"
    >
      <h1 className="sr-only">Command Center: live agent core</h1>
      <div className="relative isolate h-[56vh] min-h-[340px] lg:absolute lg:inset-0 lg:h-auto">
        <CoreScene personaName={persona?.name ?? null} />
      </div>
      <ViewToggle className="absolute right-4 top-4 z-20 lg:right-6" />
      <Hud />
    </div>
  );
}
