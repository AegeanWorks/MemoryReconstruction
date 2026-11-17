/**
 * Wall hangings beside doorways: a tapestry or banner on the wall face next to
 * each door, so a room's threshold reads as a threshold and not a bare gap.
 *
 * Pure geometry only. The caller decides the odds and the art, and the renderer
 * decides how a `wall` decor layer is drawn.
 */
import type { Doorway, Room } from './dungeon';
import { TILE_SIZE } from './tiles';

/** One hanging, in world pixels with the feet-basis anchor the decor renderer uses. */
export interface WallHanging {
  x: number;
  y: number;
  prop: 'furn_tapestry' | 'furn_banner' | 'furn_rug';
  size: number;
  layer: 'wall';
  /** Mirrored art for the right-hand side of a door, so the pair frames it. */
  flip: boolean;
}

/** Which wall face a doorway sits on, as a unit step from the door into the room. */
export function doorFace(door: Doorway): { dx: number; dy: number } {
  switch (door.direction) {
    case 'north':
      return { dx: 0, dy: 1 };
    case 'south':
      return { dx: 0, dy: -1 };
    case 'east':
      return { dx: -1, dy: 0 };
    case 'west':
      return { dx: 1, dy: 0 };
  }
}

/**
 * The hanging spots for one doorway: one to each side of the opening, sitting on
 * the wall row so the cloth hangs down the face rather than standing in the room.
 */
export function hangingSpots(door: Doorway): Array<{ x: number; y: number; flip: boolean }> {
  if (door.tiles.length === 0) return [];
  const xs = door.tiles.map((t) => t.x);
  const ys = door.tiles.map((t) => t.y);
  const lo = { x: Math.min(...xs), y: Math.min(...ys) };
  const hi = { x: Math.max(...xs), y: Math.max(...ys) };
  const horizontal = lo.y === hi.y;
  const spots: Array<{ x: number; y: number; flip: boolean }> = [];
  if (horizontal) {
    // A north or south wall: hang to the left and right of the opening.
    spots.push({ x: lo.x - 1, y: lo.y, flip: false });
    spots.push({ x: hi.x + 1, y: hi.y, flip: true });
  } else {
    // An east or west wall: the wall runs vertically, so hang above and below.
    spots.push({ x: lo.x, y: lo.y - 1, flip: false });
    spots.push({ x: lo.x, y: hi.y + 1, flip: true });
  }
  return spots;
}

/**
 * The hangings for a room, one pair per doorway that rolls a hanging. `chance`
 * comes from the caller's RNG so a floor stays deterministic.
 */
export function doorHangings(
  room: Room,
  chance: (p: number) => boolean,
  props: ReadonlyArray<WallHanging['prop']> = ['furn_tapestry', 'furn_banner', 'furn_rug']
): WallHanging[] {
  const hangings: WallHanging[] = [];
  for (const door of room.doors) {
    // A start room is always dressed, so a new expedition sees the feature at once.
    if (room.kind !== 'start' && !chance(0.85)) continue;
    const prop = props[Math.abs(door.tiles[0]?.x ?? 0) % props.length];
    for (const spot of hangingSpots(door)) {
      hangings.push({
        x: (spot.x + 0.5) * TILE_SIZE,
        y: (spot.y + 0.5) * TILE_SIZE,
        prop,
        size: prop === 'furn_rug' ? 40 : 46,
        layer: 'wall',
        flip: spot.flip,
      });
    }
  }
  return hangings;
}
