import { ArchetypePlaybook } from '@pseudo/shared';
import { describe, expect, it } from 'vitest';
import { mockGenerate } from '../mock/text';
import { playbookContext } from '../prompts';

const playbook = async () =>
  ArchetypePlaybook.parse(await mockGenerate('research', 'ARCHETYPE: Trader — d'));

describe('playbookContext', () => {
  it('includes the X patterns and the dont list', async () => {
    const pb = await playbook();
    const ctx = playbookContext({ ...pb, dontList: ['Never state returns.'] });
    expect(ctx).toContain('X post patterns:');
    expect(ctx).toContain('Never state returns.');
  });

  it('leaves out the X line when no X patterns were researched', async () => {
    const ctx = playbookContext({ ...(await playbook()), xPostPatterns: [] });
    expect(ctx).not.toContain('X post patterns');
    expect(ctx).not.toMatch(/\n\n/);
  });
});
