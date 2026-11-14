import { describe, expect, it } from 'vitest';
import { generateFloor, roomCentrePx, type Room } from '../../src/sim/dungeon';
import { Tile, TILE_SIZE } from '../../src/sim/tiles';

/** True when a room holds the colonnade signature: columns at x +-2 and +-4, y +-2 of its centre. */
function isColonnade(grid: ReturnType<typeof generateFloor>['grid'], room: Room): boolean {
  const c = roomCentrePx(room);
  const cx = Math.floor(c.x / TILE_SIZE);
  const cy = Math.floor(c.y / TILE_SIZE);
  return [-4, -2, 2, 4].every((dx) =>
    [-2, 2].every((dy) => grid.get(cx + dx, cy + dy) === Tile.Wall)
  );
}

describe('colonnade room layout', () => {
  it('appears in ordinary combat chambers and keeps its central aisle clear', () => {
    let found = 0;
    for (let seed = 1; seed <= 150 && found < 3; seed++) {
      const floor = generateFloor(seed, 2, { roomCount: 8 });
      for (const room of floor.rooms) {
        if (room.kind !== 'combat' || !isColonnade(floor.grid, room)) continue;
        found++;
        const c = roomCentrePx(room);
        const cx = Math.floor(c.x / TILE_SIZE);
        const cy = Math.floor(c.y / TILE_SIZE);
        // The aisle between the two rows is never blocked.
        for (let dx = -5; dx <= 5; dx++) expect(floor.grid.get(cx + dx, cy)).not.toBe(Tile.Wall);
      }
    }
    expect(found).toBeGreaterThanOrEqual(3);
  });
});
