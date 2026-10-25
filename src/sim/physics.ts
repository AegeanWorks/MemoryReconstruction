/**
 * Tile collision for actors and projectiles.
 *
 * Actors are axis-aligned boxes (half-size `radius`) for walls and circles for
 * each other. Movement resolves one axis at a time, so actors slide along
 * walls, and is sub-stepped so a dash never skips through a one-tile wall.
 */
import { TILE_SIZE, type TileGrid } from './tiles';

export interface Body {
  x: number;
  y: number;
  radius: number;
}

/** Largest distance moved per sub-step; under half a tile, so walls can't be skipped. */
const MAX_STEP = TILE_SIZE / 4;
/** Pixels a body may be shifted sideways to slip past a wall corner it barely clips. */
const CORNER_NUDGE = 8;

function overlapsSolid(grid: TileGrid, x: number, y: number, r: number): boolean {
  const x0 = Math.floor((x - r) / TILE_SIZE);
  const x1 = Math.floor((x + r - 0.001) / TILE_SIZE);
  const y0 = Math.floor((y - r) / TILE_SIZE);
  const y1 = Math.floor((y + r - 0.001) / TILE_SIZE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) if (grid.isSolid(tx, ty)) return true;
  return false;
}

/** Moves along one axis, stopping flush against the first solid tile. Returns true on contact. */
function moveAxis(grid: TileGrid, body: Body, delta: number, axis: 'x' | 'y'): boolean {
  if (delta === 0) return false;
  const next = body[axis] + delta;
  const nx = axis === 'x' ? next : body.x;
  const ny = axis === 'y' ? next : body.y;
  if (!overlapsSolid(grid, nx, ny, body.radius)) {
    body[axis] = next;
    return false;
  }
  if (slipAroundCorner(grid, body, delta, axis)) return false;
  // Snap to the tile edge the body ran into.
  const r = body.radius;
  if (delta > 0) {
    const edge = Math.floor((next + r - 0.001) / TILE_SIZE) * TILE_SIZE;
    body[axis] = Math.max(body[axis], edge - r - 0.001);
  } else {
    const edge = (Math.floor((next - r) / TILE_SIZE) + 1) * TILE_SIZE;
    body[axis] = Math.min(body[axis], edge + r);
  }
  return true;
}

/**
 * Corner correction: when a body clips a wall corner by a few pixels, shift
 * it sideways (at most |delta| per step) instead of stopping dead. Returns
 * true when it slipped.
 */
function slipAroundCorner(grid: TileGrid, body: Body, delta: number, axis: 'x' | 'y'): boolean {
  const other = axis === 'x' ? 'y' : 'x';
  for (let shift = 1; shift <= CORNER_NUDGE; shift++) {
    for (const sign of [1, -1]) {
      const side = body[other] + sign * shift;
      const ahead = body[axis] + delta;
      const sx = axis === 'x' ? ahead : side;
      const sy = axis === 'y' ? ahead : side;
      const clearAhead = !overlapsSolid(grid, sx, sy, body.radius);
      const clearSide = !overlapsSolid(
        grid,
        axis === 'x' ? body.x : side,
        axis === 'y' ? body.y : side,
        body.radius
      );
      if (clearAhead && clearSide) {
        body[other] += sign * Math.min(shift, Math.abs(delta));
        return true;
      }
    }
  }
  return false;
}

/**
 * Moves a body by (dx, dy) against the grid. Returns whether it touched a
 * wall on either axis, which callers use to stop knockback or dashes.
 */
export function moveAndCollide(grid: TileGrid, body: Body, dx: number, dy: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_STEP));
  const sx = dx / steps;
  const sy = dy / steps;
  let hit = false;
  for (let i = 0; i < steps; i++) {
    hit = moveAxis(grid, body, sx, 'x') || hit;
    hit = moveAxis(grid, body, sy, 'y') || hit;
  }
  return hit;
}

/** Pushes two overlapping circles apart; `weightA` in [0,1] is the share A moves. */
export function separate(grid: TileGrid, a: Body, b: Body, weightA = 0.5): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const min = a.radius + b.radius;
  const distSq = dx * dx + dy * dy;
  if (distSq >= min * min) return;
  const dist = Math.sqrt(distSq) || 0.01;
  const push = min - dist;
  const nx = dist > 0.01 ? dx / dist : 1;
  const ny = dist > 0.01 ? dy / dist : 0;
  moveAndCollide(grid, a, -nx * push * weightA, -ny * push * weightA);
  moveAndCollide(grid, b, nx * push * (1 - weightA), ny * push * (1 - weightA));
}

/** True when nothing solid lies on the straight segment (sampled every quarter tile). */
export function hasLineOfSight(
  grid: TileGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist / MAX_STEP);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (grid.isSolidAtPixel(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}
