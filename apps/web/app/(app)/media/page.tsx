'use client';
import type { MediaAsset } from '@pseudo/shared';
import { useQuery } from '@tanstack/react-query';
import { ErrorText } from '@/components/error-text';
import { EmptyState, PageHeader } from '@/components/page-header';
import { DeleteMediaButton } from '@/components/persona-media';
import { AiBadge, Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

/**
 * Media Library — Owner: Person C
 * Lists every asset with delete. Still to come: filters, favorites, set avatar, generate images.
 * See docs/IMPLEMENTATION_PLAN.md for acceptance criteria.
 */
export default function Page() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['media', {}],
    queryFn: () => api.media.list(),
  });

  return (
    <>
      <PageHeader title="Media Library" subtitle="Every photo, selfie, video and voiceover." />
      <ErrorText error={error} />
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      )}
      {data?.assets.length === 0 && (
        <EmptyState title="No media yet" body="Generated photos and uploaded selfies land here." />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data?.assets.map((a) => (
          <Tile key={a.id} asset={a} />
        ))}
      </div>
    </>
  );
}

function Tile({ asset }: { asset: MediaAsset }) {
  return (
    <div className="group relative aspect-square overflow-hidden border border-border bg-surface-2">
      {asset.kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt={asset.prompt ?? ''} className="h-full w-full object-cover" />
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
      <Badge className="absolute bottom-2 left-2 border-transparent bg-black/75 text-white">
        {asset.category}
      </Badge>
      <DeleteMediaButton assetId={asset.id} />
    </div>
  );
}
