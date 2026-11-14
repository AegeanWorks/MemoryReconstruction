import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, enemyDef } from '../../src/sim/content';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

describe('forest and caves gain a frail ranged native each', () => {
  it('thorn spitter is a frail forest caster', () => {
    const def = enemyDef('thorn_spitter');
    expect(def.archetype).toBe('caster');
    expect(def.maxHealth).toBeLessThanOrEqual(70);
    expect(def.attackRange).toBeGreaterThanOrEqual(200);
    expect(FLOOR_PLANS[1].roster).toContain('thorn_spitter');
  });

  it('cavern glowmoth is a frail cave caster, tougher than the first-floor slinger', () => {
    const def = enemyDef('cavern_glowmoth');
    expect(def.archetype).toBe('caster');
    expect(def.maxHealth).toBeGreaterThan(enemyDef('rubble_slinger').maxHealth);
    expect(def.maxHealth).toBeLessThanOrEqual(90);
    expect(FLOOR_PLANS[2].roster).toContain('cavern_glowmoth');
  });

  it('both spawn into a world', () => {
    const world = new World(createRun(5, []));
    for (const id of ['thorn_spitter', 'cavern_glowmoth'])
      expect(world.spawnEnemy(id, world.player.x + 100, world.player.y, -1).def.id).toBe(id);
  });
});
