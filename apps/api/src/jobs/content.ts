import { runContentAgent, titleFor } from '@pseudo/agents';
import { getAdminClient } from '@pseudo/database';
import type { ContentType, PersonaIdentity, Platform } from '@pseudo/shared';
import { publish } from '../lib/bus';
import type { RunCtx } from '../lib/runs';
import { generatePersonaImage } from './image';
import { ensurePlaybook } from './research';

export interface ContentJobInput {
  personaId: string;
  personaVersion: number;
  identity: PersonaIdentity;
  platform: Platform;
  contentType: ContentType;
  topic?: string;
  tone?: string;
  instructions?: string;
  withImage: boolean;
  /** Persona's archetype: triggers the Research step (cached playbook, refreshed if stale). */
  archetypeId?: string | null;
  /** Placeholder content_items (status=generating) created by the route, one per piece. */
  contentIds: string[];
}

/** Workflow B: Strategy -> Content -> validate -> save drafts (-> Visual for Instagram). */
export async function contentJob(ctx: RunCtx, input: ContentJobInput) {
  const admin = getAdminClient();
  try {
    const playbook = input.archetypeId ? await ensurePlaybook(ctx, input.archetypeId) : null;
    const bodies = await runContentAgent(
      {
        playbook,
        identity: input.identity,
        platform: input.platform,
        contentType: input.contentType,
        count: input.contentIds.length,
        topic: input.topic,
        tone: input.tone,
        instructions: input.instructions,
      },
      ctx.progress,
    );
    for (const [i, body] of bodies.entries()) {
      const contentId = input.contentIds[i]!;
      await admin
        .from('content_items')
        .update({
          body,
          title: titleFor(body),
          status: 'awaiting_approval',
          error: null,
          persona_version: input.personaVersion,
        })
        .eq('id', contentId);
      publish(ctx.userId, { type: 'content.updated', contentId, status: 'awaiting_approval' });

      if (input.withImage && body.type === 'instagram_post') {
        try {
          await generatePersonaImage(ctx, {
            personaId: input.personaId,
            identity: input.identity,
            category: 'lifestyle',
            scene: body.imagePrompt,
            useReference: true,
            playbook,
            contentId,
          });
          publish(ctx.userId, { type: 'content.updated', contentId, status: 'awaiting_approval' });
        } catch (err) {
          // Text is still useful without an image; surface the error but keep the draft.
          await ctx.progress('image_failed', `Image failed: ${(err as Error).message}`);
        }
      }
    }
    return { output: { contentIds: input.contentIds } };
  } catch (err) {
    await admin
      .from('content_items')
      .update({ status: 'failed', error: (err as Error).message })
      .in('id', input.contentIds)
      .eq('status', 'generating');
    for (const id of input.contentIds)
      publish(ctx.userId, { type: 'content.updated', contentId: id, status: 'failed' });
    throw err;
  }
}
