/**
 * Rage stances: a voluntary damage boost with a price.
 *
 * Frenzy hits hardest and is broken by any blow that lands. Berserker hits a
 * little softer and cannot be interrupted, so it is the safe long fight.
 */

export type RageMode = 'none' | 'frenzy' | 'berserker';

export const RAGE_DAMAGE: Record<RageMode, number> = {
  none: 1,
  frenzy: 1.6,
  berserker: 1.35,
};

/** True when a landed blow drops the stance back to none. */
export function rageEndsOnHit(mode: RageMode): boolean {
  return mode === 'frenzy';
}

/** The damage multiplier for a stance. */
export function rageDamageScale(mode: RageMode): number {
  return RAGE_DAMAGE[mode] ?? 1;
}

/** A landed blow resolves the stance after the hit. */
export function rageAfterHit(mode: RageMode): RageMode {
  return rageEndsOnHit(mode) ? 'none' : mode;
}

/** Cycles none -> frenzy -> berserker -> none, so one key reaches both. */
export function cycleRage(mode: RageMode): RageMode {
  if (mode === 'none') return 'frenzy';
  if (mode === 'frenzy') return 'berserker';
  return 'none';
}

/** Short HUD label for the active stance, or undefined when standing calm. */
export function rageLabel(mode: RageMode): string | undefined {
  if (mode === 'frenzy') return 'Frenzy';
  if (mode === 'berserker') return 'Berserker';
  return undefined;
}

/** Reads a saved stance, refusing anything the game does not define. */
export function normalizeRage(raw: unknown): RageMode {
  return raw === 'frenzy' || raw === 'berserker' ? raw : 'none';
}
