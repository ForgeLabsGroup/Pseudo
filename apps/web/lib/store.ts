'use client';
import type { LiveEvent } from '@pseudo/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type HomeView = 'core' | 'classic';

interface UIState {
  /** Persona currently being "operated". Most pages default to it. */
  activePersonaId: string | null;
  setActivePersona: (id: string | null) => void;
  /** Rolling feed of live agent activity (from SSE). */
  activity: (LiveEvent & { at: number })[];
  pushActivity: (e: LiveEvent) => void;
  /** Home page: the live 3D agent graph or the classic dashboard. */
  homeView: HomeView;
  setHomeView: (v: HomeView) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      activePersonaId: null,
      setActivePersona: (id) => set({ activePersonaId: id }),
      activity: [],
      pushActivity: (e) =>
        set((s) => ({ activity: [{ ...e, at: Date.now() }, ...s.activity].slice(0, 50) })),
      homeView: 'core',
      setHomeView: (v) => set({ homeView: v }),
    }),
    {
      name: 'pseudo-ui',
      partialize: (s) => ({ activePersonaId: s.activePersonaId, homeView: s.homeView }),
    },
  ),
);
