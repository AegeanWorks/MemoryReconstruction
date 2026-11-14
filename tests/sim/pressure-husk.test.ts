import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, enemyDef } from '../../src/sim/content';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

describe('pressure husk', () => {
  it('is a slow abyss brute, tougher than the tide hulk', () => {
    const def = enemyDef('pressure_husk');
    expect(def.archetype).toBe('brute');
    expect(def.maxHealth).toBeGreaterThan(enemyDef('brine_hulk').maxHealth);
    expect(def.speed).toBeLessThanOrEqual(enemyDef('brine_hulk').speed);
  });

  it('joins the abyss roster and spawns', () => {
    expect(FLOOR_PLANS[8].roster).toContain('pressure_husk');
    const world = new World(createRun(3, []));
    expect(world.spawnEnemy('pressure_husk', world.player.x + 100, world.player.y, -1).def.id).toBe(
      'pressure_husk'
    );
  });
});
