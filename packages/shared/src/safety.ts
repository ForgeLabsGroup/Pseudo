/**
 * Responsible-design rules. Injected into every generation prompt (packages/ai) and
 * shown in the UI. Keep in one place so all agents enforce the same rules.
 */
export const SAFETY_RULES = [
  'This is a fictional persona and all content is creative identity simulation.',
  'Never state specific trading returns, profits, earnings, account balances, or financial performance as fact.',
  'Never give financial advice or promise outcomes. Frame trading content as mindset, routine, or lifestyle.',
  'Never fabricate testimonials, endorsements, reviews, or quotes from real people or brands.',
  'Never impersonate or reference a real, identifiable person other than the user themself.',
  'Never claim fake credentials, licenses, degrees, or professional qualifications.',
  'No hate, harassment, sexual content, or content targeting minors.',
] as const;

export const AI_DISCLOSURE_TAG = '#AIgenerated';
