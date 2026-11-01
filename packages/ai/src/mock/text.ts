import { ALEX_STERLING } from './alex';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let counter = 0;

const X_POSTS = [
  'Woke up at 5:30. Market opened at 9:30. Guess who was ready.',
  'Most people want the boat. Nobody wants the 5am alarm that pays for it.',
  'Charts close. Habits compound. 📈',
  'Your edge isn’t a secret indicator. It’s not trading when you shouldn’t.',
  'Miami heat hits different when your morning is already won.',
];

const IG = [
  {
    caption:
      'Same balcony. Same coffee. Different day to get it right. 🌴\n\nDiscipline is the flex.',
    imagePrompt:
      'man on a Brickell high-rise balcony at sunrise holding espresso, Miami skyline, golden hour',
    altText: 'Alex on a high-rise balcony at sunrise with coffee overlooking Miami',
  },
  {
    caption:
      'Three screens. One plan. Zero impulse trades.\n\nThe setup doesn’t make you disciplined. You do.',
    imagePrompt:
      'clean three-monitor trading desk with candlestick charts, floor-to-ceiling windows, Miami bay view',
    altText: 'A minimal trading desk with three monitors facing the bay',
  },
  {
    caption: 'Golden hour at the marina. Earned, not given. 🛥️',
    imagePrompt:
      'man in linen shirt walking along a Miami marina at sunset, yachts in background, cinematic',
    altText: 'Alex walking along a marina at sunset',
  },
];

/** Deterministic, persona-consistent fixtures so the demo works with zero API keys. */
export async function mockGenerate(task: string, prompt: string): Promise<unknown> {
  await sleep(600 + Math.random() * 700); // feel like real generation
  const n = counter++;
  switch (task) {
    case 'persona':
      return ALEX_STERLING;
    case 'strategy':
      return {
        angles: ALEX_STERLING.contentPillars.map((p, i) => ({
          pillar: p.name,
          angle: [
            'Morning routine before the open',
            'A night on the water',
            'Why I skip most trades',
            'Training before trading',
          ][i],
        })),
      };
    case 'image_prompt':
      return {
        prompt:
          'Photorealistic, cinematic 35mm photo of a confident man in his late 20s in a linen shirt on a Brickell balcony at golden hour, Miami skyline, warm tones, shallow depth of field',
        altText: 'Alex on a Miami balcony at golden hour',
      };
    case 'analytics':
      return {
        summary: 'Lifestyle posts on Instagram are your strongest pillar (sample data).',
        recommendations: ['Post more marina content', 'Keep X posts under 120 chars'],
      };
    case 'content': {
      if (prompt.includes('CONTENT_TYPE: x_thread'))
        return {
          type: 'x_thread',
          posts: [
            'Six things I do before the market opens. None of them involve checking Twitter. 🧵',
            '1. 5:30 alarm. No snooze. The day starts with a win.',
            '2. Run along the bay. Clear head > hot take.',
            '3. Write the plan: levels, invalidation, max risk. If it isn’t written, it isn’t a trade.',
            '4. No trades in the first 15 minutes. Let the amateurs pay for price discovery.',
            'Discipline is the flex. Not financial advice — just my routine.',
          ],
        };
      if (prompt.includes('CONTENT_TYPE: x_post'))
        return { type: 'x_post', text: X_POSTS[n % X_POSTS.length] };
      if (prompt.includes('CONTENT_TYPE: short_video'))
        return {
          type: 'short_video',
          title: '5:30am in Miami — a trader’s morning',
          hook: 'Everyone wants the Miami life. Nobody wants the 5:30 alarm.',
          scenes: [
            {
              durationSec: 3,
              visual: 'phone alarm at 5:30, dark bedroom with bay view',
              voiceover: 'Everyone wants the Miami life. Nobody wants the 5:30 alarm.',
              onScreenText: '5:30 AM',
            },
            {
              durationSec: 4,
              visual: 'running along Biscayne Bay at sunrise',
              voiceover: 'First win of the day: a run before the city wakes up.',
              onScreenText: 'Win #1',
            },
            {
              durationSec: 4,
              visual: 'three-monitor trading desk with charts',
              voiceover: 'Then the plan. Levels, risk, and the trades I will not take.',
              onScreenText: 'The plan',
            },
            {
              durationSec: 4,
              visual: 'espresso on a high-rise balcony overlooking Miami',
              voiceover: 'Discipline is the flex. Everything else is just scenery.',
              onScreenText: 'Discipline is the flex.',
            },
          ],
          caption: 'The morning is the edge. 🌴 #AIgenerated',
          hashtags: ['#miami', '#traderlife', '#morningroutine'],
          voiceoverAssetId: null,
          videoAssetId: null,
        };
      const ig = IG[n % IG.length]!;
      return {
        type: 'instagram_post',
        ...ig,
        hashtags: ['#miami', '#traderlife', '#discipline', '#AIgenerated'],
        storyIdeas: ['Poll: coffee or pre-workout first?'],
      };
    }
    default:
      throw new Error(`mock: unknown task ${task}`);
  }
}
