import { describe, expect, it } from 'vitest';
import { WALL_BOLT_OFFSETS, wallGapCenter, wallGapIndex } from '../../src/sim/enemies';

/** The curtain and its warning must agree: the guide marks the true gap. */
describe('wall-warden gap (telegraph and curtain read the same data)', () => {
  it('six bolts span the lane with 40px spacing', () => {
    expect(WALL_BOLT_OFFSETS).toEqual([-100, -60, -20, 20, 60, 100]);
  });

  it('the gap pair follows the caster id and the center is its midpoint', () => {
    for (let id = 0; id < 12; id++) {
      const gap = wallGapIndex(id);
      expect(gap).toBe(id % 4);
      expect(gap + 1).toBeLessThan(WALL_BOLT_OFFSETS.length);
      expect(wallGapCenter(id)).toBe(
        (WALL_BOLT_OFFSETS[gap] + WALL_BOLT_OFFSETS[gap + 1]) / 2
      );
    }
  });

  it('the guide moves with the caster instead of sitting at one fixed lane', () => {
    const centers = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((id) => wallGapCenter(id)));
    expect(centers.size).toBe(4);
    expect(wallGapCenter(1)).toBe(-40);
    expect(wallGapCenter(3)).toBe(40);
  });
});
