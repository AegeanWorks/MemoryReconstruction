import type { Room } from '../sim/dungeon';
import { TILE_SIZE } from '../sim/tiles';

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
