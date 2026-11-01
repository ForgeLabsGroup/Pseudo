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

/** Shared visual rules for short videos: what each scene shows and which graphics are drawn over it. */
const VIDEO_VISUAL_RULES = `VISUALS (each scene = one real phone shot animated into a 3-5s clip):
- subject "persona" (most scenes): the persona on camera doing that moment (who, doing what, where). Set "shot" and vary it: close-up face, three-quarter angle, side profile, wide environmental, low-angle mid, glance over the shoulder.
- subject "broll" (1-2 scenes): a detail shot with NO people of something the video is about: trading screens with candlestick charts, coffee on the desk, keys on the counter, the car's dashboard at dawn, a squat rack. Cut these between persona scenes so the video shows the world, not just a face.
- "overlay": "chart" on the scene about markets, trading or a good day (an animated candlestick chart is drawn over it); "list" on a scene that sums up steps, with "overlayItems" (2-4 labels of 1-3 words); otherwise "none". At most 2 overlays per video.
- Results/earnings: show them with the chart overlay, the screens and the persona's reaction. NEVER put amounts, balances, percentages, P&L or returns in voiceover, on-screen text, visuals or overlay items.
- No split screens, montages or text-as-image. Vehicles and products are generic, unbranded.`;

const PLATFORM_RULES: Record<ContentType, string> = {
  instagram_post:
    'Instagram post: lifestyle-focused caption (1-4 short lines), 3-6 hashtags, an imagePrompt describing ONE photo scene featuring the persona, altText, 1-2 story ideas.',
  x_post:
    'X post: a single post under 240 characters. Punchy opinion or observation. Max 2 hashtags (usually none).',
  x_thread:
    'X thread: 4-7 posts, each under 260 characters. First post is a strong hook ending with 🧵.',
  short_video: `Vertical short video (TikTok / YouTube Shorts), 15-25s total. Build it like this:
1. IDEA FIRST. Before any scene, decide the ONE takeaway the viewer leaves with and write it in "idea" (one sentence): a specific tip, a common mistake and its fix, a myth busted, or a mini-story with a turn. The idea must be ACTIONABLE: a rule, step or fix the viewer can try today, in the form "do X when Y, because Z". A mood or lesson-of-life ("your best work happens when you stop forcing it", "discipline is the flex") is NOT an idea. If a viewer could not do something different after watching, rewrite it.
2. STRUCTURE. Use one of the playbook "Video structures" if there is one. Give 4-6 scenes, each 3-5 seconds (clips are 3-5s), and set "beat" on each scene (hook | setup | value | proof | payoff | cta). "hook" is the first 2 seconds: a pattern interrupt built from a playbook hook formula's pattern (never its wording).
3. VALUE. The value scenes must teach or reveal something concrete: the actual step, rule, number (never money), object, place or mistake. Show it, don't announce it. The payoff lands the idea and, where natural, loops back to the hook. At most one light CTA (comment/follow), no hype.
4. VOICEOVER. Write it as speech: ~2.5 words per second, so about 8-12 words per 4s scene. Short sentences. It is the persona talking to one person, not narrating an ad. Each line must add information, never restate the previous one.
5. ON-SCREEN TEXT: max 5 words, adds a fact or label (a time, a step number, the rule), never repeats the voiceover.
6. ${VIDEO_VISUAL_RULES}
7. NO FABRICATED RESULTS: never invent engagement or performance numbers ("10x more saves", "went viral", follower counts), earnings, or client results. Specific small details (a time, a step, an object) are good; unverifiable statistics are not.
caption: 1-2 lines that add context, plus 3-5 niche-specific hashtags. voiceoverAssetId, musicAssetId and videoAssetId must be null.`,
};

/**
 * When the user describes the video themselves, their description IS the storyboard: we film what they
 * asked for in the persona's voice, with no added lesson, twist or reframe.
 */
const SHORT_VIDEO_DIRECTED = `Vertical short video (TikTok / YouTube Shorts), 12-25s. The user's topic is the STORYBOARD:
1. Depict exactly what the user described, in the order they described it, as the persona living it. Each thing they mention gets its own scene; add at most one extra scene (a hook or a closing shot) and only if it fits.
2. Do NOT add a lesson, moral, twist, mindset take or "it's not about X" reframe. Do not swap, soften or argue with any activity they asked for. The tone matches what they asked for (a flex stays a flex, a routine stays a routine), in the scenes AND the caption; skip any persona catchphrase that argues against it (e.g. "process over flex" on a flex video).
3. "idea" = one sentence describing what the video shows.
4. Money: you may SHOW checking a trading/earnings app and react to a good day (a grin, a nod, "green day"), but never say, show or imply specific amounts, percentages or returns. Never lecture about money either; just keep the numbers off screen.
5. Scenes: 3-5 seconds each, set "beat" (hook | setup | value | proof | payoff | cta).
${VIDEO_VISUAL_RULES}
6. VOICEOVER: the persona talking casually, ~2.5 words per second (about 8-12 words per 4s scene). It narrates what we see; no advice.
7. ON-SCREEN TEXT: max 5 words, a label for the moment (a time, a place, the step).
caption: 1-2 lines in the persona's voice about this video, plus 3-5 niche-specific hashtags. voiceoverAssetId, musicAssetId and videoAssetId must be null.`;

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
      // A user-described video is filmed as described: no Strategy Agent "angle" to reinterpret it.
      if (input.contentType === 'short_video' && input.topic?.trim()) {
        await progress('plan', 'Using your description as the storyboard');
        const angle = { pillar: 'user brief', angle: input.topic.trim() };
        return { angles: Array.from({ length: input.count }, () => angle) };
      }
      await progress(
        'plan',
        `Strategy Agent picking ${input.count} angle(s) for ${PLATFORM_LABELS[input.platform]}`,
      );
      const res = await generateJson({
        task: 'strategy',
        system: `You are the Strategy Agent for PSEUDO. Pick distinct content angles that fit the persona's content pillars.
Each angle is ONE specific moment, habit, mistake or opinion from the persona's life (not a generic topic like "morning routine tips"), and the angles must differ from each other in pillar or format.
For each angle set "hook" to the name of the playbook hook formula that fits it best (or a short hook idea if there is no playbook).
If the user gives a TOPIC, it is binding: every angle must be a specific take on THAT topic (the pillars only shape how the persona approaches it). Never swap the user's topic for a different one.\n${SAFETY_BLOCK}`,
        prompt: `${input.topic ? `USER'S TOPIC (every angle must be about this): ${input.topic}\n\n` : ''}${personaContext(input.identity)}\n\n${playbookContext(input.playbook)}\n\nPlatform: ${PLATFORM_LABELS[input.platform]}\nNumber of angles: ${input.count}${input.topic ? `\nReminder, the topic is: ${input.topic}` : ''}`,
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
            input.topic
              ? `USER'S TOPIC: ${input.topic}\nThis piece MUST be about this topic: the idea, the hook and every scene serve it. Use the persona's voice and life to tell it, not to change the subject.`
              : '',
            personaContext(input.identity),
            playbookContext(input.playbook),
            `CONTENT_TYPE: ${input.contentType}`,
            input.contentType === 'short_video' && input.topic?.trim()
              ? SHORT_VIDEO_DIRECTED
              : PLATFORM_RULES[input.contentType],
            `Pillar: ${angle.pillar}\nAngle: ${angle.angle}${angle.hook ? `\nHook formula: ${angle.hook}` : ''}`,
            input.topic ? `Reminder: stay on the user's topic: ${input.topic}` : '',
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
      // Open models sometimes drop the '#': normalise, de-duplicate.
      const tags = (list: string[]) => [
        ...new Set(list.map((t) => t.trim().replace(/^#*/, '#')).filter((t) => t.length > 1)),
      ];
      const bodies = s.bodies.map((b) => {
        if (b.type !== 'instagram_post' && b.type !== 'short_video') return b;
        const hashtags = tags(b.hashtags);
        // Hashtags live in their own field; strip any the model also tacked onto the caption.
        const caption = b.caption.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, '').trim();
        return {
          ...b,
          caption,
          hashtags: hashtags.includes(AI_DISCLOSURE_TAG) ? hashtags : [...hashtags, AI_DISCLOSURE_TAG],
        };
      });
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
