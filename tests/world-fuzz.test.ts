import { describe, expect, it } from 'vitest';
import { createRun, restoreRun, type RunState } from '../src/sim/run';
import { FINAL_DEPTH } from '../src/sim/content';
import { World } from '../src/sim/world';

/**
 * The dungeon builder reads the same untrusted snapshot as the loader, plus a seed. This fuzz pass
 * checks that every accepted snapshot can actually be turned into a playable world and stepped, not
 * merely parsed - the failure mode a real save would hit is a crash on Continue, not on load.
 */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function mutate(base: unknown, random: () => number, depth = 0): unknown {
  const weird = [null, true, 0, -1, 1e9, '', 'x', [], {}, [null], -0.5];
  if (random() < 0.05 || depth > 4) return weird[Math.floor(random() * weird.length)];
  if (Array.isArray(base)) {
    const out = base.map((v) => (random() < 0.2 ? mutate(v, random, depth + 1) : v));
    if (random() < 0.12) out.splice(Math.floor(random() * (out.length + 1)), 1);
    return out;
  }
  if (base && typeof base === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(base as Record<string, unknown>)) {
      if (random() < 0.07) continue;
      out[key] = random() < 0.18 ? mutate(value, random, depth + 1) : value;
    }
    return out;
  }
  return base;
}

/** A loaded run must survive world construction, entry, and a full second of simulated steps. */
function play(run: RunState): void {
  const world = new World(run);
  expect(world.enemies.length).toBeGreaterThanOrEqual(0);
  expect(world.floor.rooms.length).toBeGreaterThan(0);
  expect(Number.isFinite(world.player.x), 'player x').toBe(true);
  expect(Number.isFinite(world.player.y), 'player y').toBe(true);
  for (let i = 0; i < 60; i++) {
    world.step(
      {
        moveX: 0,
        moveY: 0,
        aimX: world.player.x + 10,
        aimY: world.player.y,
        attack: false,
        bolt: false,
        dash: false,
        potion: false,
        manaPotion: false,
        interact: false,
        weapon: -1,
        bomb: false,
        trap: false,
        art: false,
  rage: false,
      },
      1 / 60
    );
  }
  expect(Number.isFinite(world.player.health), 'health after steps').toBe(true);
  expect(Number.isFinite(world.run.stats.elapsed), 'elapsed after steps').toBe(true);
}

describe('world builder survives corrupted saves', () => {
  it('builds and steps 400 mutated runs without throwing', () => {
    const source = JSON.parse(JSON.stringify(createRun(4242, [], 'normal')));
    let built = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const random = rng(seed * 2654435761);
      const mutated = mutate(source, random);
      const damaged = mutated === undefined ? undefined : JSON.parse(JSON.stringify(mutated));
      const run = restoreRun(damaged);
      if (!run) continue; // a rejected snapshot is a valid outcome
      built++;
      expect(() => play(run), `seed ${seed} threw while building/stepping`).not.toThrow();
    }
    // Guard against a mutation scheme so destructive that nothing is left to test.
    expect(built, 'accepted snapshots exercised').toBeGreaterThan(200);
  });

  it('builds a world at every section depth, including the last', () => {
    for (let depth = 0; depth <= FINAL_DEPTH; depth++) {
      const run = createRun(99 + depth, [], 'normal');
      run.depth = depth;
      expect(() => play(run), `depth ${depth}`).not.toThrow();
    }
  });
});
