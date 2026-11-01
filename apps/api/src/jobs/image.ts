import { buildBrollPrompt, buildImagePrompt } from '@pseudo/agents';
import { aiConfig, generateImage, maxReferenceImages, type ReferenceImage } from '@pseudo/ai';
import { getAdminClient, toMediaAsset } from '@pseudo/database';
import type { ArchetypePlaybook, MediaCategory, PersonaIdentity } from '@pseudo/shared';
import { publish } from '../lib/bus';
import type { RunCtx } from '../lib/runs';
import { downloadMedia, uploadMedia } from '../lib/storage';
import { trackHiggsfield } from '../lib/usage';
import { readyCharacterId } from './character';
import { personaPlaybook } from './research';

export interface ImageJobInput {
  personaId: string;
  identity: PersonaIdentity;
  category: MediaCategory;
  scene?: string;
  useReference: boolean;
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
  /** Research playbook for the persona's archetype. Omitted = latest cached one. */
  playbook?: ArchetypePlaybook | null;
  /** Attach the result to this content item. */
  contentId?: string;
  role?: 'primary' | 'scene';
  position?: number;
  /** Index within a batch/video: rotates which selfies lead, so each image draws on different face angles. */
  variant?: number;
  /** 'broll' = detail shot with no people: no selfies, no likeness. */
  subject?: 'persona' | 'broll';
}

/** Workflow C: Visual Agent prompt -> image provider (with user's selfies) -> Storage -> media_assets. */
export async function generatePersonaImage(ctx: RunCtx, input: ImageJobInput) {
  const admin = getAdminClient();
  await ctx.progress('prompt', `Visual Agent composing a ${input.category} shot`);
  const playbook = input.playbook ?? (await personaPlaybook(ctx.userId, input.personaId));
  const broll = input.subject === 'broll';
  const { prompt } = broll
    ? await buildBrollPrompt(input.identity, input.scene ?? 'a detail shot from the persona\'s day', playbook)
    : await buildImagePrompt(input.identity, input.category, input.scene, playbook);

  let references: ReferenceImage[] = [];
  let referenceUrls: string[] = [];
  if (input.useReference && !broll) {
    const { data: refs } = await admin
      .from('media_assets')
      .select('storage_path, mime_type, url')
      .eq('persona_id', input.personaId)
      .eq('source', 'reference_upload')
      .order('created_at', { ascending: false })
      .limit(maxReferenceImages());
    const rows = refs ?? [];
    const shift = rows.length ? (input.variant ?? 0) % rows.length : 0;
    const rotated = [...rows.slice(shift), ...rows.slice(0, shift)];
    referenceUrls = rotated.map((r) => r.url as string);
    references = await Promise.all(
      rotated.map(async (r) => ({
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
  const characterId = broll ? undefined : await readyCharacterId(input.personaId);
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
