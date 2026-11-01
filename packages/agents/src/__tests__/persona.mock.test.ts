import type { PersonaIdentity } from '@pseudo/shared';
import { describe, expect, it } from 'vitest';
import { runPersonaAgent } from '../persona';

process.env.AI_TEXT_PROVIDER = 'mock';

describe('runPersonaAgent in mock mode', () => {
  it("builds the persona from the user's facts and description, not the demo fixture", async () => {
    const description = 'A London pastry chef who opens her bakery at 4am.';
    const { identity } = await runPersonaAgent({
      description,
      basics: { name: 'Priya Shah', ageRange: '34', location: 'London', occupation: 'Pastry chef' },
    });
    expect(identity).toMatchObject({
      name: 'Priya Shah',
      handle: 'priyashah',
      ageRange: '34',
      location: 'London',
      occupation: 'Pastry chef',
      background: description,
    });
    expect(JSON.stringify(identity)).not.toMatch(/Alex|Miami|trad(er|ing)/);
  });

  it('keeps the existing identity on regeneration', async () => {
    const first = await runPersonaAgent({
      description: 'A London pastry chef who opens her bakery at 4am.',
      basics: { name: 'Priya Shah' },
    });
    const existing: PersonaIdentity = { ...first.identity, tagline: 'Edited by the user' };
    const { identity } = await runPersonaAgent({ description: 'anything', existing });
    expect(identity).toEqual(existing);
  });
});
