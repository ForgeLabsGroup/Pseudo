/**
 * Demo seed: creates (or reuses) the demo user and gives them Alex Sterling with a ready
 * identity, so the demo never depends on a live generation.
 *   pnpm --filter @pseudo/api seed
 * Env: DEMO_EMAIL, DEMO_PASSWORD (+ Supabase keys)
 */
import { ALEX_STERLING } from '@pseudo/ai';
import { getAdminClient } from '@pseudo/database';
import { PLATFORMS } from '@pseudo/shared';

const email = process.env.DEMO_EMAIL ?? 'demo@pseudo.app';
const password = process.env.DEMO_PASSWORD ?? 'pseudo-demo-2026';
const admin = getAdminClient();

const { data: list } = await admin.auth.admin.listUsers();
let user = list?.users.find((u) => u.email === email);
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Demo' },
  });
  if (error) throw error;
  user = data.user;
}
const userId = user!.id;

// Not maybeSingle(): mock-mode personas reuse Alex's handle, and maybeSingle() errors on >1 match,
// which used to read as "not found" and insert another Alex on every re-run.
const { data: matches, error: lookupError } = await admin
  .from('personas')
  .select('id')
  .eq('user_id', userId)
  .eq('handle', ALEX_STERLING.handle)
  .order('created_at')
  .limit(1);
if (lookupError) throw lookupError;
const existing = matches[0];
if (existing) {
  console.log(`Alex Sterling already exists (${existing.id}) for ${email}`);
} else {
  const { data: p, error } = await admin
    .from('personas')
    .insert({
      user_id: userId,
      name: ALEX_STERLING.name,
      handle: ALEX_STERLING.handle,
      tagline: ALEX_STERLING.tagline,
      description:
        'A Miami-based independent crypto trader and entrepreneur. Luxury cars, waterfront apartments, yachts, trading setups, fitness and nightlife. Confident, ambitious, disciplined, slightly provocative.',
      status: 'active',
      identity: ALEX_STERLING,
      current_version: 1,
    })
    .select('id')
    .single();
  if (error) throw error;
  await admin.from('persona_versions').insert({
    user_id: userId,
    persona_id: p.id,
    version: 1,
    identity: ALEX_STERLING,
    change_note: 'Seeded demo persona',
  });

  // Clearly-labelled SAMPLE analytics (is_sample = true) for the dashboard charts.
  const rows = [];
  for (let d = 13; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
    for (const platform of PLATFORMS) {
      const base = { instagram: 1800, tiktok: 3200, youtube_shorts: 900, x: 600 }[platform];
      const impressions = Math.round(base * (1 + (13 - d) * 0.08) * (0.8 + Math.random() * 0.4));
      rows.push({
        user_id: userId,
        persona_id: p.id,
        platform,
        is_sample: true,
        captured_on: date,
        impressions,
        likes: Math.round(impressions * 0.06),
      });
    }
  }
  await admin.from('analytics_snapshots').insert(rows);
  console.log(`Seeded Alex Sterling (${p.id}) for ${email}`);
}
console.log(`Demo login: ${email} / ${password}`);
