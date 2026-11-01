import { PLATFORM_LABELS, PLATFORMS, type PersonaIdentity } from '@pseudo/shared';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">{children}</CardContent>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Chips({ items, className }: { items: string[]; className?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className={`rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs ${className ?? ''}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/** Read-only presentation of a persona's identity. */
export function IdentityView({ identity }: { identity: PersonaIdentity }) {
  const { writingStyleGuide: guide, visualIdentity: look } = identity;
  return (
    <div className="space-y-6">
      <Section title="Bio">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label="Age">{identity.ageRange}</Fact>
          <Fact label="Based in">{identity.location}</Fact>
          <Fact label="Does">{identity.occupation}</Fact>
          <Fact label="Lifestyle">{identity.lifestyle}</Fact>
        </div>
        <p className="whitespace-pre-line leading-relaxed">{identity.biography}</p>
        <Fact label="Backstory">
          <p className="text-muted">{identity.background}</p>
        </Fact>
        {identity.goals.length > 0 && (
          <Fact label="Goals">
            <ul className="list-disc space-y-0.5 pl-5 text-muted">
              {identity.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </Fact>
        )}
      </Section>

      <Section title="Personality & voice">
        <Fact label="Traits">
          <Chips items={identity.personalityTraits} className="text-accent" />
        </Fact>
        {identity.interests.length > 0 && (
          <Fact label="Interests">
            <Chips items={identity.interests} />
          </Fact>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Fact label="Communication style">{identity.communicationStyle}</Fact>
          <Fact label="Writing tone">{identity.writingTone}</Fact>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Fact label="Always">
            <ul className="space-y-1">
              {guide.do.map((d) => (
                <li key={d} className="text-success">
                  + <span className="text-fg">{d}</span>
                </li>
              ))}
            </ul>
          </Fact>
          <Fact label="Never">
            <ul className="space-y-1">
              {guide.dont.map((d) => (
                <li key={d} className="text-danger">
                  − <span className="text-fg">{d}</span>
                </li>
              ))}
            </ul>
          </Fact>
        </div>
        {guide.signaturePhrases.length > 0 && (
          <Fact label="Signature phrases">
            <Chips items={guide.signaturePhrases.map((p) => `“${p}”`)} />
          </Fact>
        )}
        <Fact label="Emoji usage">{guide.emojiUsage}</Fact>
      </Section>

      <Section title="Content pillars">
        <div className="grid gap-3 sm:grid-cols-2">
          {identity.contentPillars.map((p) => (
            <div key={p.name} className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="font-medium">{p.name}</div>
              <p className="mt-1 text-muted">{p.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Look">
        <Fact label="Aesthetic">{look.aesthetic}</Fact>
        {look.palette.length > 0 && (
          <Fact label="Palette">
            <div className="flex flex-wrap gap-3">
              {look.palette.map((c) => (
                <div key={c} className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className="h-5 w-5 rounded-full border border-border"
                    style={{ background: c }}
                  />
                  {c}
                </div>
              ))}
            </div>
          </Fact>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Fact label="Wardrobe">{look.wardrobe}</Fact>
          <Fact label="Photography">{look.photographyStyle}</Fact>
        </div>
        {look.recurringSettings.length > 0 && (
          <Fact label="Recurring settings">
            <Chips items={look.recurringSettings} />
          </Fact>
        )}
      </Section>

      <Section title="Social bios">
        <div className="grid gap-3 sm:grid-cols-2">
          {PLATFORMS.map((p) => (
            <div key={p} className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted">
                {PLATFORM_LABELS[p]}
              </div>
              <p className="mt-1 whitespace-pre-line">{identity.socialBios[p]}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
