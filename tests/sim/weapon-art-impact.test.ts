import { describe, expect, it } from 'vitest';
import { WEAPON_ART_IMPACT } from '../../src/sim/weapons';

describe('weapon art impact', () => {
  it('freezes at least as hard as a finisher swing', () => {
    // Player.updateSwing uses a 0.07s hitstop for a finisher.
    expect(WEAPON_ART_IMPACT.sword.hitstop).toBeGreaterThanOrEqual(0.07);
    expect(WEAPON_ART_IMPACT.spear.hitstop).toBeGreaterThanOrEqual(0.07);
    expect(WEAPON_ART_IMPACT.greatsword.hitstop).toBeGreaterThan(0.07);
  });
});
