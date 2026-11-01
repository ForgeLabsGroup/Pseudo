import { createCharacter, getCharacter, waitFor } from '@pseudo/ai';
import { getAdminClient } from '@pseudo/database';
import type { CharacterRef } from '@pseudo/shared';
import { publish } from '../lib/bus';
import type { RunCtx } from '../lib/runs';
import { settleRunUsage, trackHiggsfield } from '../lib/usage';

/** Training keeps billing at Higgsfield past our deadline, so be generous before giving up. */
const TRAIN_TIMEOUT_MS = 30 * 60_000;
/** How often a waiting training run logs progress. The reaper treats silence as a dead job. */
export const TRAIN_HEARTBEAT_MS = 60_000;

/**
 * Train the user's likeness at the provider (Higgsfield Soul ID) from their reference selfies.
 * Stored on personas.character_refs[provider]; image/video jobs use it when status = ready.
 * With `resumeId` (the reaper, after a restart) it only waits for that already-started training.
 */
export async function characterJob(
  ctx: RunCtx,
  personaId: string,
  provider: 'higgsfield',
  resumeId?: string,
) {
  const admin = getAdminClient();
  const setRef = async (ref: Omit<CharacterRef, 'updatedAt'>) => {
    const { data } = await admin
      .from('personas')
      .select('character_refs')
      .eq('id', personaId)
      .single();
    const refs = {
      ...(data?.character_refs ?? {}),
      [provider]: { ...ref, updatedAt: new Date().toISOString() },
    };
    await admin.from('personas').update({ character_refs: refs }).eq('id', personaId);
    publish(ctx.userId, { type: 'persona.updated', personaId });
  };

  try {
    let id: string;
    if (resumeId) {
      await ctx.progress('train', 'Server restarted: still waiting on your likeness training');
      id = resumeId;
      await settleRunUsage(ctx, () => waitForTraining(ctx, id));
    } else {
      const { data: refs } = await admin
        .from('media_assets')
        .select('url')
        .eq('persona_id', personaId)
        .eq('source', 'reference_upload')
        .order('created_at');
      const imageUrls = (refs ?? []).map((r) => r.url as string);
      if (imageUrls.length === 0) throw new Error('Upload at least one selfie first');

      const { data: persona } = await admin
        .from('personas')
        .select('name')
        .eq('id', personaId)
        .single();
      await ctx.progress('upload', `Sending ${imageUrls.length} selfie(s) to ${provider}`);
      await setRef({ id: null, status: 'training', error: null });
      id = await trackHiggsfield(ctx, { operation: 'character', personaId }, async () => {
        const { id } = await createCharacter({ name: persona?.name ?? 'Persona', imageUrls });
        await setRef({ id, status: 'training', error: null });
        await ctx.progress('train', 'Training your likeness (this can take a few minutes)');
        await waitForTraining(ctx, id);
        return id;
      });
    }
    await setRef({ id, status: 'ready', error: null });
    return { output: { provider, characterId: id } };
  } catch (err) {
    await setRef({ id: null, status: 'failed', error: (err as Error).message });
    throw err;
  }
}

async function waitForTraining(ctx: RunCtx, id: string) {
  const started = Date.now();
  let lastBeat = started;
  await waitFor(async () => {
    if (Date.now() - lastBeat >= TRAIN_HEARTBEAT_MS) {
      lastBeat = Date.now();
      const min = Math.round((lastBeat - started) / 60_000);
      await ctx.progress('train', `Still training your likeness (${min} min)`);
    }
    const s = await getCharacter(id);
    return {
      done: s.status === 'ready',
      failed: s.status === 'failed' ? (s.error ?? 'Training failed') : undefined,
    };
  }, TRAIN_TIMEOUT_MS);
}

/** The ready character id for the active image/video provider, if any. */
export async function readyCharacterId(
  personaId: string,
  provider = 'higgsfield',
): Promise<string | undefined> {
  const { data } = await getAdminClient()
    .from('personas')
    .select('character_refs')
    .eq('id', personaId)
    .single();
  const ref = data?.character_refs?.[provider];
  return ref?.status === 'ready' && ref.id ? ref.id : undefined;
}
