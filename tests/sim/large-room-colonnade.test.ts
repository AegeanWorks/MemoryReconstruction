import { describe, expect, it } from 'vitest';
import { generateFloor, roomCentrePx } from '../../src/sim/dungeon';
import { Tile, TILE_SIZE } from '../../src/sim/tiles';

describe('colonnade in large chambers', () => {
  it('fits 200+ tile combat chambers and keeps its aisle clear', () => {
    let large = 0;
    for (let seed = 1; seed <= 200 && large < 4; seed++) {
      const floor = generateFloor(seed, 4, { roomCount: 10 });
      for (const room of floor.rooms) {
        if (room.kind !== 'combat' || room.w * room.h < 200 || room.w * room.h > 600) continue;
        const c = roomCentrePx(room);
        const cx = Math.floor(c.x / TILE_SIZE);
        const cy = Math.floor(c.y / TILE_SIZE);
        const columns = [-4, -2, 2, 4].every((dx) =>
          [-2, 2].every((dy) => floor.grid.get(cx + dx, cy + dy) === Tile.Wall)
        );
        if (!columns) continue;
        large++;
        for (let dx = -5; dx <= 5; dx++) expect(floor.grid.get(cx + dx, cy)).not.toBe(Tile.Wall);
      }
    }
    expect(large).toBeGreaterThanOrEqual(4);
  });
});
