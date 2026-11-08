import { describe, expect, it } from 'vitest';
import { enemyDef } from '../../src/sim/content';

describe('Ruin Warlord presentation', () => {
  it('wears ash-forged spiked armor, not the Guardian chest construct', () => {
    // The bestiary promises "obsidian spiked armor"; the Guardian sheet is the
    // depth-0 chest construct, so the warlord must not borrow it.
    expect(enemyDef('ruin_warlord', true).sprite).toBe('cinderWarden');
  });
});
