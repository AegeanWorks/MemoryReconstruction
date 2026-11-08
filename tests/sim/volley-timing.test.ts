import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('volley timing', () => {
  it('fires the five shots across the active phase, not one stale shot up front', () => {
    const world = new World(createRun(7, []));
    world.enemies.length = 0;
    const p = world.player;
    p.invulnerable = 9999;
    const boss = world.spawnEnemy('spirit', p.x + 200, p.y, -1, true);
    boss.state = 'attack';
    boss.attack = 'volley';
    boss.stateTime = 0.5;
    boss.cooldown = 999;

    const times: number[] = [];
    const orig = world.spawnProjectile.bind(world);
    let elapsed = 0;
    world.spawnProjectile = ((proj: Parameters<typeof orig>[0]) => {
      times.push(+elapsed.toFixed(3));
      return orig(proj);
    }) as typeof orig;
    for (let i = 0; i < 40; i++) {
      world.step(NO_INPUT, DT);
      elapsed += DT;
    }

    expect(times).toHaveLength(5);
    expect(times[0]).toBeGreaterThan(0.05);
    expect(times[4]).toBeGreaterThan(0.45);
  });
});
