/**
 * Re-runs archetype research and saves a fresh playbook, same code path as
 * POST /api/archetypes/:id/research but without needing a logged-in user.
 *   pnpm --filter @pseudo/api research:run --archetype trader   (or --archetype all)
 * Uses whatever RESEARCH_SOURCE / RESEARCH_WATCHER / AI_TEXT_PROVIDER are set.
 */
import { parseArgs } from 'node:util';
import { getAdminClient } from '@pseudo/database';
import { ensurePlaybook } from '../jobs/research';
import type { RunCtx } from '../lib/runs';

const { values } = parseArgs({ options: { archetype: { type: 'string', default: 'all' } } });
const admin = getAdminClient();

let query = admin.from('archetypes').select('id, slug').order('slug');
if (values.archetype !== 'all') query = query.eq('slug', values.archetype!);
const { data: archetypes, error } = await query;
if (error) throw error;
if (!archetypes?.length) throw new Error(`No archetype "${values.archetype}" (run seed:archetypes)`);

let failed = 0;
for (const a of archetypes) {
  console.log(`\n== ${a.slug}`);
  const ctx: RunCtx = {
    runId: 'cli',
    userId: 'cli',
    agent: 'research',
    progress: async (step, message) => console.log(`  [${step}] ${message}`),
  };
  try {
    const pb = await ensurePlaybook(ctx, a.id, { force: true });
    console.log(`  ✓ ${pb.summary.slice(0, 160)}…`);
    console.log(`  hooks ${pb.hookFormulas.length} | x patterns ${pb.xPostPatterns.length} | don't ${pb.dontList.length}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${(err as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
