'use client';
import { PLATFORM_LABELS, type ContentItem, type Persona, type Platform } from '@pseudo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Film, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ContentActions } from '@/components/content-actions';
import { ErrorText } from '@/components/error-text';
import { EmptyState, PageHeader } from '@/components/page-header';
import { RunProgress } from '@/components/run-progress';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoPreview } from '@/components/video-preview';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';

const VIDEO_PLATFORMS: Platform[] = ['tiktok', 'youtube_shorts'];

/**
 * Video Studio: write short_video scripts (text provider, e.g. Featherless) and turn them into
 * playable 9:16 videos. Build = one photo per scene -> Higgsfield clip per scene (when enabled)
 * -> voiceover.
 */
export default function VideoStudio() {
  const [personaId, setPersonaId] = useState('');
  const personas = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const content = useQuery({
    queryKey: ['content', { personaId: personaId || undefined, limit: 200 }],
    queryFn: () => api.content.list({ personaId: personaId || undefined, limit: 200 }),
  });
  const usage = useQuery({ queryKey: ['usage', 'higgsfield'], queryFn: api.usage.higgsfield });
  const personaById = new Map(personas.data?.personas.map((p) => [p.id, p]));
  const scripts = content.data?.items.filter((i) => i.contentType === 'short_video') ?? [];
  const higgsfieldClips = usage.data?.routes.video ?? false;

  return (
    <>
      <PageHeader
        title="Video Studio"
        subtitle="Write a video script, then turn it into a vertical video of you, scene by scene."
      />

      <ScriptWriter personas={personas.data?.personas ?? []} defaultPersonaId={personaId} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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
        {usage.data && (
          <p className="text-sm text-muted">
            {higgsfieldClips ? (
              <>
                Scene clips are made with <span className="text-fg">Higgsfield</span> and use
                credits.{' '}
              </>
            ) : (
              'Scene clips are off, so each still is animated in the player at no cost. '
            )}
            <Link href="/settings" className="text-link hover:underline">
              See usage
            </Link>
          </p>
        )}
      </div>

      <ErrorText error={content.error} className="mb-4" />
      {content.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      )}
      {content.data && scripts.length === 0 && (
        <EmptyState
          title="No video scripts yet"
          body="Write one above. The script shows up here, ready to build."
        />
      )}
      <div className="space-y-4">
        {scripts.map((item) => (
          <VideoRow
            key={item.id}
            item={item}
            persona={personaById.get(item.personaId)}
            higgsfieldClips={higgsfieldClips}
          />
        ))}
      </div>
    </>
  );
}

/** Writes short_video scripts with the persona's voice; new scripts land in the list below via SSE. */
function ScriptWriter({
  personas,
  defaultPersonaId,
}: {
  personas: Persona[];
  defaultPersonaId: string;
}) {
  const ready = personas.filter((p) => p.identity);
  const [chosenId, setChosenId] = useState('');
  const pick = [chosenId, defaultPersonaId].find((id) => ready.some((p) => p.id === id));
  const personaId = pick ?? ready[0]?.id;
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [topic, setTopic] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const write = useMutation({
    mutationFn: () =>
      api.content.generate({
        personaId: personaId!,
        platform,
        contentType: 'short_video',
        topic: topic.trim() || undefined,
        count: 1,
        withImage: false,
      }),
    onSuccess: ({ runId }) => setRunId(runId),
  });

  if (personas.length > 0 && ready.length === 0)
    return (
      <Card className="mb-6">
        <CardContent className="text-sm text-muted">
          Your persona's identity is still being generated. Once it's ready you can write scripts
          here.
        </CardContent>
      </Card>
    );
  if (!personaId) return null;

  return (
    <Card className="mb-6">
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <Label htmlFor="script-topic">What's the video about? (optional)</Label>
            <Input
              id="script-topic"
              maxLength={500}
              placeholder="e.g. the trade I almost didn't take"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div>
            <Label>Platform</Label>
            <div className="flex gap-2">
              {VIDEO_PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={cn(
                    'h-10 border px-3 text-sm transition-colors',
                    platform === p
                      ? 'border-fg bg-surface-2 text-fg'
                      : 'border-border-strong text-muted hover:border-subtle hover:text-fg',
                  )}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {ready.length > 1 && (
            <Select
              aria-label="Persona for the script"
              className="w-auto"
              value={personaId}
              onChange={(e) => setChosenId(e.target.value)}
            >
              {ready.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Button onClick={() => write.mutate()} disabled={write.isPending}>
            {write.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Write a script
          </Button>
        </div>
        <ErrorText error={write.error} />
        {runId && <RunProgress runId={runId} />}
      </CardContent>
    </Card>
  );
}

function VideoRow({
  item,
  persona,
  higgsfieldClips,
}: {
  item: ContentItem;
  persona: Persona | undefined;
  higgsfieldClips: boolean;
}) {
  const qc = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [withVoiceover, setWithVoiceover] = useState(true);
  const build = useMutation({
    mutationFn: () => api.media.generateVideo({ contentId: item.id, withVoiceover }),
    onSuccess: ({ runId }) => {
      setRunId(runId);
      void qc.invalidateQueries({ queryKey: ['content'] });
    },
  });
  if (item.body?.type !== 'short_video') return null;
  const body = item.body;
  const built = item.media.some((m) => m.role === 'scene');
  const clips = item.media.filter((m) => m.role === 'scene_clip').length;
  const hasVoice = item.media.some((m) => m.role === 'voiceover');
  const seconds = body.scenes.reduce((s, sc) => s + sc.durationSec, 0);
  const building = item.status === 'generating' || build.isPending;

  return (
    <Card>
      <CardContent className="grid gap-6 p-5 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[240px]">
          {built && !building ? (
            <VideoPreview item={item} handle={persona?.handle ?? 'you'} />
          ) : (
            <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 border border-dashed border-border-strong bg-surface text-center text-sm text-muted">
              {building ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-link" /> Building…
                </>
              ) : (
                <>
                  <Film className="h-5 w-5" /> Not built yet
                </>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.status} />
              <Badge>{PLATFORM_LABELS[item.platform]}</Badge>
              <span className="font-mono text-xs text-subtle">{timeAgo(item.createdAt)}</span>
            </div>
            <h2 className="mt-2 text-lg">{body.title}</h2>
            <p className="text-sm text-muted">
              {persona?.name ?? 'Persona'} · {body.scenes.length} scenes · {seconds}s
              {built && !building && (
                <>
                  {' '}
                  · {clips > 0 ? `${clips} moving clips` : 'animated stills'}
                  {hasVoice ? ' · voiceover' : ' · no voiceover'}
                </>
              )}
            </p>
          </div>

          <ol className="space-y-1.5 text-sm">
            {body.scenes.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-14 shrink-0 whitespace-nowrap font-mono text-xs text-subtle">
                  {i + 1} · {s.durationSec}s
                </span>
                <span className="min-w-0">
                  <span className="text-fg">{s.onScreenText || s.visual}</span>
                  <span className="block truncate text-xs text-muted">“{s.voiceover}”</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => build.mutate()} disabled={building}>
                {building ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : built ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Clapperboard className="h-4 w-4" />
                )}
                {building ? 'Building…' : built ? 'Rebuild video' : 'Build video'}
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={withVoiceover}
                  onChange={(e) => setWithVoiceover(e.target.checked)}
                  disabled={building}
                />
                Voiceover
              </label>
            </div>
            {!building && (
              <p className="text-xs text-muted">
                {higgsfieldClips
                  ? `Requests ${body.scenes.length} Higgsfield clips (${seconds}s of video) plus ${body.scenes.length} photos.`
                  : `Makes ${body.scenes.length} photos of you; the player animates them.`}
                {built && ' Rebuilding replaces the current video.'}
              </p>
            )}
            <ErrorText error={build.error} />
            {runId && <RunProgress runId={runId} />}
            {item.error && !building && <p className="text-xs text-danger">{item.error}</p>}
          </div>

          <ContentActions item={item} />
        </div>
      </CardContent>
    </Card>
  );
}
