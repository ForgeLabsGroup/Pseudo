import { createCharacter, getCharacter, waitFor } from '@pseudo/ai';
import { getAdminClient } from '@pseudo/database';
import type { CharacterRef } from '@pseudo/shared';
import { publish } from '../lib/bus';
import type { RunCtx } from '../lib/runs';

/**
 * Train the user's likeness at the provider (Higgsfield Soul ID) from their reference selfies.
 * Stored on personas.character_refs[provider]; image/video jobs use it when status = ready.
 */
export async function characterJob(ctx: RunCtx, personaId: string, provider: 'higgsfield') {
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
  try {
    const { id } = await createCharacter({ name: persona?.name ?? 'Persona', imageUrls });
    await setRef({ id, status: 'training', error: null });
    await ctx.progress('train', 'Training your likeness (this can take a few minutes)');
    await waitFor(async () => {
      const s = await getCharacter(id);
      return {
        done: s.status === 'ready',
        failed: s.status === 'failed' ? (s.error ?? 'Training failed') : undefined,
      };
    });
    await setRef({ id, status: 'ready', error: null });
    return { output: { provider, characterId: id } };
  } catch (err) {
    await setRef({ id: null, status: 'failed', error: (err as Error).message });
    throw err;
  }
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
