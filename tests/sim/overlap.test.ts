import { describe, expect, it } from 'vitest';
import { generateFloor, roomAt } from '../../src/sim/dungeon';
import { TILE_SIZE, Tile } from '../../src/sim/tiles';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const SEEDS = [1, 7, 42, 1337, 98765, 4242424];

function newWorld(seed: number, depth: number): World {
  const run = createRun(seed, []);
  run.depth = depth;
  return new World(run);
}

/** Slice 1: room construction keeps objects separated and inside rooms. */
describe('room overlap separation (slice 1)', () => {
  it.each(SEEDS)('keeps furnish pillars off door and gate tiles (seed %i)', (seed) => {
    for (const depth of [0, 2, 4]) {
      const floor = generateFloor(seed, depth, { roomCount: 10 });
      for (const room of floor.rooms) {
        const blockedTiles: Array<{ x: number; y: number }> = [];
        for (const d of room.doors) blockedTiles.push(...d.tiles);
        for (const g of room.gates ?? []) blockedTiles.push(...g.tiles);
        for (const t of blockedTiles) {
          // No interior pillar wall may sit on (or adjacent to) a door/gate tile.
          // Only strictly-interior tiles are checked: perimeter-ring walls are
          // shape/frame architecture (cave bites, door frames), not furnish.
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const tx = t.x + dx;
              const ty = t.y + dy;
              if (tx <= room.x || ty <= room.y || tx >= room.x + room.w - 1 || ty >= room.y + room.h - 1)
                continue;
              // Door/gate tiles themselves are Door/Gate, not Floor; pillars are Wall.
              // The invariant: a freestanding interior pillar (walkable on all
              // four sides, i.e. furnish/prop stone) must not touch a door/gate.
              // Perimeter walls legitimately touch doors; only pillars are checked.
              if (floor.grid.get(tx, ty) === Tile.Wall) {
                const freestanding =
                  floor.grid.isWalkable(tx - 1, ty) &&
                  floor.grid.isWalkable(tx + 1, ty) &&
                  floor.grid.isWalkable(tx, ty - 1) &&
                  floor.grid.isWalkable(tx, ty + 1);
                if (!freestanding) continue;
                const touches = blockedTiles.some(
                  (b) => Math.abs(b.x - tx) + Math.abs(b.y - ty) <= 1
                );
                expect(
                  touches,
                  `seed ${seed} depth ${depth} room ${room.id} pillar at ${tx},${ty} touches door/gate`
                ).toBe(false);
              }
            }
          }
        }
      }
    }
  });

  it.each(SEEDS)('keeps every interactable inside a room on walkable floor (seed %i)', (seed) => {
    for (const depth of [0, 3, 6]) {
      const world = newWorld(seed, depth);
      for (const it of world.interactables) {
        const room = roomAt(world.floor, it.x, it.y);
        expect(room, `seed ${seed} depth ${depth} ${it.kind} at ${it.x},${it.y} outside rooms`).toBeDefined();
        const tx = Math.floor(it.x / TILE_SIZE);
        const ty = Math.floor(it.y / TILE_SIZE);
        expect(world.grid.isWalkable(tx, ty)).toBe(true);
        if (room) {
          expect(tx).toBeGreaterThanOrEqual(room.x);
          expect(tx).toBeLessThan(room.x + room.w);
          expect(ty).toBeGreaterThanOrEqual(room.y);
          expect(ty).toBeLessThan(room.y + room.h);
        }
      }
    }
  });

  it.each(SEEDS)('keeps hazards separated from interactables (seed %i)', (seed) => {
    for (const depth of [0, 4]) {
      const world = newWorld(seed, depth);
      for (const h of world.hazards) {
        for (const it of world.interactables) {
          // Mirrors addInteractable's 44px cull and spawnHazard's 44px guard.
          expect(
            Math.hypot(h.x - it.x, h.y - it.y) < 40,
            `seed ${seed} depth ${depth} hazard ${h.kind} overlaps ${it.kind}`
          ).toBe(false);
        }
      }
    }
  });
});
