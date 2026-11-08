import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun, restoreRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('bolt input during a dash', () => {
  it('queues a bolt tap and fires it when the dash ends', () => {
    const world = new World(createRun(7, []));
    const p = world.player;
    world.enemies.length = 0;
    p.mana = 100;
    p.boltCooldown = 0;
    world.step({ ...NO_INPUT, dash: true, moveX: 1 }, DT);
    expect(p.dashTime).toBeGreaterThan(0);
    world.step({ ...NO_INPUT, bolt: true }, DT);
    expect(p.boltBuffer).toBeGreaterThan(0);
    for (let i = 0; i < 25; i++) world.step(NO_INPUT, DT);
    expect(world.projectiles.length).toBeGreaterThan(0);
    expect(p.boltBuffer).toBe(0);
  });

  it('defaults a saved walker without a bolt buffer to zero', () => {
    const raw = JSON.parse(JSON.stringify(createRun(7, []))) as {
      player: Record<string, unknown>;
    };
    delete raw.player.boltBuffer;
    const restored = restoreRun(raw);
    expect(restored?.player.boltBuffer).toBe(0);
  });
});
