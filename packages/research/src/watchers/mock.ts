import type { VideoWatcher } from '../types';

export function createMockWatcher(): VideoWatcher {
  return {
    name: 'mock',
    async watch(_video, { archetypeName }) {
      await new Promise((r) => setTimeout(r, 300));
      return {
        hook: 'Opens on a bold contrarian statement over a striking lifestyle shot',
        hookType: 'contrarian claim',
        structure: [
          'Hook (0-2s)',
          'Relatable problem',
          'Personal routine montage',
          'One-line lesson',
          'Soft CTA',
        ],
        durationSec: 22,
        pacing: 'Fast cuts every 1-2s, trending low-fi beat under voiceover',
        topics: [`${archetypeName} mindset`, 'daily routine', 'discipline'],
        tone: 'Confident, slightly provocative, motivational',
        onScreenText: 'Bold white captions, 3-5 words per line, centered',
        visualStyle: {
          settings: ['high-rise apartment', 'car interior', 'gym'],
          wardrobe: 'Minimal, fitted, neutral colors',
          lighting: 'Golden hour and warm practical lights',
          camera: 'Handheld POV mixed with tripod talking-head',
          editing: 'Jump cuts, zoom punches on key words',
        },
        callToAction: 'Follow for part 2',
        whyItWorks: 'Aspirational visuals + a counter-intuitive claim in the first second',
      };
    },
  };
}
