import { buildImagePrompt } from '@pseudo/agents';
import { aiConfig, generateImage, maxReferenceImages, type ReferenceImage } from '@pseudo/ai';
import { getAdminClient, toMediaAsset } from '@pseudo/database';
import type { MediaCategory, PersonaIdentity } from '@pseudo/shared';
import { publish } from '../lib/bus';
import type { RunCtx } from '../lib/runs';
import { downloadMedia, uploadMedia } from '../lib/storage';
import { trackHiggsfield } from '../lib/usage';
import { readyCharacterId } from './character';

export interface ImageJobInput {
  personaId: string;
  identity: PersonaIdentity;
  category: MediaCategory;
  scene?: string;
  useReference: boolean;
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
  /** Attach the result to this content item. */
  contentId?: string;
  role?: 'primary' | 'scene';
  position?: number;
}

/** Workflow C: Visual Agent prompt -> image provider (with user's selfies) -> Storage -> media_assets. */
export async function generatePersonaImage(ctx: RunCtx, input: ImageJobInput) {
  const admin = getAdminClient();
  await ctx.progress('prompt', `Visual Agent composing a ${input.category} shot`);
  const { prompt } = await buildImagePrompt(input.identity, input.category, input.scene);

  let references: ReferenceImage[] = [];
  let referenceUrls: string[] = [];
  if (input.useReference) {
    const { data: refs } = await admin
      .from('media_assets')
      .select('storage_path, mime_type, url')
      .eq('persona_id', input.personaId)
      .eq('source', 'reference_upload')
      .order('created_at', { ascending: false })
      .limit(maxReferenceImages());
    referenceUrls = (refs ?? []).map((r) => r.url as string);
    references = await Promise.all(
      (refs ?? []).map(async (r) => ({
        data: await downloadMedia(r.storage_path),
        mimeType: r.mime_type,
      })),
    );
  }

  await ctx.progress(
    'render',
    references.length
      ? `Generating image with ${references.length} reference photo(s)`
      : 'Generating image',
  );
  const characterId = await readyCharacterId(input.personaId);
  const generate = () =>
    generateImage({
      prompt,
      references,
      referenceUrls,
      characterId,
      aspectRatio: input.aspectRatio ?? '4:5',
    });
  const img =
    aiConfig().image === 'higgsfield'
      ? await trackHiggsfield(ctx, { operation: 'image', personaId: input.personaId }, generate)
      : await generate();
  const { path, url } = await uploadMedia(ctx.userId, input.personaId, img.data, img.mimeType);
  const { data: row, error } = await admin
    .from('media_assets')
    .insert({
      user_id: ctx.userId,
      persona_id: input.personaId,
      kind: 'image',
      source: 'ai_generated',
      category: input.category,
      storage_path: path,
      url,
      mime_type: img.mimeType,
      prompt,
      provider: `${img.provider}:${img.model}`,
      agent_run_id: ctx.runId,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  if (input.contentId) {
    await admin.from('content_media').upsert({
      content_id: input.contentId,
      asset_id: row.id,
      user_id: ctx.userId,
      role: input.role ?? 'primary',
      position: input.position ?? 0,
    });
  }
  publish(ctx.userId, { type: 'media.created', assetId: row.id, personaId: input.personaId });
  return toMediaAsset(row);
}
