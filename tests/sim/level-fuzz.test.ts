import { describe, expect, it } from 'vitest';
import { generateFloor, roomCentrePx, type FloorMap } from '../../src/sim/dungeon';
import { Tile, TILE_SIZE } from '../../src/sim/tiles';

function reachable(floor: FloorMap): Set<number> {
  const { grid } = floor;
  const start = roomCentrePx(floor.rooms[floor.startRoom]);
  const sx = Math.floor(start.x / TILE_SIZE);
  const sy = Math.floor(start.y / TILE_SIZE);
  const seen = new Set([grid.index(sx, sy)]);
  const stack = [[sx, sy]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const i = grid.index(nx, ny);
      if (!grid.isWalkable(nx, ny) || seen.has(i)) continue;
      seen.add(i);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

describe('level fuzz beyond the named seeds', () => {
  it('keeps every non-vault room reachable and sealed from void', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const layout of [undefined, 'atoll', 'spire', 'terrace'] as const) {
        const depth = layout === 'terrace' ? 19 : 2;
        const roomCount = layout === 'terrace' ? 13 : 12;
        const floor = generateFloor(seed, depth, { roomCount, layout });
        const label = layout ?? 'default';
        const seen = reachable(floor);
        for (const room of floor.rooms) {
          if (room.sealed) continue;
          const c = roomCentrePx(room);
          const i = floor.grid.index(
            Math.floor(c.x / TILE_SIZE),
            Math.floor(c.y / TILE_SIZE)
          );
          expect(seen.has(i), `${label} seed ${seed} room ${room.id}`).toBe(true);
        }
        for (let y = 0; y < floor.grid.height; y++) {
          for (let x = 0; x < floor.grid.width; x++) {
            if (!floor.grid.isWalkable(x, y)) continue;
            const open =
              floor.grid.get(x + 1, y) === Tile.Void ||
              floor.grid.get(x - 1, y) === Tile.Void ||
              floor.grid.get(x, y + 1) === Tile.Void ||
              floor.grid.get(x, y - 1) === Tile.Void;
            expect(open, `${label} seed ${seed} leak ${x},${y}`).toBe(false);
          }
        }
      }
    }
  });
});
