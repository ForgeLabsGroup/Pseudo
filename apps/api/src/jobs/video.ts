import { aiConfig, generateVideoClip, generateVoice, higgsfieldClipSeconds } from '@pseudo/ai';
import { getAdminClient } from '@pseudo/database';
import { ShortVideoBody, type PersonaIdentity } from '@pseudo/shared';
import { publish } from '../lib/bus';
import type { RunCtx } from '../lib/runs';
import { uploadMedia } from '../lib/storage';
import { trackHiggsfield } from '../lib/usage';
import { generatePersonaImage } from './image';
import { personaPlaybook } from './research';

/**
 * Workflow D (MVP): script already exists on the content item. We generate one image per scene and
 * an ElevenLabs voiceover, then the web app previews it with <Player> from @pseudo/media.
 * Server-side MP4 rendering (Remotion renderer + FFmpeg) is a stretch goal.
 */
type VideoJobInput = {
  contentId: string;
  personaId: string;
  identity: PersonaIdentity;
  withVoiceover: boolean;
  voiceId?: string;
};

export async function videoJob(ctx: RunCtx, input: VideoJobInput) {
  try {
    return await prepareVideo(ctx, input);
  } catch (err) {
    // Script is still valid; put it back in the approval queue with the error visible.
    await getAdminClient()
      .from('content_items')
      .update({ status: 'awaiting_approval', error: `Video: ${(err as Error).message}` })
      .eq('id', input.contentId);
    publish(ctx.userId, {
      type: 'content.updated',
      contentId: input.contentId,
      status: 'awaiting_approval',
    });
    throw err;
  }
}

async function prepareVideo(ctx: RunCtx, input: VideoJobInput) {
  const admin = getAdminClient();
  const { data: item, error } = await admin
    .from('content_items')
    .select('*')
    .eq('id', input.contentId)
    .single();
  if (error) throw new Error(error.message);
  const body = ShortVideoBody.parse(item.body);

  // Clear old scene media so regenerations don't stack.
  await admin
    .from('content_media')
    .delete()
    .eq('content_id', input.contentId)
    .in('role', ['scene', 'scene_clip', 'voiceover']);

  const playbook = await personaPlaybook(ctx.userId, input.personaId);

  const doScene = async (i: number, scene: (typeof body.scenes)[number]) => {
    await ctx.progress(
      'scene',
      `Scene ${i + 1}/${body.scenes.length}: ${scene.visual} (images take ~1-2 min)`,
    );
    const still = await generatePersonaImage(ctx, {
      personaId: input.personaId,
      identity: input.identity,
      category: 'lifestyle',
      scene: scene.visual,
      useReference: true,
      aspectRatio: '9:16',
      playbook,
      contentId: input.contentId,
      role: 'scene',
      position: i,
    });
    // Real motion: animate the still (Higgsfield Kling). Mock mode returns null -> template animates the still.
    const animate = () =>
      generateVideoClip({
        imageUrl: still.url,
        prompt: scene.visual,
        durationSec: scene.durationSec,
      });
    let clip;
    if (aiConfig().video === 'higgsfield') {
      await ctx.progress('animate', `Animating scene ${i + 1} (clips take ~1-3 min)`);
      clip = await trackHiggsfield(
        ctx,
        { operation: 'video', personaId: input.personaId, videoSeconds: higgsfieldClipSeconds(scene.durationSec) },
        animate,
      );
    } else {
      clip = await animate();
    }
    if (clip) {
      await ctx.progress('animate', `Animated scene ${i + 1}`);
      const { path, url } = await uploadMedia(
        ctx.userId,
        input.personaId,
        clip.data,
        clip.mimeType,
      );
      const { data: asset, error: e1 } = await admin
        .from('media_assets')
        .insert({
          user_id: ctx.userId,
          persona_id: input.personaId,
          kind: 'video',
          source: 'ai_generated',
          category: 'lifestyle',
          storage_path: path,
          url,
          mime_type: clip.mimeType,
          duration_sec: scene.durationSec,
          prompt: scene.visual,
          provider: clip.provider,
          agent_run_id: ctx.runId,
        })
        .select('id')
        .single();
      if (e1) throw new Error(e1.message);
      await admin.from('content_media').insert({
        content_id: input.contentId,
        asset_id: asset.id,
        user_id: ctx.userId,
        role: 'scene_clip',
        position: i,
      });
    }
  };

  // Scenes are independent: run a few at a time (Higgsfield jobs are slow, not CPU-bound).
  const SCENE_CONCURRENCY = Number(process.env.VIDEO_SCENE_CONCURRENCY ?? 3);
  const queue = body.scenes.map((scene, i) => ({ scene, i }));
  const failures: unknown[] = [];
  await Promise.all(
    Array.from({ length: Math.min(SCENE_CONCURRENCY, queue.length) }, async () => {
      for (let job = queue.shift(); job && failures.length === 0; job = queue.shift()) {
        try {
          await doScene(job.i, job.scene);
        } catch (err) {
          failures.push(err);
        }
      }
    }),
  );
  if (failures.length) throw failures[0];

  let voiceoverAssetId: string | null = null;
  if (input.withVoiceover) {
    await ctx.progress('voice', 'Generating voiceover');
    const script = body.scenes.map((s) => s.voiceover).join(' ');
    const voice = await generateVoice(script, input.voiceId);
    if (voice) {
      const { path, url } = await uploadMedia(
        ctx.userId,
        input.personaId,
        voice.data,
        voice.mimeType,
      );
      const { data: asset, error: e2 } = await admin
        .from('media_assets')
        .insert({
          user_id: ctx.userId,
          persona_id: input.personaId,
          kind: 'audio',
          source: 'ai_generated',
          category: 'other',
          storage_path: path,
          url,
          mime_type: voice.mimeType,
          duration_sec: voice.durationSec,
          prompt: script,
          provider: voice.provider,
          agent_run_id: ctx.runId,
        })
        .select('id')
        .single();
      if (e2) throw new Error(e2.message);
      voiceoverAssetId = asset.id;
      await admin.from('content_media').insert({
        content_id: input.contentId,
        asset_id: asset.id,
        user_id: ctx.userId,
        role: 'voiceover',
        position: 0,
      });
    } else {
      await ctx.progress('voice', 'Voice provider in mock mode: skipping audio');
    }
  }

  await admin
    .from('content_items')
    .update({ body: { ...body, voiceoverAssetId }, status: 'awaiting_approval', error: null })
    .eq('id', input.contentId);
  publish(ctx.userId, {
    type: 'content.updated',
    contentId: input.contentId,
    status: 'awaiting_approval',
  });
  return { output: { contentId: input.contentId, voiceoverAssetId } };
}
