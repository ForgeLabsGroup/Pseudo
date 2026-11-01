import { getAdminClient } from '@pseudo/database';
import { researchArchetype, type SourceVideo } from '@pseudo/research';
import { ArchetypePlaybook, VideoAnalysis } from '@pseudo/shared';
import { publish } from '../lib/bus';
import type { RunCtx } from '../lib/runs';

export const PLAYBOOK_MAX_AGE_HOURS = Number(process.env.PLAYBOOK_MAX_AGE_HOURS ?? 24);

/** Latest playbook for an archetype (any age), or null. */
export async function latestPlaybook(archetypeId: string) {
  const { data } = await getAdminClient()
    .from('archetype_playbooks')
    .select('playbook, created_at')
    .eq('archetype_id', archetypeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? { playbook: ArchetypePlaybook.parse(data.playbook), createdAt: data.created_at as string }
    : null;
}

/**
 * Research step of the Content agent. Returns a fresh-enough playbook, running research only when
 * the cached one is missing or older than PLAYBOOK_MAX_AGE_HOURS (or force=true).
 * Never blocks generation on a research failure if an older playbook exists.
 */
export async function ensurePlaybook(
  ctx: RunCtx,
  archetypeId: string,
  opts: { force?: boolean } = {},
) {
  const cached = await latestPlaybook(archetypeId);
  const fresh =
    cached &&
    Date.now() - new Date(cached.createdAt).getTime() < PLAYBOOK_MAX_AGE_HOURS * 3_600_000;
  if (cached && fresh && !opts.force) {
    await ctx.progress('research', 'Using cached archetype research');
    return cached.playbook;
  }
  try {
    return await runResearch(ctx, archetypeId);
  } catch (err) {
    if (cached) {
      await ctx.progress(
        'research',
        `Research failed (${(err as Error).message}); using previous playbook`,
      );
      return cached.playbook;
    }
    throw err;
  }
}

async function runResearch(ctx: RunCtx, archetypeId: string) {
  const admin = getAdminClient();
  const { data: archetype, error } = await admin
    .from('archetypes')
    .select('*')
    .eq('id', archetypeId)
    .single();
  if (error) throw new Error(error.message);
  const { data: influencers } = await admin
    .from('archetype_influencers')
    .select('*')
    .eq('archetype_id', archetypeId);
  if (!influencers?.length)
    throw new Error(`No reference influencers configured for ${archetype.name}`);

  await ctx.progress('research', `Researching ${influencers.length} ${archetype.name} creators`);
  const { playbook, sourceCount } = await researchArchetype(
    {
      name: archetype.name,
      description: archetype.description,
      guardrails: archetype.guardrails ?? [],
    },
    influencers.map((i) => ({ id: i.id, label: i.label, handles: i.handles })),
    {
      videosPerInfluencer: Number(process.env.RESEARCH_VIDEOS_PER_INFLUENCER ?? 3),
      progress: (step, message) => ctx.progress(step, message),
      getCached: async (influencerId: string, video: SourceVideo) => {
        const { data } = await admin
          .from('research_video_analyses')
          .select('analysis')
          .eq('influencer_id', influencerId)
          .eq('source_url', video.postUrl)
          .maybeSingle();
        const parsed = data ? VideoAnalysis.safeParse(data.analysis) : null;
        return parsed?.success ? parsed.data : null;
      },
      saveAnalysis: async (influencerId, video, analysis, watcher) => {
        await admin
          .from('research_video_analyses')
          .upsert(
            {
              influencer_id: influencerId,
              platform: video.platform,
              source_url: video.postUrl,
              analysis,
              watcher,
            },
            { onConflict: 'influencer_id,source_url' },
          );
      },
    },
  );
  await admin
    .from('archetype_playbooks')
    .insert({ archetype_id: archetypeId, playbook, source_count: sourceCount });
  publish(ctx.userId, { type: 'archetype.updated', archetypeId });
  return playbook;
}
