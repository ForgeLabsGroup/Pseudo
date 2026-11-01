'use client';
import { LiveEvent } from '@pseudo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { API_URL, accessToken } from '@/lib/api';
import { useUI } from '@/lib/store';

/**
 * One SSE connection per session. Pushes events into the activity feed and invalidates
 * the matching TanStack Query caches so every page updates live.
 */
export function useLiveEvents(enabled: boolean) {
  const qc = useQueryClient();
  const push = useUI((s) => s.pushActivity);

  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = async () => {
      const token = await accessToken();
      if (!token || cancelled) return;
      es = new EventSource(`${API_URL}/api/events?access_token=${encodeURIComponent(token)}`);
      es.onmessage = (msg) => {
        const parsed = LiveEvent.safeParse(JSON.parse(msg.data));
        if (!parsed.success) return;
        const e = parsed.data;
        push(e);
        if (e.type.startsWith('run.')) qc.invalidateQueries({ queryKey: ['runs'] });
        if (e.type === 'persona.updated' || e.type === 'run.succeeded')
          qc.invalidateQueries({ queryKey: ['personas'] });
        if (e.type === 'archetype.updated') qc.invalidateQueries({ queryKey: ['archetypes'] });
        if (
          e.type === 'content.updated' ||
          e.type === 'publish.updated' ||
          e.type === 'media.created'
        )
          qc.invalidateQueries({ queryKey: ['content'] });
        if (e.type === 'media.created') qc.invalidateQueries({ queryKey: ['media'] });
        if (e.type === 'publish.updated') qc.invalidateQueries({ queryKey: ['publishing'] });
        qc.invalidateQueries({ queryKey: ['analytics'] });
      };
      es.onerror = () => {
        es?.close();
        if (!cancelled) retry = setTimeout(connect, 3000); // token may have refreshed
      };
    };
    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      es?.close();
    };
  }, [enabled, qc, push]);
}
