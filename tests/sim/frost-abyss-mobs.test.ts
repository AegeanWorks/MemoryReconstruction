import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, enemyDef } from '../../src/sim/content';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

describe('frost and abyss rosters gain a native mob each', () => {
  it('rime thrall is a frost melee bruiser that replaces the borrowed tide drowned', () => {
    const def = enemyDef('rime_thrall');
    expect(def.archetype).toBe('melee');
    expect(def.maxHealth).toBeGreaterThan(enemyDef('ember_squire').maxHealth);
    expect(FLOOR_PLANS[10].roster).toContain('rime_thrall');
    expect(FLOOR_PLANS[10].roster).not.toContain('drowned');
  });

  it('trench lurker is an abyss ambusher that replaces the borrowed ash wisp', () => {
    const def = enemyDef('trench_lurker');
    expect(def.archetype).toBe('skirmisher');
    expect(def.behavior).toBe('ambush');
    expect(FLOOR_PLANS[8].roster).toContain('trench_lurker');
    expect(FLOOR_PLANS[8].roster).not.toContain('cinder_wisp');
  });

  it('both spawn into a world', () => {
    const world = new World(createRun(11, []));
    for (const id of ['rime_thrall', 'trench_lurker'])
      expect(world.spawnEnemy(id, world.player.x + 100, world.player.y, -1).def.id).toBe(id);
  });
});
