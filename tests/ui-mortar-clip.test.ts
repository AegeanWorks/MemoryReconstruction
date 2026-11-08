import { describe, expect, it } from 'vitest';
import type { Room } from '../src/sim/dungeon';
import { TILE_SIZE } from '../src/sim/tiles';
import { mortarRingPoints } from '../src/view/telegraph';

const room = { x: 10, y: 10, w: 10, h: 10 } as Room;
const px = 15 * TILE_SIZE;
const py = 20 * TILE_SIZE - 20;

describe('mortar telegraph clipping', () => {
  it('keeps only the mortar rings that land inside the arena', () => {
    const points = mortarRingPoints(px, py, Math.PI / 2, 40, room);
    expect(points).toHaveLength(2);
    for (const p of points) {
      expect(p.y).toBeGreaterThanOrEqual(room.y * TILE_SIZE);
      expect(p.y).toBeLessThanOrEqual((room.y + room.h) * TILE_SIZE);
    }
  });

  it('keeps a boss ring whose blast still reaches into the arena', () => {
    const points = mortarRingPoints(px, py, Math.PI / 2, 52, room);
    expect(points).toHaveLength(3);
    expect(points[2].y).toBeGreaterThan((room.y + room.h) * TILE_SIZE);
  });

  it('keeps all three rings outside a room', () => {
    expect(mortarRingPoints(px, py, Math.PI / 2, 40, undefined)).toHaveLength(3);
  });
});
