import { describe, expect, it } from 'vitest';
import { bossPhaseFor } from '../src/sim/enemies';
import { bossAuraTier } from '../src/view/bossAura';

describe('boss aura phase cues', () => {
  it('changes only when the boss enters a new simulation phase', () => {
    // The aura used to turn orange at 66% and red at 33%, before the sim's
    // 60% and 30% phase thresholds. A 63% boss still fought as phase 0.
    expect(bossPhaseFor(63, 100)).toBe(0);
    expect(bossAuraTier(63, 100)).toBe(1);

    expect(bossPhaseFor(60, 100)).toBe(1);
    expect(bossAuraTier(60, 100)).toBe(2);

    expect(bossPhaseFor(32, 100)).toBe(1);
    expect(bossAuraTier(32, 100)).toBe(2);

    expect(bossPhaseFor(30, 100)).toBe(2);
    expect(bossAuraTier(30, 100)).toBe(3);
  });

  it('keeps the final visual flare inside phase two', () => {
    expect(bossPhaseFor(24, 100)).toBe(2);
    expect(bossAuraTier(24, 100)).toBe(4);
  });
});
