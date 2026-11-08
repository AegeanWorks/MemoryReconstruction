import { describe, expect, it } from 'vitest';
import type { Enemy } from '../../src/sim/entities';
import { updateBossPhase } from '../../src/sim/enemies';

describe('boss phase transitions', () => {
  it('reports every phase crossed by one large hit', () => {
    const boss = { isBoss: true, health: 25, maxHealth: 100, phase: 0 } as Enemy;
    expect(updateBossPhase(boss)).toEqual([1, 2]);
    expect(boss.phase).toBe(2);
    expect(updateBossPhase(boss)).toEqual([]);
  });

  it('ignores non-bosses', () => {
    const mob = { isBoss: false, health: 25, maxHealth: 100, phase: 0 } as Enemy;
    expect(updateBossPhase(mob)).toEqual([]);
    expect(mob.phase).toBe(0);
  });
});
