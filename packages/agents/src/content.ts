import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { generateJson, personaContext, playbookContext, SAFETY_BLOCK } from '@pseudo/ai';
import {
  AI_DISCLOSURE_TAG,
  ContentBody,
  PLATFORM_LABELS,
  type ArchetypePlaybook,
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
  /** Research playbook for the persona's archetype (Research step output). */
  playbook?: ArchetypePlaybook | null;
}

const Angle = z.object({
  pillar: z.string(),
  angle: z.string(),
  /** Which playbook hook formula (by name) the piece opens with; free text when there's no playbook. */
  hook: z.string().optional(),
});

/** Voice rules for the writer: what separates a real creator's post from obvious AI copy. */
const VOICE_RULES = `VOICE (what makes it read like a real creator, not AI):
- Write like the persona typing on their phone between things, not a brand or copywriter.
- Line 1 is the hook. Build it from the chosen hook formula's PATTERN; never reuse a template's wording.
- Be concrete: a time, a place, an object, a number that isn't money, a small detail from the persona's life. No abstract life advice.
- One idea per piece. Short sentences. Fragments are fine. Contractions always.
- Banned (AI tells): "dive in", "game-changer", "unlock", "elevate", "level up", "journey", "in today's fast-paced world", "here's the thing", "let that sink in", "it's not about X, it's about Y", rhetorical triple lists, more than one em dash, stacked emojis, starting with "Ever wondered".
- Hashtags are specific to the niche and the post, never generic (#motivation #success #grind).`;
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
        system: `You are the Strategy Agent for PSEUDO. Pick distinct content angles that fit the persona's content pillars.
Each angle is ONE specific moment, habit, mistake or opinion from the persona's life (not a generic topic like "morning routine tips"), and the angles must differ from each other in pillar or format.
For each angle set "hook" to the name of the playbook hook formula that fits it best (or a short hook idea if there is no playbook).\n${SAFETY_BLOCK}`,
        prompt: `${personaContext(input.identity)}\n\n${playbookContext(input.playbook)}\n\nPlatform: ${PLATFORM_LABELS[input.platform]}\nNumber of angles: ${input.count}\n${input.topic ? `Topic/campaign: ${input.topic}` : ''}`,
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
          system: `You are the Content Agent for PSEUDO. Write in the persona's exact voice.\n${VOICE_RULES}\n${SAFETY_BLOCK}`,
          prompt: [
            personaContext(input.identity),
            playbookContext(input.playbook),
            `CONTENT_TYPE: ${input.contentType}`,
            PLATFORM_RULES[input.contentType],
            `Pillar: ${angle.pillar}\nAngle: ${angle.angle}${angle.hook ? `\nHook formula: ${angle.hook}` : ''}`,
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
