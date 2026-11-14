/**
 * Sanctuary residents: each one works a short fixed route through its room, walking from one
 * station to the next and pausing to work at each. When the walker comes close the resident stops
 * and turns to them, so a conversation never chases a moving target. No randomness: a room plays
 * the same way every visit.
 */

/** A stop on a resident's route, in pixels, and how long the resident works there. */
export interface RoutePoint {
  x: number;
  y: number;
  /** Seconds spent working at this stop. */
  work: number;
}

export type ResidentPose = 'work' | 'walk' | 'attend';

export interface ResidentState {
  x: number;
  y: number;
  /** The stop being worked at, or walked toward. */
  index: number;
  /** Seconds of work left at the current stop. */
  wait: number;
  pose: ResidentPose;
  /** 1 faces right, -1 faces left. */
  facing: 1 | -1;
}

/** Pixels per second; an unhurried walk, slower than the walker. */
export const RESIDENT_SPEED = 38;
/** The resident stops for a walker this close; well beyond the talk radius. */
export const ATTEND_RADIUS = 96;

export function createResident(route: readonly RoutePoint[]): ResidentState {
  const first = route[0] ?? { x: 0, y: 0, work: 0 };
  return { x: first.x, y: first.y, index: 0, wait: first.work, pose: 'work', facing: 1 };
}

/** Advances one resident by `dt` seconds, in place. */
export function stepResident(
  state: ResidentState,
  route: readonly RoutePoint[],
  dt: number,
  walker: { x: number; y: number }
): void {
  if (Math.hypot(walker.x - state.x, walker.y - state.y) <= ATTEND_RADIUS) {
    state.pose = 'attend';
    if (walker.x !== state.x) state.facing = walker.x < state.x ? -1 : 1;
    return;
  }
  if (route.length < 2) {
    state.pose = 'work';
    return;
  }
  let left = dt;
  while (left > 0) {
    if (state.wait > 0) {
      state.pose = 'work';
      const used = Math.min(state.wait, left);
      state.wait -= used;
      left -= used;
      if (state.wait > 0) return;
      state.index = (state.index + 1) % route.length;
    }
    const target = route[state.index];
    const dx = target.x - state.x;
    const dy = target.y - state.y;
    const dist = Math.hypot(dx, dy);
    const reach = RESIDENT_SPEED * left;
    state.pose = 'walk';
    if (Math.abs(dx) > 0.5) state.facing = dx < 0 ? -1 : 1;
    if (dist > reach) {
      state.x += (dx / dist) * reach;
      state.y += (dy / dist) * reach;
      return;
    }
    state.x = target.x;
    state.y = target.y;
    left -= dist / RESIDENT_SPEED;
    state.wait = target.work;
    state.pose = 'work';
  }
}
