'use client';
import type { PersonaVersion } from '@pseudo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorText } from '@/components/error-text';
import { IdentityEditor } from '@/components/identity-editor';
import { IdentityView } from '@/components/identity-view';
import { EmptyState } from '@/components/page-header';
import { PersonaAvatar } from '@/components/persona-avatar';
import {
  GeneratePhotoCard,
  LikenessCard,
  PhotoGallery,
  usePersonaImages,
} from '@/components/persona-media';
import { RunProgress } from '@/components/run-progress';
import { Badge, PersonaStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';
import { timeAgo } from '@/lib/utils';

export default function PersonaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const setActivePersona = useUI((s) => s.setActivePersona);
  const [editing, setEditing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['personas', id],
    queryFn: () => api.personas.get(id),
  });
  const images = usePersonaImages(id);
  const runs = useQuery({
    queryKey: ['runs', { personaId: id }],
    queryFn: () => api.runs.list(id),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['personas'] });
  const activate = useMutation({
    mutationFn: () => api.personas.update(id, { identity: {}, status: 'active' }),
    onSuccess: invalidate,
  });
  const regenerate = useMutation({
    mutationFn: () => api.personas.generate(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['runs'] }),
  });

  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full max-w-xl" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (error || !data) return <ErrorText error={error ?? 'Persona not found'} />;

  const { persona, versions } = data;
  const identity = persona.identity;
  const personaRun = runs.data?.runs.find(
    (r) => r.agent === 'persona' && (r.status === 'running' || r.status === 'queued'),
  );
  const selfies = images.data?.assets.filter((a) => a.source === 'reference_upload').length ?? 0;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <PersonaAvatar
            url={persona.avatarUrl}
            name={persona.name}
            className="h-20 w-20 text-2xl"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{persona.name}</h1>
              <PersonaStatusBadge status={persona.status} />
              {persona.currentVersion > 0 && <Badge>v{persona.currentVersion}</Badge>}
            </div>
            {persona.handle && <div className="text-muted">@{persona.handle}</div>}
            {persona.tagline && <p className="mt-1 max-w-xl text-sm">{persona.tagline}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {identity && persona.status === 'draft' && (
            <Button
              variant="success"
              onClick={() => activate.mutate()}
              disabled={activate.isPending}
            >
              Activate
            </Button>
          )}
          {identity && !editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          {identity && (
            <Button
              onClick={() => {
                setActivePersona(persona.id);
                router.push('/studio');
              }}
            >
              <Sparkles className="h-4 w-4" /> Create content
            </Button>
          )}
        </div>
      </div>
      <ErrorText error={activate.error ?? regenerate.error} className="mb-4" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(personaRun || persona.status === 'generating') && (
            <Card>
              <CardHeader>
                <CardTitle>Persona Agent at work</CardTitle>
              </CardHeader>
              <CardContent>
                {personaRun ? (
                  <RunProgress runId={personaRun.id} />
                ) : (
                  <p className="text-sm text-muted">Starting…</p>
                )}
              </CardContent>
            </Card>
          )}
          {!identity && !personaRun && persona.status !== 'generating' && (
            <EmptyState
              title={persona.status === 'failed' ? 'Generation failed' : 'No identity yet'}
              body={persona.description}
              action={
                <Button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
                  <RefreshCw className="h-4 w-4" />
                  {persona.status === 'failed' ? 'Try again' : 'Generate identity'}
                </Button>
              }
            />
          )}
          {identity &&
            (editing ? (
              <IdentityEditor
                personaId={persona.id}
                identity={identity}
                onDone={() => setEditing(false)}
              />
            ) : (
              <IdentityView identity={identity} />
            ))}
        </div>

        <div className="space-y-6">
          <LikenessCard persona={persona} selfies={selfies} />
          <GeneratePhotoCard persona={persona} />
          <VersionsCard
            personaId={persona.id}
            current={persona.currentVersion}
            versions={versions}
          />
        </div>
      </div>

      <div className="mt-6">
        <PhotoGallery persona={persona} />
      </div>
    </>
  );
}

function VersionsCard({
  personaId,
  current,
  versions,
}: {
  personaId: string;
  current: number;
  versions: PersonaVersion[];
}) {
  const qc = useQueryClient();
  const restore = useMutation({
    mutationFn: (v: PersonaVersion) =>
      api.personas.update(personaId, {
        identity: v.identity,
        changeNote: `Restored version ${v.version}`,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['personas'] }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Versions</CardTitle>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="text-sm text-muted">No versions yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{v.version}</span>
                    {v.version === current && <Badge className="text-success">current</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {v.changeNote ?? 'No note'} · {timeAgo(v.createdAt)}
                  </div>
                </div>
                {v.version !== current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={restore.isPending}
                    onClick={() => restore.mutate(v)}
                  >
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <ErrorText error={restore.error} />
      </CardContent>
    </Card>
  );
}
