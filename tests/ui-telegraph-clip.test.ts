import { describe, expect, it } from 'vitest';
import type { Room } from '../src/sim/dungeon';
import { TILE_SIZE } from '../src/sim/tiles';
import { clipLaneToRoom } from '../src/view/telegraph';

const room = { x: 10, y: 10, w: 10, h: 10 } as Room;
const centre = 15 * TILE_SIZE;

describe('lane telegraph clipping', () => {
  it('stops a lane at the room wall instead of the void', () => {
    expect(clipLaneToRoom(centre, centre, 1, 0, 330, room)).toBe(5 * TILE_SIZE);
    expect(clipLaneToRoom(centre, centre, 0, -1, 330, room)).toBe(5 * TILE_SIZE);
  });

  it('keeps the requested length outside a room', () => {
    expect(clipLaneToRoom(centre, centre, 1, 0, 330, undefined)).toBe(330);
  });
});
