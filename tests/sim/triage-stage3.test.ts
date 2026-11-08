import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';
import { generateFloor } from '../../src/sim/dungeon';
import { floorPlan, FINAL_DEPTH } from '../../src/sim/content';

const DT = 1 / 60;

function newWorld(seed = 7, depth = 0): World {
  const run = createRun(seed, []);
  run.depth = depth;
  return new World(run);
}

describe('stage3 triaged fixes (failing-first)', () => {
  it('staggered walker cannot bomb or trap', () => {
    const w = newWorld(7, 0);
    const p = w.player;
    p.bombs = 2;
    p.traps = 1;
    p.stagger = 1.0;
    const b0 = p.bombs;
    const t0 = p.traps;
    w.step({ ...NO_INPUT, aimX: p.x + 100, aimY: p.y, bomb: true, trap: true }, DT);
    expect(p.bombs).toBe(b0);
    expect(p.traps).toBe(t0);
  });

  it('old save without dashHits gets safe defaults', async () => {
    const { restoreRun } = await import('../../src/sim/run');
    const run = createRun(99, []);
    delete (run.player as unknown as Record<string, unknown>).dashHits;
    const raw = JSON.parse(JSON.stringify(run));
    delete raw.player.dashHits;
    const restored = restoreRun(raw);
    expect(restored).toBeDefined();
    expect(Array.isArray(restored!.player.dashHits)).toBe(true);
  });

  // Volley (4 vs 5) remains FILED as deferred: its timing needs a designer
  // decision (float-dust extra shot vs suppressed final tick). Terrace
  // duplicates were fixed by ADR-108.

  it('floorPlan clamps low and high', () => {
    expect(floorPlan(-1).depth).toBe(0);
    expect(floorPlan(999).depth).toBe(FINAL_DEPTH);
  });
});
