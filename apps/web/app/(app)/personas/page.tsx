'use client';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ErrorText } from '@/components/error-text';
import { EmptyState, PageHeader } from '@/components/page-header';
import { PersonaAvatar } from '@/components/persona-avatar';
import { Badge, PersonaStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';
import { cn } from '@/lib/utils';

/** Persona Studio: every alter ego the user has. */
export default function PersonasPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['personas'],
    queryFn: api.personas.list,
  });
  const activeId = useUI((s) => s.activePersonaId);

  return (
    <>
      <PageHeader
        title="Persona Studio"
        subtitle="Your alter egos. Same face, different life."
        actions={
          <Link href="/personas/new">
            <Button>
              <Plus className="h-4 w-4" /> New persona
            </Button>
          </Link>
        }
      />
      <ErrorText error={error} />
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}
      {data && data.personas.length === 0 && (
        <EmptyState
          title="No alter egos yet"
          body="Pick an archetype, describe who you want to be, and add a few selfies."
          action={
            <Link href="/personas/new">
              <Button>Create your first persona</Button>
            </Link>
          }
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.personas.map((p) => (
          <Link key={p.id} href={`/personas/${p.id}`}>
            <Card
              className={cn(
                'h-full p-5 transition-colors hover:border-border-strong hover:bg-surface',
                p.id === activeId && 'border-subtle',
              )}
            >
              <div className="flex items-center gap-3">
                <PersonaAvatar url={p.avatarUrl} name={p.name} className="h-14 w-14 text-lg" />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="truncate text-sm text-muted">
                    {p.handle ? `@${p.handle}` : 'Identity pending'}
                  </div>
                </div>
              </div>
              {p.tagline && <p className="mt-4 line-clamp-2 text-sm text-muted">{p.tagline}</p>}
              <div className="mt-4 flex items-center gap-2">
                <PersonaStatusBadge status={p.status} />
                {p.characterRefs.higgsfield?.status === 'ready' && (
                  <Badge className="text-fg">Likeness locked</Badge>
                )}
                {p.id === activeId && (
                  <Badge className="border-link/40 text-link">Active in studio</Badge>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
