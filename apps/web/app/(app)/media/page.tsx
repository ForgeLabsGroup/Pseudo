'use client';
import type { MediaAsset, Persona } from '@pseudo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorText } from '@/components/error-text';
import { Lightbox, type LightboxImage } from '@/components/lightbox';
import { EmptyState, PageHeader } from '@/components/page-header';
import { DeleteMediaButton } from '@/components/persona-media';
import { AiBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';

type Kind = '' | 'image' | 'video' | 'audio';
type Source = 'all' | 'generated' | 'selfies';

/** Media Library: every photo, selfie, clip and voiceover, with favorite / avatar / delete. */
export default function MediaPage() {
  const [personaId, setPersonaId] = useState('');
  const [kind, setKind] = useState<Kind>('');
  const [source, setSource] = useState<Source>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const personas = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const query = { personaId: personaId || undefined, kind: kind || undefined };
  const { data, isLoading, error } = useQuery({
    queryKey: ['media', query],
    queryFn: () => api.media.list(query),
  });
  const personaById = new Map(personas.data?.personas.map((p) => [p.id, p]));
  const assets = (data?.assets ?? []).filter(
    (a) =>
      (source === 'all' || (source === 'selfies' ? !a.aiGenerated : a.aiGenerated)) &&
      (!favoritesOnly || a.isFavorite),
  );
  const filtered = !!personaId || !!kind || source !== 'all' || favoritesOnly;
  const photos = assets.filter((a) => a.kind === 'image');
  const lightboxImages: LightboxImage[] = photos.map((a) => {
    const persona = a.personaId ? personaById.get(a.personaId) : undefined;
    return {
      url: a.url,
      alt: a.prompt ?? undefined,
      aiGenerated: a.aiGenerated,
      caption: (
        <>
          {a.prompt && <p className="mx-auto mb-1 max-w-2xl text-white/90">{a.prompt}</p>}
          <p className="font-mono text-xs text-white/50">
            {persona?.name ?? 'No persona'} · {a.category} · {timeAgo(a.createdAt)}
          </p>
        </>
      ),
    };
  });

  return (
    <>
      <PageHeader
        title="Media Library"
        subtitle={
          data
            ? `${assets.length} of ${data.assets.length} items: photos, selfies, clips and voiceovers.`
            : 'Every photo, selfie, clip and voiceover.'
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select
          aria-label="Persona"
          className="w-auto"
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
        >
          <option value="">All personas</option>
          {personas.data?.personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.handle ? ` (@${p.handle})` : ''}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Type"
          className="w-auto"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
        >
          <option value="">All types</option>
          <option value="image">Photos</option>
          <option value="video">Clips</option>
          <option value="audio">Voiceovers</option>
        </Select>
        <div className="flex gap-1">
          {(['all', 'generated', 'selfies'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                'mono-label px-2.5 py-1',
                source === s ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFavoritesOnly((v) => !v)}
          className={cn(
            'mono-label flex items-center gap-1 px-2.5 py-1',
            favoritesOnly ? 'bg-surface-2 text-warning' : 'text-muted hover:text-fg',
          )}
        >
          <Star className={cn('h-3 w-3', favoritesOnly && 'fill-current')} /> Favorites
        </button>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPersonaId('');
              setKind('');
              setSource('all');
              setFavoritesOnly(false);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <ErrorText error={error} className="mb-4" />
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      )}
      {data && assets.length === 0 && (
        <EmptyState
          title={filtered ? 'Nothing matches these filters' : 'No media yet'}
          body={
            filtered
              ? 'Try another persona, type or source.'
              : 'Upload selfies and generate photos from a persona page.'
          }
          action={
            !filtered && (
              <Link href="/personas">
                <Button>Go to personas</Button>
              </Link>
            )
          }
        />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {assets.map((a) => (
          <Tile
            key={a.id}
            asset={a}
            persona={a.personaId ? personaById.get(a.personaId) : undefined}
            onOpen={() => setViewing(photos.indexOf(a))}
          />
        ))}
      </div>
      <Lightbox
        images={lightboxImages}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </>
  );
}

function Tile({
  asset,
  persona,
  onOpen,
}: {
  asset: MediaAsset;
  persona: Persona | undefined;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const favorite = useMutation({
    mutationFn: () => api.media.update(asset.id, { isFavorite: !asset.isFavorite }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['media'] }),
  });
  const avatar = useMutation({
    mutationFn: () => api.media.setAvatar(asset.id),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['personas'] }),
  });
  const isAvatar = !!persona && persona.avatarUrl === asset.url;
  const overlay =
    'bg-black/75 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-white';

  return (
    <figure className="min-w-0">
      <div className="group relative aspect-square overflow-hidden border border-border bg-surface-2">
        {asset.kind === 'image' && (
          <button onClick={onOpen} aria-label="View photo" className="h-full w-full cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url} alt={asset.prompt ?? ''} className="h-full w-full object-cover" />
          </button>
        )}
        {asset.kind === 'video' && (
          <video src={asset.url} controls className="h-full w-full object-cover" />
        )}
        {asset.kind === 'audio' && (
          <div className="flex h-full items-center px-3">
            <audio src={asset.url} controls className="w-full" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {asset.aiGenerated ? (
            <AiBadge />
          ) : (
            <Badge className="border-transparent bg-black/75 text-white">Selfie</Badge>
          )}
        </div>
        <DeleteMediaButton assetId={asset.id} />
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1">
          <button
            aria-label={asset.isFavorite ? 'Unfavorite' : 'Favorite'}
            onClick={() => favorite.mutate()}
            disabled={favorite.isPending}
            className={cn(
              overlay,
              asset.isFavorite
                ? 'text-warning'
                : 'opacity-0 group-hover:opacity-100 focus:opacity-100',
            )}
          >
            <Star className={cn('h-3 w-3', asset.isFavorite && 'fill-current')} />
          </button>
          {asset.kind === 'image' &&
            persona &&
            (isAvatar ? (
              <span className={cn(overlay, 'flex items-center gap-1 text-success')}>
                <Check className="h-3 w-3" /> Avatar
              </span>
            ) : (
              <button
                onClick={() => avatar.mutate()}
                disabled={avatar.isPending}
                className={cn(overlay, 'opacity-0 group-hover:opacity-100 focus:opacity-100')}
              >
                {avatar.isPending ? 'Setting…' : 'Set avatar'}
              </button>
            ))}
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open original"
            className={cn(overlay, 'ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100')}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
      <figcaption className="mt-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-muted" title={asset.prompt ?? undefined}>
          {persona ? (
            <Link href={`/personas/${persona.id}`} className="hover:text-fg">
              {persona.name}
            </Link>
          ) : (
            'No persona'
          )}
          {' · '}
          {asset.category}
        </span>
        <span className="shrink-0 font-mono text-subtle">{timeAgo(asset.createdAt)}</span>
      </figcaption>
      <ErrorText error={favorite.error ?? avatar.error} className="mt-1 text-xs" />
    </figure>
  );
}
