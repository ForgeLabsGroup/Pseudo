/**
 * Prints generated content for a persona + archetype playbook so prompts can be tuned fast.
 * Nothing is written to the DB.
 *   pnpm --filter @pseudo/api content:sample                       (Alex Sterling + Trader playbook)
 *   pnpm --filter @pseudo/api content:sample --archetype fitness_coach --describe "A Leeds strength coach..."
 *   flags: --types instagram_post,x_post,x_thread,short_video  --count 1  --topic "..."
 * --describe runs the Persona Agent first (also tunes persona.ts); without it Alex Sterling is used.
 */
import { parseArgs } from 'node:util';
import { runContentAgent, runPersonaAgent } from '@pseudo/agents';
import { ALEX_STERLING } from '@pseudo/ai';
import { getAdminClient } from '@pseudo/database';
import { CONTENT_TYPES, type ContentType, type Platform } from '@pseudo/shared';
import { latestPlaybook } from '../jobs/research';

const { values } = parseArgs({
  options: {
    archetype: { type: 'string', default: 'trader' },
    describe: { type: 'string' },
    types: { type: 'string', default: CONTENT_TYPES.join(',') },
    count: { type: 'string', default: '1' },
    topic: { type: 'string' },
  },
});

const PLATFORM: Record<ContentType, Platform> = {
  instagram_post: 'instagram',
  x_post: 'x',
  x_thread: 'x',
  short_video: 'tiktok',
};

const { data: archetype } = await getAdminClient()
  .from('archetypes')
  .select('id, name')
  .eq('slug', values.archetype!)
  .single();
if (!archetype) throw new Error(`No archetype "${values.archetype}" (run seed:archetypes)`);
const playbook = (await latestPlaybook(archetype.id))?.playbook ?? null;
console.log(`${archetype.name} playbook: ${playbook ? playbook.summary.slice(0, 120) : 'NONE'}\n`);

const identity = values.describe
  ? (await runPersonaAgent({ description: values.describe, playbook: playbook ?? undefined })).identity
  : ALEX_STERLING;
if (values.describe) console.log('PERSONA', JSON.stringify(identity, null, 2), '\n');

for (const contentType of values.types!.split(',') as ContentType[]) {
  const bodies = await runContentAgent({
    identity,
    playbook,
    contentType,
    platform: PLATFORM[contentType],
    count: Number(values.count),
    topic: values.topic,
  });
  for (const b of bodies) console.log(`---- ${contentType}\n${JSON.stringify(b, null, 2)}\n`);
}
