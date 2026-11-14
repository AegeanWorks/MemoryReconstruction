import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, enemyDef } from '../../src/sim/content';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

describe('rivet squire', () => {
  it('is a melee chaser lighter than the slag golem it patrols with', () => {
    const def = enemyDef('rivet_squire');
    expect(def.archetype).toBe('melee');
    expect(def.behavior).toBe('chase');
    expect(def.maxHealth).toBeLessThan(enemyDef('slag_golem').maxHealth);
    expect(def.speed).toBeGreaterThan(enemyDef('slag_golem').speed);
  });

  it('joins the foundry roster and spawns', () => {
    expect(FLOOR_PLANS[6].roster).toContain('rivet_squire');
    const world = new World(createRun(9, []));
    expect(world.spawnEnemy('rivet_squire', world.player.x + 100, world.player.y, -1).def.id).toBe(
      'rivet_squire'
    );
  });
});
