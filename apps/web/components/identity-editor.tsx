'use client';
import { PLATFORM_LABELS, PLATFORMS, type PersonaIdentity } from '@pseudo/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ErrorText } from '@/components/error-text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';

const toLines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Edits never overwrite: the API saves a new persona version with the change note. */
export function IdentityEditor({
  personaId,
  identity,
  onDone,
}: {
  personaId: string;
  identity: PersonaIdentity;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<PersonaIdentity>(identity);
  const [note, setNote] = useState('');
  const set = <K extends keyof PersonaIdentity>(k: K, v: PersonaIdentity[K]) =>
    setD((x) => ({ ...x, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      api.personas.update(personaId, {
        identity: d,
        changeNote: note.trim() || 'Edited by user',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['personas'] });
      onDone();
    },
  });

  const text = (k: keyof PersonaIdentity & string, label: string, long = false) => (
    <Field label={label}>
      {long ? (
        <Textarea
          rows={4}
          value={d[k] as string}
          onChange={(e) => set(k, e.target.value as never)}
        />
      ) : (
        <Input value={d[k] as string} onChange={(e) => set(k, e.target.value as never)} />
      )}
    </Field>
  );

  const invalid = d.personalityTraits.length === 0 || d.contentPillars.length === 0 || !d.name;

  return (
    <Card>
      <CardContent className="space-y-6">
        <Group title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            {text('name', 'Name')}
            {text('handle', 'Handle')}
            {text('tagline', 'Tagline')}
            {text('ageRange', 'Age range')}
            {text('location', 'Location')}
            {text('occupation', 'Occupation')}
          </div>
          {text('biography', 'Biography', true)}
          {text('background', 'Backstory', true)}
          {text('lifestyle', 'Lifestyle')}
          <ListField label="Goals" value={d.goals} onChange={(v) => set('goals', v)} />
        </Group>

        <Group title="Personality & voice">
          <ListField
            label="Personality traits"
            value={d.personalityTraits}
            onChange={(v) => set('personalityTraits', v)}
          />
          <ListField label="Interests" value={d.interests} onChange={(v) => set('interests', v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            {text('communicationStyle', 'Communication style')}
            {text('writingTone', 'Writing tone')}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ListField
              label="Always do"
              value={d.writingStyleGuide.do}
              onChange={(v) => set('writingStyleGuide', { ...d.writingStyleGuide, do: v })}
            />
            <ListField
              label="Never do"
              value={d.writingStyleGuide.dont}
              onChange={(v) => set('writingStyleGuide', { ...d.writingStyleGuide, dont: v })}
            />
          </div>
          <ListField
            label="Signature phrases"
            value={d.writingStyleGuide.signaturePhrases}
            onChange={(v) =>
              set('writingStyleGuide', { ...d.writingStyleGuide, signaturePhrases: v })
            }
          />
          <Field label="Emoji usage">
            <Input
              value={d.writingStyleGuide.emojiUsage}
              onChange={(e) =>
                set('writingStyleGuide', { ...d.writingStyleGuide, emojiUsage: e.target.value })
              }
            />
          </Field>
        </Group>

        <Group title="Content pillars">
          <ListField
            label="One per line: Name: description"
            value={d.contentPillars.map((p) => `${p.name}: ${p.description}`)}
            onChange={(v) =>
              set(
                'contentPillars',
                v.map((line) => {
                  const [name, ...rest] = line.split(':');
                  return { name: name!.trim(), description: rest.join(':').trim() };
                }),
              )
            }
          />
        </Group>

        <Group title="Look">
          <Field label="Aesthetic">
            <Input
              value={d.visualIdentity.aesthetic}
              onChange={(e) =>
                set('visualIdentity', { ...d.visualIdentity, aesthetic: e.target.value })
              }
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Wardrobe">
              <Input
                value={d.visualIdentity.wardrobe}
                onChange={(e) =>
                  set('visualIdentity', { ...d.visualIdentity, wardrobe: e.target.value })
                }
              />
            </Field>
            <Field label="Photography style">
              <Input
                value={d.visualIdentity.photographyStyle}
                onChange={(e) =>
                  set('visualIdentity', { ...d.visualIdentity, photographyStyle: e.target.value })
                }
              />
            </Field>
            <ListField
              label="Palette"
              value={d.visualIdentity.palette}
              onChange={(v) => set('visualIdentity', { ...d.visualIdentity, palette: v })}
            />
            <ListField
              label="Recurring settings"
              value={d.visualIdentity.recurringSettings}
              onChange={(v) => set('visualIdentity', { ...d.visualIdentity, recurringSettings: v })}
            />
          </div>
        </Group>

        <Group title="Social bios">
          <div className="grid gap-4 sm:grid-cols-2">
            {PLATFORMS.map((p) => (
              <Field key={p} label={PLATFORM_LABELS[p]}>
                <Textarea
                  rows={3}
                  value={d.socialBios[p]}
                  onChange={(e) => set('socialBios', { ...d.socialBios, [p]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </Group>

        <div className="space-y-3 border-t border-border pt-5">
          <Field label="What changed? (saved with this version)">
            <Input
              placeholder="e.g. Made the voice more playful"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {invalid && (
            <p className="text-xs text-warning">
              Name, at least one trait and one pillar are required.
            </p>
          )}
          <ErrorText error={save.error} />
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending || invalid}>
              {save.isPending ? 'Saving…' : 'Save as new version'}
            </Button>
            <Button variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** One item per line. Keeps the raw text locally so blank lines can be typed. */
function ListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [raw, setRaw] = useState(value.join('\n'));
  return (
    <Field label={label}>
      <Textarea
        rows={Math.min(8, Math.max(3, value.length + 1))}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          onChange(toLines(e.target.value));
        }}
      />
    </Field>
  );
}
