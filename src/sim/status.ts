/**
 * Elemental status effects: burn (damage over time), freeze (heavy slow plus a
 * shatter bonus) and mud (a lighter slow). Kept pure so the sim, the HUD and
 * the tests all read the same numbers.
 */

export type StatusId = 'burn' | 'freeze' | 'mud';

export interface StatusTimers {
  burn: number;
  freeze: number;
  mud: number;
}

export const NO_STATUS: StatusTimers = { burn: 0, freeze: 0, mud: 0 };

/** Seconds a fresh application lasts; re-applying refreshes instead of stacking. */
export const STATUS_DURATION: Record<StatusId, number> = {
  burn: 3,
  freeze: 2.2,
  mud: 3.5,
};

/** Damage per second while burning. */
export const BURN_DPS = 6;

/** Movement multipliers; the lowest wins so stacking cannot root the player. */
export const FREEZE_SLOW = 0.35;
export const MUD_SLOW = 0.6;
/** Never slow below this, so a status can never fully stop movement. */
export const MIN_MOVE_SCALE = 0.25;

/** Frost-bitten enemies take extra damage until the ice breaks. */
export const SHATTER_BONUS = 1.5;

/** Reads a saved status, tolerating older saves and junk values. */
export function normalizeStatus(raw: Partial<StatusTimers> | undefined): StatusTimers {
  const read = (value: number | undefined): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(60, value) : 0;
  return {
    burn: read(raw?.burn),
    freeze: read(raw?.freeze),
    mud: read(raw?.mud),
  };
}

/** Applies one status, refreshing its timer rather than stacking damage. */
export function applyStatus(
  status: StatusTimers,
  id: StatusId,
  seconds = STATUS_DURATION[id]
): StatusTimers {
  const next = normalizeStatus(status);
  next[id] = Math.max(next[id], Math.max(0, seconds));
  return next;
}

/** What one tick leaves behind, and how much burn damage it dealt. */
export interface StatusTick {
  status: StatusTimers;
  burnDamage: number;
}

/** Advances every timer by `dt`; burn pays damage continuously. */
export function tickStatus(status: StatusTimers, dt: number): StatusTick {
  const step = Math.max(0, Math.min(dt, 1));
  const current = normalizeStatus(status);
  const burning = current.burn > 0;
  return {
    status: {
      burn: Math.max(0, current.burn - step),
      freeze: Math.max(0, current.freeze - step),
      mud: Math.max(0, current.mud - step),
    },
    burnDamage: burning ? BURN_DPS * step : 0,
  };
}

/** Movement multiplier from the active slows. */
export function moveScale(status: StatusTimers): number {
  const current = normalizeStatus(status);
  let scale = 1;
  if (current.freeze > 0) scale = Math.min(scale, FREEZE_SLOW);
  if (current.mud > 0) scale = Math.min(scale, MUD_SLOW);
  return Math.max(MIN_MOVE_SCALE, scale);
}

/** Damage multiplier against the target's current status. */
export function damageScale(status: StatusTimers): number {
  return normalizeStatus(status).freeze > 0 ? SHATTER_BONUS : 1;
}

/** True when a hit should break the target out of its freeze. */
export function shattersOnHit(status: StatusTimers): boolean {
  return normalizeStatus(status).freeze > 0;
}

/** One short label for the HUD, or undefined when nothing is active. */
export function statusLabel(status: StatusTimers): string | undefined {
  const current = normalizeStatus(status);
  const parts: string[] = [];
  if (current.burn > 0) parts.push('Burning');
  if (current.freeze > 0) parts.push('Frozen');
  if (current.mud > 0) parts.push('Mudded');
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
