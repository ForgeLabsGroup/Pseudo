import { z } from 'zod';

/** Platforms we can research. */
export const RESEARCH_PLATFORMS = ['tiktok', 'instagram', 'youtube', 'x'] as const;
export const ResearchPlatform = z.enum(RESEARCH_PLATFORMS);
export type ResearchPlatform = z.infer<typeof ResearchPlatform>;

/** Handles per platform; an influencer can have any subset. No leading @. */
export const InfluencerHandles = z.partialRecord(ResearchPlatform, z.string().min(1));
export type InfluencerHandles = z.infer<typeof InfluencerHandles>;

export const Archetype = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  guardrails: z.array(z.string()),
  /** When the latest playbook was built; null = never researched. */
  playbookUpdatedAt: z.string().nullable(),
});
export type Archetype = z.infer<typeof Archetype>;

/** What the VideoWatcher extracts from ONE source video. Patterns, not copies. */
export const VideoAnalysis = z.object({
  hook: z
    .string()
    .describe('How the first 1-3 seconds grab attention (describe the technique, do not quote)'),
  hookType: z
    .string()
    .describe('e.g. contrarian claim, question, visual pattern-interrupt, "day in the life"'),
  structure: z.array(z.string()).describe('Beat-by-beat structure of the video'),
  durationSec: z.number().nullable(),
  pacing: z.string().describe('Cut frequency, energy, music usage'),
  topics: z.array(z.string()),
  tone: z.string(),
  onScreenText: z.string().describe('Style of captions/text overlays'),
  visualStyle: z.object({
    settings: z.array(z.string()),
    wardrobe: z.string(),
    lighting: z.string(),
    camera: z.string().describe('Framing, angles, handheld vs tripod, POV'),
    editing: z.string(),
  }),
  callToAction: z.string().nullable(),
  whyItWorks: z.string(),
});
export type VideoAnalysis = z.infer<typeof VideoAnalysis>;

/**
 * The archetype playbook: merged patterns across all reference influencers.
 * Fed to the Persona, Ideation (Strategy), Content and Visual agents.
 * Must never contain influencer names, handles, or verbatim lines.
 */
export const ArchetypePlaybook = z.object({
  summary: z.string(),
  hookFormulas: z
    .array(z.object({ name: z.string(), template: z.string(), example: z.string() }))
    .min(1),
  videoStructures: z.array(z.object({ name: z.string(), beats: z.array(z.string()) })).min(1),
  recurringTopics: z.array(z.string()),
  contentPillars: z.array(z.object({ name: z.string(), description: z.string() })),
  toneAndVoice: z.object({
    description: z.string(),
    vocabulary: z.array(z.string()),
    avoid: z.array(z.string()),
  }),
  xPostPatterns: z.array(z.string()),
  visualStyle: z.object({
    settings: z.array(z.string()),
    wardrobe: z.string(),
    lighting: z.string(),
    camera: z.string(),
    editing: z.string(),
    palette: z.array(z.string()),
  }),
  postingCadence: z.string(),
  doList: z.array(z.string()),
  dontList: z.array(z.string()),
});
export type ArchetypePlaybook = z.infer<typeof ArchetypePlaybook>;
