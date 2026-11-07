import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun, restoreRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function newWorld(): World {
  const world = new World(createRun(7, []));
  world.enemies.length = 0;
  world.player.weapon = 'greatsword';
  return world;
}

describe('attack input buffering', () => {
  it('starts a queued strike after the current swing ends', () => {
    const world = newWorld();
    const p = world.player;
    world.step({ ...NO_INPUT, attack: true }, DT);
    expect(p.swingTime).toBeGreaterThan(0);
    // Press late in the first swing, as a deliberate second tap would.
    for (let i = 0; i < 18; i++) world.step(NO_INPUT, DT);
    world.step({ ...NO_INPUT, attack: true }, DT);
    expect(p.attackBuffer).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) world.step(NO_INPUT, DT);
    expect(p.combo).toBe(1);
    expect(p.swingTime).toBeGreaterThan(0);
  });

  it('queues a strike pressed during a dash and swings when it lands', () => {
    const world = newWorld();
    const p = world.player;
    world.step({ ...NO_INPUT, dash: true, moveX: 1 }, DT);
    expect(p.dashTime).toBeGreaterThan(0);
    world.step({ ...NO_INPUT, attack: true }, DT);
    expect(p.attackBuffer).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) world.step(NO_INPUT, DT);
    expect(p.swingTime).toBeGreaterThan(0);
  });

  it('defaults a saved walker without an attack buffer to zero', () => {
    const raw = JSON.parse(JSON.stringify(createRun(7, []))) as {
      player: Record<string, unknown>;
    };
    delete raw.player.attackBuffer;
    const restored = restoreRun(raw);
    expect(restored?.player.attackBuffer).toBe(0);
  });
});
