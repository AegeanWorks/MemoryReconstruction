import { describe, expect, it } from 'vitest';
import type { Room } from '../src/sim/dungeon';
import { QUAKE_RADIUS } from '../src/sim/enemies';
import { TILE_SIZE } from '../src/sim/tiles';
import { quakeRingPoints } from '../src/view/telegraph';

const room = { x: 10, y: 10, w: 10, h: 10 } as Room;
const centre = 15 * TILE_SIZE;

describe('quake telegraph clipping', () => {
  it('keeps every ring whose blast reaches into the arena', () => {
    const points = quakeRingPoints(centre, centre, -1, 0, room);
    expect(points).toHaveLength(3);
    for (const p of points) {
      expect(p.x + QUAKE_RADIUS).toBeGreaterThanOrEqual(room.x * TILE_SIZE);
      expect(p.x - QUAKE_RADIUS).toBeLessThanOrEqual((room.x + room.w) * TILE_SIZE);
    }
  });

  it('drops a ring whose radius cannot reach the room', () => {
    expect(quakeRingPoints(centre - 1000, centre, -1, 0, room)).toHaveLength(0);
  });

  it('keeps all four rings outside a room', () => {
    expect(quakeRingPoints(centre, centre, -1, 0, undefined)).toHaveLength(4);
  });
});
