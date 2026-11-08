import { describe, expect, it } from 'vitest';
import { enemyDef } from '../../src/sim/content';

describe('Bloom Sentinel presentation', () => {
  it('uses a bloom-native sheet, not the Guardian chest construct', () => {
    // The bestiary promises roots and flowers; the Guardian sheet is the
    // depth-0 keyhole chest, which read as a chest inside the Thorn fight.
    expect(enemyDef('bloom_sentinel').sprite).toBe('petalWitch');
  });
});
