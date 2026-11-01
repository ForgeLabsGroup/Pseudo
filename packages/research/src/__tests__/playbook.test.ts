import { describe, expect, it } from 'vitest';
import { buildPlaybook } from '../playbook';
import { SAMPLE_ANALYSIS } from './helpers';

const base = {
  archetypeName: 'Trader',
  archetypeDescription: 'd',
  guardrails: [],
  analyses: [SAMPLE_ANALYSIS],
};

describe('buildPlaybook (mock text provider)', () => {
  it('keeps X patterns when posts were collected', async () => {
    const pb = await buildPlaybook({
      ...base,
      posts: [{ text: 'hi', url: null, postedAt: null, likes: null }],
    });
    expect(pb.xPostPatterns.length).toBeGreaterThan(0);
  });

  it('never reports X patterns when no posts were collected', async () => {
    const pb = await buildPlaybook({ ...base, posts: [] });
    expect(pb.xPostPatterns).toEqual([]);
    expect(pb.hookFormulas.length).toBeGreaterThan(0); // the rest is untouched
  });
});
