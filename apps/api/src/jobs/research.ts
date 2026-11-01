import { getAdminClient } from '@pseudo/database';
import { createMockWatcher, researchArchetype, type SourceVideo } from '@pseudo/research';
import { ArchetypePlaybook, VideoAnalysis } from '@pseudo/shared';
import { publish } from '../lib/bus';
import { researchVideoStore } from '../lib/research-storage';
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

/** Latest cached playbook for a persona's archetype, or null. Never runs research (too slow per image). */
export async function personaPlaybook(userId: string, personaId: string) {
  const { data } = await getAdminClient()
    .from('personas')
    .select('archetype_id')
    .eq('id', personaId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.archetype_id ? ((await latestPlaybook(data.archetype_id))?.playbook ?? null) : null;
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
  const meta = {
    slug: archetype.slug,
    name: archetype.name,
    description: archetype.description,
    guardrails: archetype.guardrails ?? [],
  };

  // Mock mode must work with zero setup (CLAUDE.md rule 6): with no influencers configured, use
  // sample creators + the mock watcher and persist nothing. With real sources it's a config error.
  if (!influencers?.length) {
    if (process.env.RESEARCH_SOURCE === 'apify')
      throw new Error(`No reference influencers configured for ${archetype.name}`);
    await ctx.progress(
      'research',
      `No influencers configured; using sample ${archetype.name} data`,
    );
    const { playbook, sourceCount } = await researchArchetype(
      meta,
      [1, 2, 3].map((n) => ({
        id: `sample-${n}`,
        label: `sample-${n}`,
        handles: { tiktok: 'sample' },
      })),
      { watcher: createMockWatcher(), progress: (step, message) => ctx.progress(step, message) },
    );
    return savePlaybook(ctx, archetypeId, playbook, sourceCount);
  }

  await ctx.progress('research', `Researching ${influencers.length} ${archetype.name} creators`);
  const { playbook, sourceCount } = await researchArchetype(
    meta,
    influencers.map((i) => ({ id: i.id, label: i.label, handles: i.handles })),
    {
      videosPerInfluencer: Number(process.env.RESEARCH_VIDEOS_PER_INFLUENCER ?? 3),
      store: researchVideoStore(),
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
      saveAnalysis: async (influencerId, video, analysis, watcher, details) => {
        const { error } = await admin.from('research_video_analyses').upsert(
          {
            influencer_id: influencerId,
            platform: video.platform,
            source_url: video.postUrl,
            analysis,
            watcher,
            // Only set when the watcher downloaded/processed the video (undefined = column untouched).
            storage_path: details?.storagePath ?? undefined,
            content_hash: details?.contentHash,
            size_bytes: details?.sizeBytes,
            mime_type: details?.mimeType,
            duration_s: details?.durationSec,
            transcript: details?.transcript,
            frames_used: details?.framesUsed,
          },
          { onConflict: 'influencer_id,source_url' },
        );
        if (error) throw new Error(`Could not save analysis: ${error.message}`);
      },
    },
  );
  return savePlaybook(ctx, archetypeId, playbook, sourceCount);
}

async function savePlaybook(
  ctx: RunCtx,
  archetypeId: string,
  playbook: ArchetypePlaybook,
  sourceCount: number,
) {
  const { error } = await getAdminClient()
    .from('archetype_playbooks')
    .insert({ archetype_id: archetypeId, playbook, source_count: sourceCount });
  if (error) throw new Error(`Could not save playbook: ${error.message}`);
  publish(ctx.userId, { type: 'archetype.updated', archetypeId });
  return playbook;
}
