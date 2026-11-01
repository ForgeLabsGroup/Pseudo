'use client';
import {
  PLATFORM_CONTENT_TYPES,
  PLATFORM_LABELS,
  PLATFORMS,
  type ContentType,
  type Platform,
} from '@pseudo/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorText } from '@/components/error-text';
import { EmptyState, PageHeader } from '@/components/page-header';
import { PostCard } from '@/components/post-card';
import { StageStepper, type Stage } from '@/components/run-progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<ContentType, string> = {
  instagram_post: 'Post',
  x_post: 'Single post',
  x_thread: 'Thread',
  short_video: 'Video script',
};

/** Maps backend progress steps (agents, research, image job) onto the four visible stages. */
const STAGES: Stage[] = [
  { label: 'Research', steps: ['research', 'fetch', 'watch', 'fetch_failed'] },
  { label: 'Ideas', steps: ['plan'] },
  { label: 'Writing', steps: ['write', 'finalize'] },
  { label: 'Visual', steps: ['prompt', 'render', 'image_failed'] },
];

const TONES = ['Confident', 'Playful', 'Motivational', 'Behind the scenes', 'Contrarian'];

/** Proof of Life: generate a batch of posts in the persona's voice and watch the agents work. */
export default function StudioPage() {
  const activePersonaId = useUI((s) => s.activePersonaId);
  const setActivePersona = useUI((s) => s.setActivePersona);
  const personas = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const ready = personas.data?.personas.filter((p) => p.identity) ?? [];
  const personaId = ready.some((p) => p.id === activePersonaId) ? activePersonaId! : ready[0]?.id;

  const [platform, setPlatform] = useState<Platform>('instagram');
  const [contentType, setContentType] = useState<ContentType>('instagram_post');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('');
  const [count, setCount] = useState(3);
  const [withImage, setWithImage] = useState(true);
  const [batch, setBatch] = useState<{
    runId: string;
    contentIds: string[];
    personaId: string;
  } | null>(null);
  const batchPersona = ready.find((p) => p.id === batch?.personaId);

  const content = useQuery({
    queryKey: ['content', { personaId: batch?.personaId }],
    queryFn: () => api.content.list({ personaId: batch!.personaId }),
    enabled: !!batch,
  });
  const items = batch
    ? batch.contentIds
        .map((id) => content.data?.items.find((i) => i.id === id))
        .filter((i) => i !== undefined)
    : [];

  const generate = useMutation({
    mutationFn: () =>
      api.content.generate({
        personaId: personaId!,
        platform,
        contentType,
        topic: topic.trim() || undefined,
        tone: tone.trim() || undefined,
        count,
        withImage: platform === 'instagram' && withImage,
      }),
    onSuccess: (res) => setBatch({ ...res, personaId: personaId! }),
  });

  const pickPlatform = (p: Platform) => {
    setPlatform(p);
    setContentType(PLATFORM_CONTENT_TYPES[p][0]!);
  };

  if (personas.isLoading) return <Skeleton className="h-96 w-full" />;
  if (ready.length === 0)
    return (
      <>
        <PageHeader title="Proof of Life" subtitle="Make your alter ego post." />
        <EmptyState
          title="No persona with an identity yet"
          body="Create a persona first. Once its identity is generated you can make content here."
          action={
            <Link href="/personas/new">
              <Button>Create a persona</Button>
            </Link>
          }
        />
      </>
    );

  return (
    <>
      <PageHeader
        title="Proof of Life"
        subtitle="Tell your alter ego what to post. The agents research, plan, write and shoot it."
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="persona">Persona</Label>
              <Select
                id="persona"
                value={personaId}
                onChange={(e) => setActivePersona(e.target.value)}
              >
                {ready.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.handle ? ` (@${p.handle})` : ''}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Platform</Label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <Pill key={p} active={platform === p} onClick={() => pickPlatform(p)}>
                    {PLATFORM_LABELS[p]}
                  </Pill>
                ))}
              </div>
            </div>

            {PLATFORM_CONTENT_TYPES[platform].length > 1 && (
              <div>
                <Label>Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORM_CONTENT_TYPES[platform].map((t) => (
                    <Pill key={t} active={contentType === t} onClick={() => setContentType(t)}>
                      {TYPE_LABELS[t]}
                    </Pill>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="topic">Topic (optional)</Label>
              <Input
                id="topic"
                maxLength={500}
                placeholder="e.g. my 5am routine before market open"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="tone">Tone (optional)</Label>
              <Input
                id="tone"
                maxLength={100}
                placeholder="Use the persona's default voice"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:text-fg"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="w-28">
                <Label htmlFor="count">How many</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={7}
                  value={count}
                  onChange={(e) => setCount(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
              {platform === 'instagram' && (
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={withImage}
                    onChange={(e) => setWithImage(e.target.checked)}
                    className="accent-accent"
                  />
                  Shoot a photo for each post
                </label>
              )}
            </div>

            <ErrorText error={generate.error} />
            <Button
              size="lg"
              className="w-full"
              onClick={() => generate.mutate()}
              disabled={generate.isPending || !personaId}
            >
              <Sparkles className="h-4 w-4" /> Generate {count} {count === 1 ? 'piece' : 'pieces'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-3">
          {batch ? (
            <>
              <Card>
                <CardContent>
                  <StageStepper runId={batch.runId} stages={STAGES} />
                </CardContent>
              </Card>
              <div className="grid gap-4 xl:grid-cols-2">
                {items.length === 0 &&
                  batch.contentIds.map((id) => <Skeleton key={id} className="h-80 rounded-2xl" />)}
                {items.map((item) => (
                  <PostCard key={item.id} item={item} persona={batchPersona} />
                ))}
              </div>
              {items.some((i) => i.status === 'awaiting_approval') && (
                <Link
                  href={`/content?personaId=${batch.personaId}&status=awaiting_approval`}
                  className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                >
                  Review and approve in Content Studio <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </>
          ) : (
            <EmptyState
              title="Nothing generated yet"
              body="Pick a platform and hit generate. You'll see each agent step happen live."
            />
          )}
        </div>
      </div>
    </>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 rounded-lg border text-sm transition',
        active ? 'border-accent bg-accent/10 text-fg' : 'border-border text-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
