import { generateJson, SAFETY_BLOCK } from '@pseudo/ai';
import { ArchetypePlaybook, type VideoAnalysis } from '@pseudo/shared';
import type { SourcePost } from './types';

/** Merge per-video analyses + X posts from all influencers into one archetype playbook. */
export async function buildPlaybook(input: {
  archetypeName: string;
  archetypeDescription: string;
  guardrails: string[];
  analyses: VideoAnalysis[];
  posts: SourcePost[];
}) {
  const res = await generateJson({
    task: 'research',
    schema: ArchetypePlaybook,
    temperature: 0.4,
    system: `You are the Research Agent for PSEUDO. Distil what makes successful "${input.archetypeName}" creators work into a reusable playbook.
Capture PATTERNS (hook formulas, structures, topics, tone, visual style, cadence). Never include creator names, handles,
or verbatim lines — paraphrase every example into a fresh, generic one.
${SAFETY_BLOCK}
${input.guardrails.map((g) => `- ${g}`).join('\n')}`,
    prompt: [
      `ARCHETYPE: ${input.archetypeName} — ${input.archetypeDescription}`,
      `VIDEO ANALYSES (${input.analyses.length}):\n${JSON.stringify(input.analyses)}`,
      `X POSTS (${input.posts.length}, for voice/pattern study only — do not copy):\n${input.posts.map((p) => `- ${p.text}`).join('\n')}`,
    ].join('\n\n'),
  });
  return res.data;
}
