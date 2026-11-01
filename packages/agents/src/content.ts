import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { generateJson, personaContext, SAFETY_BLOCK } from '@pseudo/ai';
import {
  AI_DISCLOSURE_TAG,
  ContentBody,
  PLATFORM_LABELS,
  type ContentType,
  type Platform,
  type PersonaIdentity,
} from '@pseudo/shared';
import { z } from 'zod';
import { noProgress, type ProgressFn } from './types';

export interface ContentAgentInput {
  identity: PersonaIdentity;
  platform: Platform;
  contentType: ContentType;
  count: number;
  topic?: string;
  tone?: string;
  instructions?: string;
}

const Angle = z.object({ pillar: z.string(), angle: z.string() });
const StrategyOut = z.object({ angles: z.array(Angle).min(1) });

const PLATFORM_RULES: Record<ContentType, string> = {
  instagram_post:
    'Instagram post: lifestyle-focused caption (1-4 short lines), 3-6 hashtags, an imagePrompt describing ONE photo scene featuring the persona, altText, 1-2 story ideas.',
  x_post:
    'X post: a single post under 240 characters. Punchy opinion or observation. Max 2 hashtags (usually none).',
  x_thread:
    'X thread: 4-7 posts, each under 260 characters. First post is a strong hook ending with 🧵.',
  short_video:
    'Vertical short video (TikTok / YouTube Shorts) 15-30s: a hook for the first 2 seconds, 3-6 scenes each with duration, visual description featuring the persona, voiceover line and short on-screen text; caption and 3-5 hashtags. voiceoverAssetId and videoAssetId must be null.',
};

const State = Annotation.Root({
  input: Annotation<ContentAgentInput>,
  angles: Annotation<z.infer<typeof Angle>[]>,
  bodies: Annotation<ContentBody[]>,
});

/**
 * Strategy Agent (plan) -> Content Agent (write, one call per piece) -> finalize.
 */
export function buildContentGraph(progress: ProgressFn = noProgress) {
  return new StateGraph(State)
    .addNode('plan', async (s) => {
      const { input } = s;
      await progress(
        'plan',
        `Strategy Agent picking ${input.count} angle(s) for ${PLATFORM_LABELS[input.platform]}`,
      );
      const res = await generateJson({
        task: 'strategy',
        system: `You are the Strategy Agent for PSEUDO. Pick distinct content angles that fit the persona's content pillars.\n${SAFETY_BLOCK}`,
        prompt: `${personaContext(input.identity)}\n\nPlatform: ${PLATFORM_LABELS[input.platform]}\nNumber of angles: ${input.count}\n${input.topic ? `Topic/campaign: ${input.topic}` : ''}`,
        schema: StrategyOut,
      });
      const angles = Array.from(
        { length: input.count },
        (_, i) => res.data.angles[i % res.data.angles.length]!,
      );
      return { angles };
    })
    .addNode('write', async (s) => {
      const { input } = s;
      const bodies: ContentBody[] = [];
      for (const [i, angle] of s.angles.entries()) {
        await progress(
          'write',
          `Content Agent writing piece ${i + 1}/${s.angles.length}: ${angle.angle}`,
        );
        const res = await generateJson({
          task: 'content',
          system: `You are the Content Agent for PSEUDO. Write in the persona's exact voice.\n${SAFETY_BLOCK}`,
          prompt: [
            personaContext(input.identity),
            `CONTENT_TYPE: ${input.contentType}`,
            PLATFORM_RULES[input.contentType],
            `Pillar: ${angle.pillar}\nAngle: ${angle.angle}`,
            input.topic ? `Topic/campaign: ${input.topic}` : '',
            input.tone ? `Tone for this piece: ${input.tone}` : '',
            input.instructions ? `User instructions: ${input.instructions}` : '',
            `The "type" field must be "${input.contentType}".`,
          ]
            .filter(Boolean)
            .join('\n\n'),
          schema: ContentBody,
        });
        bodies.push(res.data);
      }
      return { bodies };
    })
    .addNode('finalize', async (s) => {
      await progress('finalize', 'Validating and adding AI disclosure');
      // AI disclosure on visual posts (responsible-design requirement).
      const bodies = s.bodies.map((b) =>
        (b.type === 'instagram_post' || b.type === 'short_video') &&
        !b.hashtags.includes(AI_DISCLOSURE_TAG)
          ? { ...b, hashtags: [...b.hashtags, AI_DISCLOSURE_TAG] }
          : b,
      );
      return { bodies };
    })
    .addEdge(START, 'plan')
    .addEdge('plan', 'write')
    .addEdge('write', 'finalize')
    .addEdge('finalize', END)
    .compile();
}

export async function runContentAgent(input: ContentAgentInput, progress: ProgressFn = noProgress) {
  const out = await buildContentGraph(progress).invoke({ input, angles: [], bodies: [] });
  return out.bodies.map((b) => ContentBody.parse(b));
}

/** Short human title for a generated body (used in lists). */
export function titleFor(body: ContentBody): string {
  switch (body.type) {
    case 'instagram_post':
      return body.caption.split('\n')[0]!.slice(0, 80);
    case 'x_post':
      return body.text.slice(0, 80);
    case 'x_thread':
      return body.posts[0]!.slice(0, 80);
    case 'short_video':
      return body.title;
  }
}
