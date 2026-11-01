import { SAFETY_RULES, type PersonaIdentity } from '@pseudo/shared';

export const SAFETY_BLOCK = `RULES (non-negotiable):\n${SAFETY_RULES.map((r) => `- ${r}`).join('\n')}`;

/**
 * The single source of persona context. EVERY generation prompt includes this block so the
 * persona never drifts (Alex stays a Miami crypto trader in every post).
 */
export function personaContext(p: PersonaIdentity): string {
  return [
    `PERSONA: ${p.name} (@${p.handle}) — ${p.tagline}`,
    `Age: ${p.ageRange} | Location: ${p.location} | Occupation: ${p.occupation}`,
    `Background: ${p.background}`,
    `Personality: ${p.personalityTraits.join(', ')}`,
    `Interests: ${p.interests.join(', ')}`,
    `Lifestyle: ${p.lifestyle}`,
    `Goals: ${p.goals.join('; ')}`,
    `Communication style: ${p.communicationStyle}`,
    `Writing tone: ${p.writingTone}`,
    `Writing DO: ${p.writingStyleGuide.do.join('; ')}`,
    `Writing DON'T: ${p.writingStyleGuide.dont.join('; ')}`,
    `Signature phrases: ${p.writingStyleGuide.signaturePhrases.join(' | ')}`,
    `Emoji usage: ${p.writingStyleGuide.emojiUsage}`,
    `Content pillars: ${p.contentPillars.map((c) => `${c.name} (${c.description})`).join('; ')}`,
    `Visual identity: ${p.visualIdentity.aesthetic}; palette ${p.visualIdentity.palette.join(', ')}; settings ${p.visualIdentity.recurringSettings.join(', ')}; wardrobe ${p.visualIdentity.wardrobe}; photography ${p.visualIdentity.photographyStyle}`,
  ].join('\n');
}
