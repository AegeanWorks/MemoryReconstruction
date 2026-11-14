import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, enemyDef } from '../../src/sim/content';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

describe('rubble slinger', () => {
  it('is a frail ranged caster, so the first floor has something to dodge at range', () => {
    const def = enemyDef('rubble_slinger');
    expect(def.archetype).toBe('caster');
    expect(def.behavior).toBe('ranged_support');
    expect(def.maxHealth).toBeLessThanOrEqual(60);
    expect(def.damage).toBeLessThanOrEqual(12);
    expect(def.attackRange).toBeGreaterThanOrEqual(200);
  });

  it('joins the Forgotten Ruins roster and can be spawned', () => {
    expect(FLOOR_PLANS[0].roster).toContain('rubble_slinger');
    const world = new World(createRun(7, []));
    const enemy = world.spawnEnemy('rubble_slinger', world.player.x + 120, world.player.y, -1);
    expect(enemy.def.id).toBe('rubble_slinger');
  });
});
