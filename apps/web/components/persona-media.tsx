'use client';
import {
  MEDIA_CATEGORIES,
  type MediaAsset,
  type MediaCategory,
  type Persona,
} from '@pseudo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, ImagePlus, Loader2, ShieldCheck, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorText } from '@/components/error-text';
import { RunProgress } from '@/components/run-progress';
import { AiBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';

export function usePersonaImages(personaId: string) {
  return useQuery({
    queryKey: ['media', { personaId, kind: 'image' }],
    queryFn: () => api.media.list({ personaId, kind: 'image' }),
  });
}

/** Two-step delete overlay for a media tile: first click arms it, second click deletes. */
export function DeleteMediaButton({ assetId }: { assetId: string }) {
  const qc = useQueryClient();
  const [armed, setArmed] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.media.remove(assetId),
    onSettled: () => {
      // Avatar and content attachments can change too.
      for (const key of ['media', 'personas', 'content'])
        void qc.invalidateQueries({ queryKey: [key] });
    },
  });
  return (
    <div className="absolute right-2 top-2 flex gap-1">
      {armed && !remove.isPending && (
        <button
          onClick={() => setArmed(false)}
          className="bg-black/75 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-white"
        >
          Keep
        </button>
      )}
      <button
        aria-label={armed ? 'Confirm delete' : 'Delete'}
        title={remove.error ? String(remove.error.message) : undefined}
        disabled={remove.isPending}
        onClick={() => (armed ? remove.mutate() : setArmed(true))}
        className={cn(
          'flex items-center gap-1 bg-black/75 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-white transition',
          armed || remove.error
            ? 'text-danger'
            : 'opacity-0 group-hover:opacity-100 focus:opacity-100',
        )}
      >
        {remove.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
        {remove.error ? 'Retry' : armed ? 'Delete' : null}
      </button>
    </div>
  );
}

/** "Lock my likeness": trains the user's face at Higgsfield from their selfies. */
export function LikenessCard({ persona, selfies }: { persona: Persona; selfies: number }) {
  const qc = useQueryClient();
  const ref = persona.characterRefs.higgsfield;
  const [runId, setRunId] = useState<string | null>(null);
  const train = useMutation({
    mutationFn: () => api.personas.trainCharacter(persona.id),
    onSuccess: ({ runId }) => setRunId(runId),
  });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) await api.personas.uploadReference(persona.id, f);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['media'] });
      void qc.invalidateQueries({ queryKey: ['personas'] });
    },
  });
  const training = ref?.status === 'training' || train.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your likeness</CardTitle>
        <span className="text-xs text-muted">{selfies} selfie(s)</span>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {ref?.status === 'ready' ? (
          <p className="flex items-center gap-2 text-success">
            <ShieldCheck className="h-4 w-4" /> Likeness locked {timeAgo(ref.updatedAt)}
          </p>
        ) : training ? (
          <p className="flex items-center gap-2 text-link">
            <Loader2 className="h-4 w-4 animate-spin" /> Training your likeness…
          </p>
        ) : ref?.status === 'failed' ? (
          <p className="flex items-start gap-2 text-danger">
            <X className="mt-0.5 h-4 w-4 shrink-0" /> {ref.error ?? 'Training failed'}
          </p>
        ) : (
          <p className="text-muted">
            Train a model of your face so every photo of {persona.name} looks like you.
          </p>
        )}
        {runId && training && <RunProgress runId={runId} />}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => train.mutate()}
            disabled={training || selfies === 0}
            title={selfies === 0 ? 'Upload selfies first' : undefined}
          >
            {ref?.status === 'ready'
              ? 'Retrain'
              : ref?.status === 'failed'
                ? 'Try again'
                : 'Lock my likeness'}
          </Button>
          <label
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-2 px-3 font-mono text-[11px] uppercase tracking-[0.06em] text-muted hover:bg-surface-2 hover:text-fg [&_svg]:h-3.5 [&_svg]:w-3.5',
              upload.isPending && 'pointer-events-none opacity-50',
            )}
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            Add selfies
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) upload.mutate(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {selfies === 0 && <p className="text-xs text-warning">Add at least one selfie first.</p>}
        <p className="text-xs text-muted">
          Training runs on Higgsfield and uses your Higgsfield credits.{' '}
          <Link href="/settings" className="text-link hover:underline">
            See usage
          </Link>
        </p>
        <ErrorText error={train.error ?? upload.error} />
      </CardContent>
    </Card>
  );
}

const PHOTO_CATEGORIES = MEDIA_CATEGORIES.filter((c) => c !== 'reference');

export function GeneratePhotoCard({ persona }: { persona: Persona }) {
  const [category, setCategory] = useState<MediaCategory>('lifestyle');
  const [prompt, setPrompt] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const gen = useMutation({
    mutationFn: () =>
      api.media.generateImage({
        personaId: persona.id,
        category,
        prompt: prompt.trim() || undefined,
      }),
    onSuccess: ({ runId }) => setRunId(runId),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate photo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="cat">Scene type</Label>
          <Select
            id="cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as MediaCategory)}
          >
            {PHOTO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="prompt">Scene (optional)</Label>
          <Input
            id="prompt"
            maxLength={1000}
            placeholder="Sunset on a rooftop terrace, linen shirt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          onClick={() => gen.mutate()}
          disabled={gen.isPending || !persona.identity}
        >
          <Camera className="h-4 w-4" /> Generate photo
        </Button>
        {!persona.identity && (
          <p className="text-xs text-muted">Available once the identity is ready.</p>
        )}
        <ErrorText error={gen.error} />
        {runId && <RunProgress runId={runId} />}
      </CardContent>
    </Card>
  );
}

type GalleryFilter = 'all' | 'generated' | 'selfies';

export function PhotoGallery({ persona }: { persona: Persona }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = usePersonaImages(persona.id);
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const avatar = useMutation({
    mutationFn: (assetId: string) => api.media.setAvatar(assetId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['personas'] }),
  });
  const assets = (data?.assets ?? []).filter((a) =>
    filter === 'all' ? true : filter === 'selfies' ? !a.aiGenerated : a.aiGenerated,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
        <div className="flex gap-1">
          {(['all', 'generated', 'selfies'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'mono-label px-2.5 py-1',
                filter === f ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ErrorText error={error ?? avatar.error} />
        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        )}
        {data && assets.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            {filter === 'selfies' ? 'No selfies uploaded.' : 'No photos yet. Generate one above.'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <Photo
              key={a.id}
              asset={a}
              isAvatar={persona.avatarUrl === a.url}
              onSetAvatar={() => avatar.mutate(a.id)}
              busy={avatar.isPending && avatar.variables === a.id}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Photo({
  asset,
  isAvatar,
  onSetAvatar,
  busy,
}: {
  asset: MediaAsset;
  isAvatar: boolean;
  onSetAvatar: () => void;
  busy: boolean;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden border border-border bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.url} alt={asset.prompt ?? ''} className="h-full w-full object-cover" />
      <div className="absolute left-2 top-2 flex gap-1">
        {asset.aiGenerated ? (
          <AiBadge />
        ) : (
          <Badge className="border-transparent bg-black/75 text-white">Selfie</Badge>
        )}
      </div>
      <DeleteMediaButton assetId={asset.id} />
      {isAvatar ? (
        <Badge className="absolute bottom-2 left-2 border-transparent bg-black/75 text-success">
          <Check className="h-3 w-3" /> Avatar
        </Badge>
      ) : (
        <button
          onClick={onSetAvatar}
          disabled={busy}
          className="absolute bottom-2 left-2 bg-black/75 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        >
          {busy ? 'Setting…' : 'Set as avatar'}
        </button>
      )}
    </div>
  );
}
