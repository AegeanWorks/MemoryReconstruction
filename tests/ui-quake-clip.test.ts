import { describe, expect, it } from 'vitest';
import type { Room } from '../src/sim/dungeon';
import { TILE_SIZE } from '../src/sim/tiles';
import { quakeRingPoints } from '../src/view/telegraph';

const room = { x: 10, y: 10, w: 10, h: 10 } as Room;
const centre = 15 * TILE_SIZE;

describe('quake telegraph clipping', () => {
  it('keeps only the rings that land inside the arena', () => {
    const points = quakeRingPoints(centre, centre, -1, 0, room);
    expect(points).toHaveLength(2);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(room.x * TILE_SIZE);
      expect(p.x).toBeLessThanOrEqual((room.x + room.w) * TILE_SIZE);
    }
  });

  it('keeps all four rings outside a room', () => {
    expect(quakeRingPoints(centre, centre, -1, 0, undefined)).toHaveLength(4);
  });
});
