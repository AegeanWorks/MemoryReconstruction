import type { Room } from '../sim/dungeon';
import { MORTAR_OFFSETS, QUAKE_RADIUS, wallGapCenter } from '../sim/enemies';
import { TILE_SIZE } from '../sim/tiles';

/**
 * Outward ring radius for the omnidirectional ring telegraph. `progress` is
 * normalized windup progress (0..1), so a short and a long windup breathe at
 * the same rate instead of using raw seconds.
 */
export function ringTelegraphRadius(radius: number, progress: number): number {
  return radius + 10 + Math.max(0, Math.min(1, progress)) * 30;
}

/**
 * Shorten a lane so its telegraph stops at the arena wall instead of spilling
 * into the void or the HUD. The sim's attack range is unchanged; the player
 * can only stand inside the room, so the visible lane stays honest.
 */
export function clipLaneToRoom(
  x: number,
  y: number,
  dx: number,
  dy: number,
  length: number,
  room: Room | undefined
): number {
  if (!room) return length;
  const x0 = room.x * TILE_SIZE;
  const y0 = room.y * TILE_SIZE;
  const x1 = (room.x + room.w) * TILE_SIZE;
  const y1 = (room.y + room.h) * TILE_SIZE;
  let clipped = length;
  if (dx > 0) clipped = Math.min(clipped, (x1 - x) / dx);
  else if (dx < 0) clipped = Math.min(clipped, (x0 - x) / dx);
  if (dy > 0) clipped = Math.min(clipped, (y1 - y) / dy);
  else if (dy < 0) clipped = Math.min(clipped, (y0 - y) / dy);
  return Math.max(0, clipped);
}

/**
 * Quake rings whose blast reaches into the arena. A centre just outside the
 * wall still has a 40px radius, so its warning arc belongs inside the room;
 * the telegraph layer's room mask clips the overhang.
 */
export function quakeRingPoints(
  x: number,
  y: number,
  dx: number,
  dy: number,
  room: Room | undefined
): Array<{ x: number; y: number }> {
  const points = [1, 2, 3, 4].map((i) => ({ x: x + dx * 62 * i, y: y + dy * 62 * i }));
  if (!room) return points;
  const x0 = room.x * TILE_SIZE;
  const y0 = room.y * TILE_SIZE;
  const x1 = (room.x + room.w) * TILE_SIZE;
  const y1 = (room.y + room.h) * TILE_SIZE;
  return points.filter(
    (p) =>
      p.x + QUAKE_RADIUS >= x0 &&
      p.x - QUAKE_RADIUS <= x1 &&
      p.y + QUAKE_RADIUS >= y0 &&
      p.y - QUAKE_RADIUS <= y1
  );
}

/**
 * The cyan "dive through here" tick of the wall telegraph, centered on the
 * true gap the sim leaves open. Keeping the segment here lets the test pin
 * the drawn lane instead of only the helper's math.
 */
export function wallGapGuideSegment(
  x: number,
  y: number,
  angle: number,
  enemyId: number
): { fromX: number; fromY: number; toX: number; toY: number } {
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);
  const centre = wallGapCenter(enemyId);
  return {
    fromX: x + nx * (centre - 20),
    fromY: y + ny * (centre - 20),
    toX: x + nx * (centre + 20),
    toY: y + ny * (centre + 20),
  };
}

/**
 * Mortar landing rings whose blast reaches into the arena. A centre just
 * outside the wall still has a 40-52px radius, so a boss ring can hit a
 * walker near the wall; the telegraph layer's room mask clips the overhang.
 */
export function mortarRingPoints(
  x: number,
  y: number,
  perp: number,
  radius: number,
  room: Room | undefined
): Array<{ x: number; y: number }> {
  const points = MORTAR_OFFSETS.map((offset) => ({
    x: x + Math.cos(perp) * offset,
    y: y + Math.sin(perp) * offset,
  }));
  if (!room) return points;
  const x0 = room.x * TILE_SIZE;
  const y0 = room.y * TILE_SIZE;
  const x1 = (room.x + room.w) * TILE_SIZE;
  const y1 = (room.y + room.h) * TILE_SIZE;
  return points.filter(
    (p) => p.x + radius >= x0 && p.x - radius <= x1 && p.y + radius >= y0 && p.y - radius <= y1
  );
}
