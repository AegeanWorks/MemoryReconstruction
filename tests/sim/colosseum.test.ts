import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { generateFloor } from '../../src/sim/dungeon';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;
const SEEDS = [1, 2, 3, 7, 42, 1337, 9001];

describe('colosseum generation', () => {
  it('places at most one colosseum per floor, and one on roomy floors', () => {
    let found = 0;
    for (const seed of SEEDS) {
      const floor = generateFloor(seed, 2, { roomCount: 10 });
      const colos = floor.rooms.filter((r) => r.kind === 'colosseum');
      expect(colos.length).toBeLessThanOrEqual(1);
      if (colos.length === 1) found++;
    }
    expect(found).toBeGreaterThan(0);
  });

  it('grows colosseums to grand halls or full 2x2-cell battlegrounds', () => {
    for (const seed of SEEDS) {
      const floor = generateFloor(seed, 2, { roomCount: 10 });
      for (const room of floor.rooms) {
        if (room.kind !== 'colosseum') continue;
        // Grand single-cell fallback is 18x12; an expanded colosseum is ~42x30.
        expect(room.w * room.h).toBeGreaterThanOrEqual(18 * 12);
        expect(room.x).toBeGreaterThanOrEqual(0);
        expect(room.y).toBeGreaterThanOrEqual(0);
        expect(room.x + room.w).toBeLessThanOrEqual(floor.grid.width);
        expect(room.y + room.h).toBeLessThanOrEqual(floor.grid.height);
        // Never merges with another room: keep a 1-tile void buffer.
        for (const other of floor.rooms) {
          if (other === room) continue;
          const overlap =
            room.x < other.x + other.w + 1 &&
            other.x < room.x + room.w + 1 &&
            room.y < other.y + other.h + 1 &&
            other.y < room.y + room.h + 1;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it('expands at least one colosseum to ~6x a grand hall across seeds', () => {
    let biggest = 0;
    for (const seed of SEEDS) {
      const floor = generateFloor(seed, 2, { roomCount: 10 });
      for (const room of floor.rooms) {
        if (room.kind === 'colosseum') biggest = Math.max(biggest, room.w * room.h);
      }
    }
    // 42x30 = 1260; grand is 216. Six times grand ~= 1296.
    expect(biggest).toBeGreaterThanOrEqual(1000);
  });
});

describe('colosseum waves', () => {
  function colosseumWorld(seed: number): { world: World; roomId: number } | undefined {
    const run = createRun(seed, []);
    run.depth = 2;
    const world = new World(run);
    const room = world.floor.rooms.find((r) => r.kind === 'colosseum');
    if (!room) return undefined;
    return { world, roomId: room.id };
  }

  it('runs six or more announced waves in the colosseum', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const found = colosseumWorld(seed);
      if (!found) continue;
      const { world, roomId } = found;
      const room = world.floor.rooms[roomId];
      // Walk the player deep inside so the doors lock and the waves begin.
      world.player.x = (room.x + room.w / 2) * 32;
      world.player.y = (room.y + room.h / 2) * 32;
      for (let i = 0; i < 5; i++) world.step(NO_INPUT, DT);
      const state = world.rooms[roomId];
      expect(state.phase).toBe('active');
      expect(state.totalWaves ?? 0).toBeGreaterThanOrEqual(6);
      expect(state.totalWaves ?? 0).toBeLessThanOrEqual(10);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('breakable crystals', () => {
  it('places at least two crystal breakables in every room', () => {
    for (const seed of SEEDS) {
      const run = createRun(seed, []);
      run.depth = 3;
      const world = new World(run);
      for (const room of world.floor.rooms) {
        // A sealed vault has no floor to hold breakables until it opens.
        if (room.sealed) continue;
        const crystals = world.hazards.filter(
          (h) => h.roomId === room.id && h.kind === 'crystal' && !h.disabled
        );
        expect(crystals.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
