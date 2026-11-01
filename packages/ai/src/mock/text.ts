import type { PersonaIdentity } from '@pseudo/shared';
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

/**
 * Mock Persona Agent. Regeneration keeps the existing identity; a new persona is built from the
 * user's PERSONA_FACTS + description so mock mode never hands everyone Alex Sterling's life.
 */
function mockPersona(prompt: string): PersonaIdentity {
  const existing = /^EXISTING_IDENTITY[^:]*: (.+)$/m.exec(prompt)?.[1];
  if (existing) return JSON.parse(existing) as PersonaIdentity;
  const factsJson = /^PERSONA_FACTS: (.+)$/m.exec(prompt)?.[1];
  if (!factsJson) return ALEX_STERLING;
  const facts = JSON.parse(factsJson) as Partial<PersonaIdentity>;
  const description = /"""([\s\S]*?)"""/.exec(prompt)?.[1]?.trim() ?? '';
  const name = facts.name ?? 'New alter ego';
  const occupation = facts.occupation ?? 'Creator';
  const location = facts.location ?? 'On the move';
  const job = occupation.toLowerCase();
  return {
    name,
    handle: facts.handle ?? name,
    tagline: `${occupation}. ${location}. Process over flex.`,
    ageRange: facts.ageRange ?? '25-30',
    location,
    occupation,
    background: description,
    biography: `${name}: ${job}, based in ${location}. ${description}\n\nShares the routines, small wins and honest moments behind the life, never the highlight reel alone.`,
    personalityTraits: ['confident', 'driven', 'curious', 'dry humour'],
    interests: [job, 'fitness', 'travel', 'good food'],
    lifestyle: `Early mornings, focused work as a ${job}, evenings out in ${location}.`,
    goals: ['Build an audience that cares', 'Show the work behind the life'],
    communicationStyle: 'Short, punchy, confident. One idea at a time.',
    writingTone: 'Confident, warm, minimal',
    writingStyleGuide: {
      do: ['Short sentences', 'One idea per post', 'Show the process'],
      dont: ['Fake numbers or results', 'Sound desperate', 'Overuse hashtags'],
      signaturePhrases: ['Process over flex.'],
      emojiUsage: 'Sparing, one per post at most',
    },
    contentPillars: [
      { name: 'Daily routine', description: `What a day as a ${job} really looks like` },
      { name: `Life in ${location}`, description: 'Places, food and moments around town' },
      { name: 'Mindset', description: 'Discipline, patience and lessons learned' },
      { name: 'Behind the scenes', description: 'The unglamorous work behind the results' },
    ],
    visualIdentity: {
      aesthetic: 'Clean, warm and candid',
      palette: ['#111111', '#E8C27A', '#F4F1EA'],
      recurringSettings: [`around ${location}`, 'workspace', 'morning routine'],
      wardrobe: 'Fitted neutrals, one statement accessory',
      photographyStyle: 'Candid phone photos, natural available light',
    },
    socialBios: {
      instagram: `${occupation} · ${location}\nProcess over flex.`,
      tiktok: `Day in the life: ${job} in ${location}`,
      youtube_shorts: `${name}: the routines behind life as a ${job}.`,
      x: `${occupation} in ${location}. Process over flex.`,
    },
    examplePosts: [
      { platform: 'x', text: 'Nobody sees the 6am part. That is the part that matters.' },
      { platform: 'instagram', text: `Another day in ${location}. Same plan, better execution.` },
    ],
  };
}

/** Deterministic, persona-consistent fixtures so the demo works with zero API keys. */
export async function mockGenerate(task: string, prompt: string): Promise<unknown> {
  await sleep(600 + Math.random() * 700); // feel like real generation
  const n = counter++;
  switch (task) {
    case 'persona':
      return mockPersona(prompt);
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
    case 'image_prompt': {
      // Honour the requested category/scene (the real model does), so mock mode isn't always a balcony.
      const broll = /^B-roll shot: (.+)$/m.exec(prompt)?.[1];
      if (broll) return { prompt: `${broll}, on a desk by a window, morning light`, altText: broll };
      const must = /MUST clearly show: ([^\n]+?)\.?(?:\n|$)/.exec(prompt)?.[1];
      const scene = /^Scene: (.+)$/m.exec(prompt)?.[1];
      const subject = must ?? 'a confident man in his late 20s in a linen shirt on a Brickell balcony';
      return {
        prompt: `${subject}${scene ? `, ${scene}` : ''}, Miami, late afternoon sun`,
        altText: scene ?? must ?? 'Alex on a Miami balcony in the afternoon',
      };
    }
    case 'research': {
      const name = /ARCHETYPE: ([^—\n]+)/.exec(prompt)?.[1]?.trim() ?? 'Creator';
      return {
        summary: `Top ${name} creators win with aspirational visuals, a contrarian first line and a disciplined daily-routine narrative. (mock research)`,
        hookFormulas: [
          {
            name: 'Contrarian truth',
            template: 'Everyone wants [result]. Nobody wants [unsexy habit].',
            example: 'Everyone wants the view. Nobody wants the 5am alarm.',
          },
          {
            name: 'POV routine',
            template: 'POV: [time] as a [archetype] in [city]',
            example: 'POV: 6am as a trader in Miami',
          },
          {
            name: 'Number list',
            template: '[N] things I stopped doing that changed [area]',
            example: '3 things I stopped doing that fixed my focus',
          },
        ],
        videoStructures: [
          {
            name: 'Day in the life',
            beats: [
              'Hook over b-roll',
              'Morning ritual',
              'Work block',
              'Lifestyle reward',
              'One-line lesson',
            ],
          },
          {
            name: 'Talking head + proof b-roll',
            beats: [
              'Bold claim to camera',
              '3 quick points with b-roll',
              'Punchline',
              'Follow CTA',
            ],
          },
        ],
        recurringTopics: [
          'discipline',
          'routines',
          'mindset',
          'lifestyle rewards',
          'mistakes to avoid',
        ],
        contentPillars: [
          { name: 'Routine', description: 'Mornings, workspace, rituals' },
          { name: 'Mindset', description: 'Discipline, patience, contrarian takes' },
          { name: 'Lifestyle', description: 'The aspirational payoff' },
        ],
        toneAndVoice: {
          description: 'Confident, minimal, slightly provocative',
          vocabulary: ['discipline', 'edge', 'compound', 'locked in'],
          avoid: ['guarantees', 'income claims', 'hype emojis'],
        },
        xPostPatterns: [
          'One-line contrarian take',
          'Short numbered list thread',
          'Observation + punchline',
        ],
        visualStyle: {
          settings: ['high-rise apartment', 'car interior', 'waterfront'],
          wardrobe: 'Minimal fitted neutrals, one statement accessory',
          lighting: 'Golden hour, warm practicals',
          camera: 'Handheld POV + tripod talking head, 9:16',
          editing: 'Fast jump cuts, zoom punches, bold centered captions',
          palette: ['#0B0F14', '#E8C27A', '#F4F1EA'],
        },
        postingCadence: '1-2 short videos per day, 3-5 X posts per day',
        doList: ['Hook in the first second', 'One idea per video', 'Show process, not results'],
        dontList: ['Income or returns claims', 'Copying other creators lines', 'Long intros'],
      };
    }
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
          title: 'The 10-minute rule that stopped my bad trades',
          idea: 'Wait 10 minutes after any urge to trade and write one sentence on why; most urges disappear.',
          hook: 'Trades I took out of boredom hurt me more than any bad setup.',
          scenes: [
            {
              durationSec: 3,
              beat: 'hook',
              shot: 'close-up face, looking at camera',
              visual: 'at a desk in the morning, looking straight at the camera, three monitors blurred behind',
              voiceover: 'Boredom trades cost me more than any bad setup.',
              onScreenText: 'Boredom trades',
            },
            {
              durationSec: 4,
              beat: 'setup',
              subject: 'broll',
              overlay: 'chart',
              visual: 'three monitors with candlestick charts on a desk, morning light, a half-finished coffee',
              voiceover: 'The urge shows up around 11. Nothing is happening, so I want to make something happen.',
              onScreenText: '11:04 AM',
            },
            {
              durationSec: 4,
              beat: 'value',
              shot: 'low-angle mid shot, writing on a sticky note',
              overlay: 'list',
              overlayItems: ['Wait 10 min', 'Write 1 sentence', 'Still good? Take it'],
              visual: 'writing one sentence on a sticky note and pressing it to the monitor',
              voiceover: 'So I made a rule. Ten minutes. And one sentence on why I want in.',
              onScreenText: 'Rule: 10 min + 1 sentence',
            },
            {
              durationSec: 4,
              beat: 'proof',
              shot: 'side profile, standing at the window',
              visual: 'standing at the window with a coffee while a timer counts down on the phone',
              voiceover: 'Most of the time the sentence is just: I am bored. Then I close the chart.',
              onScreenText: 'Most urges: gone',
            },
            {
              durationSec: 4,
              beat: 'payoff',
              shot: 'wide environmental, walking away from the desk',
              visual: 'walking away from the desk toward the balcony door, screens still on behind',
              voiceover: 'If the reason is still good after ten minutes, I take it. Otherwise, I got ten minutes back.',
              onScreenText: 'Try it once today',
            },
          ],
          caption: 'The rule that cut my worst habit. Saving this for the next time I get restless. #AIgenerated',
          hashtags: ['#traderlife', '#tradingpsychology', '#riskmanagement', '#miami'],
          voiceoverAssetId: null,
          musicAssetId: null,
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
