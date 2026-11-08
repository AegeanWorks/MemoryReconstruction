/**
 * Engagement tuning: every behavioral-economics number in one place.
 *
 * CyberPulse literature review (ADR-002) shows variable rewards, near-miss
 * tension and push-your-luck stakes only stay fair when the odds stated
 * anywhere match the odds coded everywhere. This module is the single source
 * of truth the simulation imports and the README/tests quote, so balancing
 * is data editing, not code archaeology.
 *
 * All defaults preserve the shipped behavior; changing a field changes no
 * contract, only the feel. Determinism is untouched: rolls still flow
 * through World.rng in the same order.
 */
export interface EngagementTuning {
  /** P(roll < jackpot) pays the jackpot factor. */
  surgeJackpot: number;
  /** P(roll < rich) pays the rich factor (includes the jackpot band). */
  surgeRich: number;
  /** Jackpot shard multiplier. */
  jackpotFactor: number;
  /** Rich-vein shard multiplier. */
  richFactor: number;
  /** Mana refunded per graze. */
  grazeMana: number;
  /** Dash-charge fraction refunded per graze. */
  grazeDash: number;
  /** Outer-band margin (px) for projectile grazes. */
  grazeShot: number;
  /** Extra reach (px) beyond bodies for dash grazes. */
  grazeReach: number;
  /** Kills in one flow streak before the cap. */
  resonanceMax: number;
  /** Reward bonus per streak step (max = max * step). */
  resonanceStep: number;
  /** Seconds after a kill before the streak lapses. */
  resonanceWindow: number;
  /** HP fraction at/below which a graze triggers the clutch comeback. */
  clutchThreshold: number;
  /** HP fraction below which a kill pays clutch bonus shards. */
  clutchKillThreshold: number;
  /** Flat clutch bonus shards. */
  clutchBase: number;
  /** Extra clutch shards per depth. */
  clutchPerDepth: number;
  /** Shard price of a reroll at depth 0. */
  rerollBase: number;
  /** Extra reroll price per depth. */
  rerollPerDepth: number;
  /** Fraction of max HP the sealed cache costs. */
  cacheHealthCost: number;
  /** Floor-restored bonus shards at depth 0. */
  floorBonusBase: number;
  /** Extra floor-bonus shards per depth. */
  floorBonusPerDepth: number;
  /** Flawless-room bonus shards at depth 0. */
  flawlessBase: number;
  /** Extra flawless shards per depth. */
  flawlessPerDepth: number;
}

export const ENGAGEMENT_TUNING: Readonly<EngagementTuning> = {
  surgeJackpot: 0.06,
  surgeRich: 0.24,
  jackpotFactor: 5,
  richFactor: 2.5,
  grazeMana: 8,
  grazeDash: 0.25,
  grazeShot: 18,
  grazeReach: 24,
  resonanceMax: 10,
  resonanceStep: 0.05,
  resonanceWindow: 3,
  clutchThreshold: 0.3,
  clutchKillThreshold: 0.25,
  clutchBase: 10,
  clutchPerDepth: 2,
  rerollBase: 20,
  rerollPerDepth: 10,
  cacheHealthCost: 0.2,
  floorBonusBase: 40,
  floorBonusPerDepth: 10,
  flawlessBase: 6,
  flawlessPerDepth: 3,
};

/**
 * Maximum enemies in one wave for a chamber, by interior area in tiles.
 * The old depth-only count put ~25 enemies in an 18x12 room; the room's
 * floor area now sets the ceiling so a wave can fit, read and be fought.
 */
export function enemyWaveCap(area: number, colosseum = false): number {
  const scaled = Math.floor(Math.max(0, area) / 14);
  return Math.max(4, Math.min(colosseum ? 22 : 16, scaled));
}

/** P(jackpot) as stated to players (percent). */
export function surgeJackpotPct(t = ENGAGEMENT_TUNING): number {
  return t.surgeJackpot * 100;
}

/** P(rich, non-jackpot) as stated to players (percent). */
export function surgeRichPct(t = ENGAGEMENT_TUNING): number {
  return (t.surgeRich - t.surgeJackpot) * 100;
}
