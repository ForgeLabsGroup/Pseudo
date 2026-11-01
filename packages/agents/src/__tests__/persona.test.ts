import { ALEX_STERLING } from '@pseudo/ai';
import { describe, expect, it, vi } from 'vitest';
import { runPersonaAgent } from '../persona';

// Simulates a real model that ignores the user's facts and writes someone else.
vi.mock('@pseudo/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@pseudo/ai')>()),
  generateJson: async () => ({ data: ALEX_STERLING, provider: 'test', model: 'test' }),
}));

describe('runPersonaAgent', () => {
  it("keeps the user's facts even when the model contradicts them", async () => {
    const { identity } = await runPersonaAgent({
      description: 'A London pastry chef who opens her bakery at 4am.',
      basics: { name: 'Priya Shah', handle: '@Priya.Bakes!', ageRange: '34', location: 'London' },
    });
    expect(identity).toMatchObject({
      name: 'Priya Shah',
      handle: 'priya.bakes',
      ageRange: '34',
      location: 'London',
    });
    // Fields the user left blank are still the model's.
    expect(identity.occupation).toBe(ALEX_STERLING.occupation);
  });
});
