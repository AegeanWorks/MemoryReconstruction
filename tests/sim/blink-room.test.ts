import { describe, expect, it } from 'vitest';
import type { Arena } from '../../src/sim/combat';
import type { Enemy } from '../../src/sim/entities';
import { blinkLanding } from '../../src/sim/enemies';

interface RoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function fakeArena(room: RoomRect, playerX: number, playerY: number): Arena {
  return {
    grid: { isSolidAtPixel: () => false },
    rng: { range: () => 0 },
    player: { x: playerX, y: playerY },
    roomBoundsAt: (x: number, y: number) =>
      x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h
        ? room
        : undefined,
  } as unknown as Arena;
}

function fakeEnemy(): Enemy {
  return { x: 160, y: 160 } as Enemy;
}

describe('phase stalker blink landing', () => {
  it('never lands outside the active room, even when every roll points through a door', () => {
    // The player is near the east wall; angle 0 would put the landing at x=358,
    // outside the 320px room. The old code accepted that corridor point.
    const room = { x: 0, y: 0, w: 320, h: 320 };
    const arena = fakeArena(room, 300, 160);
    const landing = blinkLanding(arena, fakeEnemy());
    expect(landing.x).toBeGreaterThanOrEqual(room.x);
    expect(landing.x).toBeLessThanOrEqual(room.x + room.w);
    expect(landing.y).toBeGreaterThanOrEqual(room.y);
    expect(landing.y).toBeLessThanOrEqual(room.y + room.h);
  });

  it('still takes an inside landing when one is available', () => {
    const room = { x: 0, y: 0, w: 320, h: 320 };
    const landing = blinkLanding(fakeArena(room, 160, 160), fakeEnemy());
    expect(landing).toEqual({ x: 218, y: 160 });
  });
});
