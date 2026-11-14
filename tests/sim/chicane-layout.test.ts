import { describe, expect, it } from 'vitest';
import { generateFloor, roomCentrePx } from '../../src/sim/dungeon';
import { Tile, TILE_SIZE } from '../../src/sim/tiles';

describe('chicane room layout', () => {
  it('appears in combat chambers as two offset walls and never blocks the centre lanes', () => {
    let found = 0;
    for (let seed = 1; seed <= 250 && found < 3; seed++) {
      const floor = generateFloor(seed, 3, { roomCount: 9 });
      for (const room of floor.rooms) {
        if (room.kind !== 'combat') continue;
        const c = roomCentrePx(room);
        const cx = Math.floor(c.x / TILE_SIZE);
        const cy = Math.floor(c.y / TILE_SIZE);
        const wall = (dx: number, dy: number) => floor.grid.get(cx + dx, cy + dy) === Tile.Wall;
        const chicane =
          wall(-4, -2) && wall(-4, -3) && wall(4, 2) && wall(4, 3) && !wall(-4, 2) && !wall(4, -2);
        if (!chicane) continue;
        found++;
        for (let d = -5; d <= 5; d++) {
          expect(wall(d, 0), `row ${d}`).toBe(false);
          expect(wall(0, d), `col ${d}`).toBe(false);
        }
      }
    }
    expect(found).toBeGreaterThanOrEqual(3);
  });
});
