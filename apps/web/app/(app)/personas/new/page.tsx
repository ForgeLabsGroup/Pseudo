'use client';
import type { PersonaBasics } from '@pseudo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorText } from '@/components/error-text';
import { PageHeader } from '@/components/page-header';
import { RunProgress, useRun } from '@/components/run-progress';
import {
  SELFIE_MAX,
  SELFIE_MIN,
  SelfieDropzone,
  type UploadState,
} from '@/components/selfie-dropzone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';
import { cn } from '@/lib/utils';

const STEPS = ['Archetype', 'Basics', 'Description', 'Selfies'];
type Basics = Required<{ [K in keyof PersonaBasics]: string }>;
const BASIC_FIELDS: { key: keyof Basics; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Name', placeholder: 'Alex Sterling' },
  { key: 'handle', label: 'Handle (optional)', placeholder: 'alexsterling' },
  { key: 'ageRange', label: 'Age (optional)', placeholder: '28' },
  { key: 'location', label: 'Location (optional)', placeholder: 'Miami, Florida' },
  { key: 'occupation', label: 'Occupation (optional)', placeholder: 'Independent trader' },
];
const DESC_MIN = 10;
const DESC_MAX = 2000;

/** New persona: archetype -> basics -> description -> selfies -> create (agent runs) -> persona page. */
export default function NewPersonaPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const setActivePersona = useUI((s) => s.setActivePersona);
  const [step, setStep] = useState(0);
  const [archetypeId, setArchetypeId] = useState<string | null>(null);
  const [basics, setBasics] = useState<Basics>({
    name: '',
    handle: '',
    ageRange: '',
    location: '',
    occupation: '',
  });
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [created, setCreated] = useState<{ id: string; runId: string | null } | null>(null);

  const archetypes = useQuery({ queryKey: ['archetypes'], queryFn: api.archetypes.list });
  const run = useRun(created?.runId);

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.personas.create({
        description: description.trim(),
        // Blank optional fields are left for the Persona Agent to invent.
        basics: Object.fromEntries(
          Object.entries(basics)
            .map(([k, v]) => [k, k === 'handle' ? v.trim().replace(/^@/, '') : v.trim()])
            .filter(([, v]) => v),
        ),
        archetypeId: archetypeId ?? undefined,
      });
      setCreated({ id: res.persona.id, runId: res.runId });
      setActivePersona(res.persona.id);
      // The Persona Agent doesn't need the selfies, so upload while it writes the identity.
      setUploads(files.map(() => 'uploading'));
      await Promise.all(
        files.map(async (file, i) => {
          let state: UploadState = 'done';
          try {
            await api.personas.uploadReference(res.persona.id, file);
          } catch {
            state = 'error';
          }
          setUploads((u) => u.map((s, j) => (j === i ? state : s)));
        }),
      );
      void qc.invalidateQueries({ queryKey: ['media'] });
    },
  });

  const retry = useMutation({
    mutationFn: () => api.personas.generate(created!.id),
    onSuccess: ({ runId }) => setCreated((c) => c && { ...c, runId }),
  });

  const uploadsDone = uploads.length > 0 && uploads.every((s) => s !== 'uploading');
  const uploadErrors = uploads.filter((s) => s === 'error').length;
  const runStatus = run.data?.run.status;

  useEffect(() => {
    if (created && runStatus === 'succeeded' && uploadsDone && uploadErrors === 0)
      router.push(`/personas/${created.id}`);
  }, [created, runStatus, uploadsDone, uploadErrors, router]);

  const canNext =
    step === 0 ||
    (step === 1 && basics.name.trim().length > 0) ||
    (step === 2 && description.trim().length >= DESC_MIN) ||
    (step === 3 && files.length >= SELFIE_MIN && files.length <= SELFIE_MAX);

  if (created)
    return (
      <>
        <PageHeader
          title="Bringing your alter ego to life"
          subtitle="The Persona Agent is writing an identity, voice and backstory."
        />
        <Card className="max-w-2xl">
          <CardContent className="space-y-6">
            {created.runId && <RunProgress runId={created.runId} />}
            <div className="text-sm text-muted">
              Selfies: {uploads.filter((s) => s === 'done').length}/{uploads.length} uploaded
              {uploadErrors > 0 && <span className="text-danger"> · {uploadErrors} failed</span>}
            </div>
            <ErrorText error={create.error ?? retry.error} />
            {runStatus === 'failed' && (
              <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
                Try again
              </Button>
            )}
            {((runStatus === 'succeeded' && uploadErrors > 0) || !created.runId) && (
              <Button onClick={() => router.push(`/personas/${created.id}`)}>
                Open persona <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </>
    );

  return (
    <>
      <PageHeader title="New alter ego" subtitle="Who do you want to become?" />
      <ol className="mb-6 flex max-w-2xl gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              'mono-label flex-1 border-t-2 pt-2',
              i <= step ? 'border-fg text-fg' : 'border-border text-subtle',
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <Card className="max-w-2xl">
        <CardContent className="space-y-5">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {archetypes.isLoading &&
                Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
              {archetypes.data?.archetypes.map((a) => (
                <ChoiceCard
                  key={a.id}
                  active={archetypeId === a.id}
                  onClick={() => setArchetypeId(a.id)}
                  title={a.name}
                  body={a.description}
                  badge={a.playbookUpdatedAt ? 'Researched' : undefined}
                />
              ))}
              <ChoiceCard
                active={archetypeId === null}
                onClick={() => setArchetypeId(null)}
                title="Something else"
                body="No archetype. The agent works only from your description."
              />
              <ErrorText error={archetypes.error} />
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {BASIC_FIELDS.map((f, i) => (
                <div key={f.key} className={i === 0 ? 'sm:col-span-2' : undefined}>
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    maxLength={100}
                    autoFocus={i === 0}
                    placeholder={f.placeholder}
                    value={basics[f.key]}
                    onChange={(e) => setBasics((b) => ({ ...b, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <p className="text-xs text-muted sm:col-span-2">
                These are used exactly as typed. Leave a field blank and the Persona Agent fills it
                in. Everything stays editable on the persona page.
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <Label htmlFor="desc">Describe your alter ego</Label>
              <Textarea
                id="desc"
                rows={6}
                maxLength={DESC_MAX}
                autoFocus
                placeholder="A Miami-based independent trader. Waterfront apartment, early gym sessions, disciplined, a little provocative…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="mt-1 text-right text-xs text-muted">
                {description.trim().length < DESC_MIN
                  ? `${DESC_MIN - description.trim().length} more characters`
                  : `${description.length}/${DESC_MAX}`}
              </div>
            </div>
          )}

          {step === 3 && <SelfieDropzone files={files} onChange={setFiles} />}

          <ErrorText error={create.error} />
          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              className={step === 0 ? 'invisible' : ''}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => create.mutate()} disabled={!canNext || create.isPending}>
                <Sparkles className="h-4 w-4" /> Create my alter ego
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  body,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border p-4 text-left transition-colors',
        active
          ? 'border-fg bg-surface-2'
          : 'border-border hover:border-border-strong hover:bg-surface',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        {badge && <Badge>{badge}</Badge>}
      </div>
      <p className="mt-1 line-clamp-3 text-sm text-muted">{body}</p>
    </button>
  );
}
