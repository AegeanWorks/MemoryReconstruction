import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, enemyDef } from '../../src/sim/content';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

describe('wax crawler', () => {
  it('is a fast skirmisher far frailer than the hive guard', () => {
    const def = enemyDef('wax_crawler');
    expect(def.archetype).toBe('skirmisher');
    expect(def.behavior).toBe('hit_and_run');
    expect(def.maxHealth).toBeLessThan(enemyDef('hive_guard').maxHealth / 2);
    expect(def.speed).toBeGreaterThan(enemyDef('hive_guard').speed);
  });

  it('joins the hive roster and spawns', () => {
    const hive = FLOOR_PLANS.find((plan) => plan.biome === 'hive');
    expect(hive?.roster).toContain('wax_crawler');
    const world = new World(createRun(4, []));
    expect(world.spawnEnemy('wax_crawler', world.player.x + 100, world.player.y, -1).def.id).toBe(
      'wax_crawler'
    );
  });
});
