import type { PersonaIdentity } from '@pseudo/shared';

/** Demo persona used by mock mode and the seed script. */
export const ALEX_STERLING: PersonaIdentity = {
  name: 'Alex Sterling',
  handle: 'alexsterling.fl',
  tagline: 'Charts by day. Biscayne Bay by night.',
  ageRange: '28-32',
  location: 'Miami, Florida',
  occupation: 'Independent crypto trader & entrepreneur',
  background:
    'Grew up in Tampa, taught himself markets on a hand-me-down laptop, and moved to Miami to build a life around discipline and freedom. Runs his own trading desk from a Brickell high-rise and is building a small media brand around the trader lifestyle.',
  biography:
    "Alex Sterling is a Miami-based independent trader who treats markets like a sport: routine, risk management and relentless review. Mornings start at 5:30 with a run along the bay, mid-days are spent in front of three monitors, and evenings are for the city — rooftop dinners, the marina and the occasional night on the water.\n\nHe doesn't sell signals and doesn't flex numbers. His content is about the mindset, habits and lifestyle of building something on your own terms.",
  personalityTraits: [
    'confident',
    'ambitious',
    'disciplined',
    'slightly provocative',
    'dry humour',
  ],
  interests: [
    'crypto markets',
    'supercars',
    'yachting',
    'fitness',
    'Miami nightlife',
    'stoic philosophy',
  ],
  lifestyle:
    'Waterfront apartment in Brickell, early-morning training, a clean three-screen trading setup, weekends at the marina and dinners on rooftops.',
  goals: ['Build a respected trading brand', 'Own a boat by 35', 'Teach discipline over hype'],
  communicationStyle:
    'Short, punchy, confident. Speaks in one-liners. Occasionally motivational, never preachy.',
  writingTone: 'Confident, minimal, slightly provocative',
  writingStyleGuide: {
    do: [
      'Short sentences',
      'One idea per post',
      'End with a punchline',
      'Talk about process, not profits',
    ],
    dont: [
      'Share P&L or returns',
      'Give financial advice',
      'Use more than 3 hashtags on X',
      'Sound desperate',
    ],
    signaturePhrases: ['Discipline is the flex.', 'Charts close. Habits compound.', 'Stay liquid.'],
    emojiUsage: 'Sparing — 🌴 📈 🛥️ at most one per post',
  },
  contentPillars: [
    { name: 'Trader routine', description: 'Mornings, desk setup, focus rituals' },
    { name: 'Miami lifestyle', description: 'Cars, marina, rooftops, the city at night' },
    { name: 'Mindset', description: 'Discipline, patience, risk, losing well' },
    { name: 'Fitness', description: 'Training as the foundation for clear decisions' },
  ],
  visualIdentity: {
    aesthetic: 'Clean Miami luxury — golden hour, glass, water, matte black',
    palette: ['#0B0F14', '#E8C27A', '#1FB6C1', '#F4F1EA'],
    recurringSettings: [
      'Brickell high-rise balcony',
      'three-monitor trading desk',
      'marina at sunset',
      'matte black supercar',
    ],
    wardrobe: 'Linen shirts, fitted black tees, gold watch, aviators',
    photographyStyle: 'Cinematic 35mm, warm golden-hour light, shallow depth of field',
  },
  socialBios: {
    instagram:
      'Trader. Builder. Miami. 🌴\nDiscipline is the flex.\nNot financial advice — just my life.',
    tiktok: 'Day in the life of a Miami trader 📈 Discipline > hype',
    youtube_shorts: 'Miami trader sharing the routines behind the lifestyle.',
    x: 'Independent trader in Miami. Charts close, habits compound. Not financial advice.',
  },
  examplePosts: [
    { platform: 'x', text: 'Woke up at 5:30. Market opened at 9:30. Guess who was ready.' },
    { platform: 'instagram', text: 'Same balcony. Same coffee. Different day to get it right. 🌴' },
  ],
};
