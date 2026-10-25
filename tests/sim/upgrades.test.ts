import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/sim/rng';
import { BASE_STATS, UPGRADES, computeStats, rollChoices } from '../../src/sim/upgrades';

describe('upgrades', () => {
  it('derives stats from upgrade counts', () => {
    const stats = computeStats({ vitality: 2, dash_charge: 1 });
    expect(stats.maxHealth).toBe(BASE_STATS.maxHealth + 40);
    expect(stats.dashCharges).toBe(BASE_STATS.dashCharges + 1);
  });

  it('ignores stacks above the cap', () => {
    expect(computeStats({ dash_strike: 5 }).dashStrike).toBe(true);
    expect(computeStats({ dash_charge: 9 }).dashCharges).toBe(BASE_STATS.dashCharges + 2);
  });

  it('offers distinct choices and never a maxed upgrade', () => {
    const taken = { dash_strike: 1, shockwave: 1 };
    for (let seed = 0; seed < 50; seed++) {
      const options = rollChoices(new Rng(seed), taken);
      expect(new Set(options).size).toBe(3);
      expect(options).not.toContain('dash_strike');
      expect(options).not.toContain('shockwave');
    }
  });

  it('runs dry gracefully when everything is maxed', () => {
    const all = Object.fromEntries(UPGRADES.map((u) => [u.id, u.maxStacks]));
    expect(rollChoices(new Rng(1), all)).toEqual([]);
  });

  it('caps damage reduction below full immunity', () => {
    expect(computeStats({ guard: 10 }).damageReduction).toBeLessThan(1);
  });
});
