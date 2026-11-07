import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('boss add cap', () => {
  it('caps swarm adds at MAX_SUMMONS', () => {
    const run = createRun(20261107, []);
    run.depth = 5;
    const w = new World(run);
    w.player.invulnerable = 9999;

    // Let the boss-only trial spawn its guardian.
    for (let i = 0; i < 180 && !w.enemies.some((e) => e.isBoss); i++) w.step(NO_INPUT, DT);
    expect(w.enemies.some((e) => e.isBoss)).toBe(true);

    // Stand still and let the choir cycle through its patterns. Its swarm
    // pattern must respect the same add cap as the summon pattern.
    for (let i = 0; i < 1800; i++) w.step(NO_INPUT, DT);

    const adds = w.enemies.filter((e) => !e.isBoss && e.state !== 'dying').length;
    expect(adds).toBeLessThanOrEqual(4);
  });
});
