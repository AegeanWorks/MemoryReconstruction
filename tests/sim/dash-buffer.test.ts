import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun, restoreRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('dash input buffering', () => {
  it('chains a second tap while the first dash is active', () => {
    const world = new World(createRun(7, []));
    const p = world.player;
    world.enemies.length = 0;
    p.dashCharges = 2;
    world.step({ ...NO_INPUT, dash: true, moveX: 1 }, DT);
    expect(p.dashTime).toBeGreaterThan(0);
    world.step({ ...NO_INPUT, dash: true, moveX: 1 }, DT);
    expect(p.dashBuffer).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) world.step(NO_INPUT, DT);
    expect(p.dashCharges).toBeLessThan(1);
    expect(p.dashTime).toBeGreaterThan(0);
  });

  it('defaults a saved walker without a dash buffer to zero', () => {
    const raw = JSON.parse(JSON.stringify(createRun(7, []))) as {
      player: Record<string, unknown>;
    };
    delete raw.player.dashBuffer;
    const restored = restoreRun(raw);
    expect(restored?.player.dashBuffer).toBe(0);
  });
});
