import { describe, expect, it } from 'vitest';
import { createRun } from '../../src/sim/run';
import { TILE_SIZE } from '../../src/sim/tiles';
import { World } from '../../src/sim/world';

type Frame = Parameters<World['step']>[0];

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Random but deterministic play: movement, attacks, dashes, throwables and stance swaps. */
function randomFrame(random: () => number, world: World): Frame {
  const p = world.player;
  const moveAngle = random() * Math.PI * 2;
  const move = random() < 0.2 ? 0 : 1;
  const aimAngle = random() * Math.PI * 2;
  const frame: Frame = {
    moveX: Math.cos(moveAngle) * move,
    moveY: Math.sin(moveAngle) * move,
    aimX: p.x + Math.cos(aimAngle) * 120,
    aimY: p.y + Math.sin(aimAngle) * 120,
    attack: random() < 0.45,
    bolt: random() < 0.2,
    dash: random() < 0.12,
    potion: random() < 0.02,
    manaPotion: random() < 0.02,
    interact: random() < 0.01,
    weapon: random() < 0.1 ? Math.floor(random() * 3) : -1,
    bomb: random() < 0.03,
    trap: random() < 0.03,
    art: random() < 0.1,
  };
  // One frame in thirty carries a non-finite value from a hypothetical faulty device.
  if (random() < 1 / 30) {
    const keys: Array<keyof Frame> = ['moveX', 'moveY', 'aimX', 'aimY'];
    const key = keys[Math.floor(random() * keys.length)];
    (frame[key] as number) = random() < 0.5 ? Number.NaN : Number.POSITIVE_INFINITY;
  }
  return frame;
}

describe('random play stays inside the simulation invariants', () => {
  it('keeps bodies, vitals and counters finite and in bounds for 24 seeds', () => {
    let simulated = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const random = rng(seed * 2246822519);
      const world = new World(createRun(seed, [], 'normal'));
      const grid = world.grid;
      const maxX = grid.width * TILE_SIZE;
      const maxY = grid.height * TILE_SIZE;

      for (let step = 0; step < 200; step++) {
        world.step(randomFrame(random, world), 1 / 60);
        simulated++;
        const p = world.player;
        const where = `seed ${seed} step ${step}`;

        expect(Number.isFinite(p.x) && Number.isFinite(p.y), `${where}: player position`).toBe(
          true
        );
        expect(p.x > 0 && p.x < maxX && p.y > 0 && p.y < maxY, `${where}: player bounds`).toBe(
          true
        );
        expect(grid.isSolidAtPixel(p.x, p.y), `${where}: player inside a wall`).toBe(false);

        expect(Number.isFinite(p.health) && p.health >= 0, `${where}: health`).toBe(true);
        expect(p.health, `${where}: health above max`).toBeLessThanOrEqual(
          p.stats.maxHealth + 1e-6
        );
        expect(Number.isFinite(p.mana) && p.mana >= 0, `${where}: mana`).toBe(true);
        expect(Number.isFinite(p.dashCharges) && p.dashCharges >= 0, `${where}: dash`).toBe(true);
        expect(Number.isFinite(p.xp) && p.xp >= 0, `${where}: xp`).toBe(true);
        expect(Number.isFinite(p.shards) && p.shards >= 0, `${where}: shards`).toBe(true);
        expect(Number.isInteger(p.level) && p.level >= 1, `${where}: level`).toBe(true);

        for (const enemy of world.enemies) {
          expect(
            Number.isFinite(enemy.x) && Number.isFinite(enemy.y),
            `${where}: enemy position`
          ).toBe(true);
          expect(
            enemy.x > 0 && enemy.x < maxX && enemy.y > 0 && enemy.y < maxY,
            `${where}: enemy bounds`
          ).toBe(true);
          expect(Number.isFinite(enemy.health) && enemy.health >= 0, `${where}: enemy health`).toBe(
            true
          );
        }
        for (const projectile of world.projectiles)
          expect(
            Number.isFinite(projectile.x) && Number.isFinite(projectile.y),
            `${where}: projectile`
          ).toBe(true);
        for (const blast of world.blasts)
          expect(
            Number.isFinite(blast.x) && Number.isFinite(blast.y) && Number.isFinite(blast.radius),
            `${where}: blast`
          ).toBe(true);

        expect(Number.isFinite(world.run.stats.elapsed), `${where}: elapsed`).toBe(true);
        if (world.dead || world.awaitingChoice) break;
      }
    }
    // Guard against a run that ends on step one and leaves the assertions vacuous.
    expect(simulated, 'simulated steps').toBeGreaterThan(3000);
  });
});
