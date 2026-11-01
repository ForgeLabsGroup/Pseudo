'use client';
import type { ContentItem, Persona } from '@pseudo/shared';
import { Bookmark, Heart, MessageCircle, Music2, Repeat2, Send, Share } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PersonaAvatar } from '@/components/persona-avatar';
import { AiBadge, PlatformBadge, StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, timeAgo } from '@/lib/utils';

interface Who {
  name: string;
  handle: string;
  avatarUrl: string | null;
}

/** A content item rendered the way it would look on its platform. */
export function PostCard({
  item,
  persona,
  footer,
  className,
}: {
  item: ContentItem;
  persona: Persona | undefined;
  footer?: ReactNode;
  className?: string;
}) {
  const who: Who = {
    name: persona?.name ?? 'Persona',
    handle: persona?.handle ?? 'persona',
    avatarUrl: persona?.avatarUrl ?? null,
  };
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={item.platform} />
          <StatusBadge status={item.status} />
        </div>
        <span className="text-xs text-muted">{timeAgo(item.updatedAt)}</span>
      </div>
      <div className="p-4">
        <PostBody item={item} who={who} />
      </div>
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </Card>
  );
}

function PostBody({ item, who }: { item: ContentItem; who: Who }) {
  const body = item.body;
  if (!body) {
    if (item.status === 'failed')
      return <p className="text-sm text-danger">{item.error ?? 'Generation failed'}</p>;
    return <GeneratingSkeleton tall={item.contentType !== 'x_post'} />;
  }
  switch (body.type) {
    case 'instagram_post': {
      const image = item.media.find((m) => m.kind === 'image');
      return (
        <div className="overflow-hidden border border-border bg-black/30">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <PersonaAvatar url={who.avatarUrl} name={who.name} className="h-8 w-8" />
            <span className="text-sm font-semibold">{who.handle}</span>
          </div>
          <div className="relative aspect-square bg-surface-2">
            {image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={body.altText} className="h-full w-full object-cover" />
                <AiBadge className="absolute right-2 top-2" />
              </>
            ) : isRecent(item.updatedAt) ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <Skeleton className="absolute inset-0" />
                <span className="relative text-xs text-muted">Visual Agent is shooting this…</span>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted">
                No image yet. Regenerate to try again.
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 px-3 pt-3 text-fg">
            <Heart className="h-5 w-5" />
            <MessageCircle className="h-5 w-5" />
            <Send className="h-5 w-5" />
            <Bookmark className="ml-auto h-5 w-5" />
          </div>
          <div className="px-3 pb-3 pt-2 text-sm">
            <Caption>
              <span className="mr-1 font-semibold">{who.handle}</span>
              {body.caption}
            </Caption>
            <Hashtags tags={body.hashtags} />
          </div>
        </div>
      );
    }
    case 'x_post':
      return <Tweet who={who} text={body.text} />;
    case 'x_thread':
      return (
        <div>
          {body.posts.map((text, i) => (
            <Tweet
              key={i}
              who={who}
              text={text}
              threaded={i < body.posts.length - 1}
              index={`${i + 1}/${body.posts.length}`}
            />
          ))}
        </div>
      );
    case 'short_video': {
      const cover = item.media.find((m) => m.role === 'scene' && m.kind === 'image');
      const total = body.scenes.reduce((s, x) => s + x.durationSec, 0);
      return (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative mx-auto aspect-[9/16] w-40 shrink-0 overflow-hidden border border-border bg-surface-2">
            {cover && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover.url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                />
                <AiBadge className="absolute right-1.5 top-1.5 scale-90" />
              </>
            )}
            <div className="absolute inset-x-2 top-1/3 text-center text-sm font-bold leading-tight text-white drop-shadow">
              {body.hook}
            </div>
            <div className="absolute bottom-2 left-2 right-2 text-[10px] text-white/90">
              <div className="font-semibold">@{who.handle}</div>
              <div className="flex items-center gap-1 truncate">
                <Music2 className="h-3 w-3" /> original sound · {total}s
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold">{body.title}</div>
            <ol className="mt-2 space-y-2">
              {body.scenes.map((s, i) => (
                <li key={i} className="border border-border bg-surface p-2">
                  <div className="mono-label text-subtle">
                    Scene {i + 1} · {s.durationSec}s
                  </div>
                  <div className="font-medium">{s.onScreenText}</div>
                  <div className="text-muted">VO: {s.voiceover}</div>
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <Caption>{body.caption}</Caption>
              <Hashtags tags={body.hashtags} />
            </div>
          </div>
        </div>
      );
    }
  }
}

function Tweet({
  who,
  text,
  threaded,
  index,
}: {
  who: Who;
  text: string;
  threaded?: boolean;
  index?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <PersonaAvatar url={who.avatarUrl} name={who.name} />
        {threaded && <div className="my-1 w-0.5 flex-1 bg-border" />}
      </div>
      <div className={cn('min-w-0 flex-1', threaded && 'pb-4')}>
        <div className="flex items-center gap-1 text-sm">
          <span className="truncate font-semibold">{who.name}</span>
          <span className="truncate text-muted">@{who.handle}</span>
          {index && <span className="ml-auto text-xs text-muted">{index}</span>}
        </div>
        <p className="mt-0.5 whitespace-pre-line text-[15px] leading-snug">{text}</p>
        <div className="mt-2 flex max-w-xs justify-between text-muted">
          <MessageCircle className="h-4 w-4" />
          <Repeat2 className="h-4 w-4" />
          <Heart className="h-4 w-4" />
          <Share className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function Caption({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className={cn('whitespace-pre-line', !open && 'line-clamp-4')}>{children}</p>
      <button className="text-xs text-muted hover:text-fg" onClick={() => setOpen(!open)}>
        {open ? 'less' : 'more'}
      </button>
    </div>
  );
}

function Hashtags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <p className="mt-1 text-sm text-link">
      {tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}
    </p>
  );
}

/** Images land a little after the text; treat a missing image on a fresh item as still rendering. */
const isRecent = (iso: string) => Date.now() - new Date(iso).getTime() < 3 * 60_000;

function GeneratingSkeleton({ tall }: { tall: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-3 w-28" />
      </div>
      {tall && <Skeleton className="aspect-square w-full" />}
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <p className="text-xs text-muted">Agents are writing this…</p>
    </div>
  );
}
