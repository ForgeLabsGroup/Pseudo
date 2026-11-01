/**
 * Upserts archetypes + reference influencers from config/archetypes.json.
 *   pnpm --filter @pseudo/api seed:archetypes
 * Empty handles are ignored; influencers with no handles are skipped.
 */
import { readFileSync } from 'node:fs';
import { getAdminClient } from '@pseudo/database';
import { InfluencerHandles } from '@pseudo/shared';

const path = new URL('../../../../config/archetypes.json', import.meta.url);
const config = JSON.parse(readFileSync(path, 'utf8')) as {
  archetypes: {
    slug: string;
    name: string;
    description: string;
    guardrails: string[];
    influencers: { label: string; handles: Record<string, string> }[];
  }[];
};
const admin = getAdminClient();

for (const a of config.archetypes) {
  const { data: row, error } = await admin
    .from('archetypes')
    .upsert(
      { slug: a.slug, name: a.name, description: a.description, guardrails: a.guardrails },
      { onConflict: 'slug' },
    )
    .select('id')
    .single();
  if (error) throw error;
  let count = 0;
  for (const inf of a.influencers) {
    const handles = InfluencerHandles.parse(
      Object.fromEntries(
        Object.entries(inf.handles)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => [k, v.trim().replace(/^@/, '')]),
      ),
    );
    if (!Object.keys(handles).length) continue;
    const { error: e2 } = await admin
      .from('archetype_influencers')
      .upsert(
        { archetype_id: row.id, label: inf.label, handles },
        { onConflict: 'archetype_id,label' },
      );
    if (e2) throw e2;
    count++;
  }
  console.log(`${a.name}: ${count} influencer(s) with handles`);
}
