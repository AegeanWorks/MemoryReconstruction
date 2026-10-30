/**
 * Upgrades offered on level-up, from chests and at shrines.
 *
 * A player's stats are always recomputed from the base values plus the count
 * of each upgrade taken, so a save only needs the counts.
 */
import type { Rng } from './rng';

export type Rarity = 'common' | 'rare' | 'epic';

export interface PlayerStats {
  maxHealth: number;
  maxMana: number;
  /** Mana per second. */
  manaRegen: number;
  /** Pixels per second. */
  moveSpeed: number;
  meleeDamage: number;
  /** Swing speed multiplier. */
  attackSpeed: number;
  critChance: number;
  critMultiplier: number;
  dashCharges: number;
  /** Seconds to recharge one dash. */
  dashRecharge: number;
  dashStrike: boolean;
  boltDamage: number;
  boltCost: number;
  boltCount: number;
  boltPierce: number;
  /** Fraction of melee damage healed. */
  lifesteal: number;
  /** Fraction of incoming damage ignored, capped below 1. */
  damageReduction: number;
  pickupRadius: number;
  maxPotions: number;
  shockwave: boolean;
  manaOnKill: number;
}

export const BASE_STATS: Readonly<PlayerStats> = {
  maxHealth: 100,
  maxMana: 60,
  manaRegen: 5,
  moveSpeed: 175,
  meleeDamage: 16,
  attackSpeed: 1,
  critChance: 0.05,
  critMultiplier: 1.75,
  dashCharges: 2,
  dashRecharge: 1.1,
  dashStrike: false,
  boltDamage: 14,
  boltCost: 18,
  boltCount: 1,
  boltPierce: 0,
  lifesteal: 0,
  damageReduction: 0,
  pickupRadius: 64,
  maxPotions: 3,
  shockwave: false,
  manaOnKill: 0,
};

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  /** Times it can be taken; offers skip maxed upgrades. */
  maxStacks: number;
  apply(stats: PlayerStats): void;
}

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'vitality',
    name: 'Vitality',
    description: '+20 max health',
    rarity: 'common',
    maxStacks: 8,
    apply: (s) => void (s.maxHealth += 20),
  },
  {
    id: 'edge',
    name: 'Keen Edge',
    description: '+18% melee damage',
    rarity: 'common',
    maxStacks: 8,
    apply: (s) => void (s.meleeDamage *= 1.18),
  },
  {
    id: 'haste',
    name: 'Quickened Arm',
    description: '+12% attack speed',
    rarity: 'common',
    maxStacks: 5,
    apply: (s) => void (s.attackSpeed *= 1.12),
  },
  {
    id: 'swift',
    name: 'Fleet Step',
    description: '+8% move speed',
    rarity: 'common',
    maxStacks: 4,
    apply: (s) => void (s.moveSpeed *= 1.08),
  },
  {
    id: 'precision',
    name: 'Precision',
    description: '+8% critical chance',
    rarity: 'common',
    maxStacks: 5,
    apply: (s) => void (s.critChance += 0.08),
  },
  {
    id: 'brutal',
    name: 'Brutality',
    description: '+40% critical damage',
    rarity: 'rare',
    maxStacks: 3,
    apply: (s) => void (s.critMultiplier += 0.4),
  },
  {
    id: 'flow',
    name: 'Mana Flow',
    description: '+15 max mana, +40% mana regen',
    rarity: 'common',
    maxStacks: 4,
    apply: (s) => {
      s.maxMana += 15;
      s.manaRegen *= 1.4;
    },
  },
  {
    id: 'bolt_power',
    name: 'Focused Bolt',
    description: '+35% bolt damage',
    rarity: 'common',
    maxStacks: 5,
    apply: (s) => void (s.boltDamage *= 1.35),
  },
  {
    id: 'bolt_split',
    name: 'Split Bolt',
    description: 'Bolts fire one extra projectile',
    rarity: 'rare',
    maxStacks: 2,
    apply: (s) => void (s.boltCount += 1),
  },
  {
    id: 'bolt_pierce',
    name: 'Piercing Bolt',
    description: 'Bolts pass through one more enemy',
    rarity: 'rare',
    maxStacks: 3,
    apply: (s) => void (s.boltPierce += 1),
  },
  {
    id: 'guard',
    name: 'Stone Skin',
    description: 'Take 10% less damage',
    rarity: 'rare',
    maxStacks: 4,
    apply: (s) => void (s.damageReduction = Math.min(0.6, s.damageReduction + 0.1)),
  },
  {
    id: 'leech',
    name: 'Memory Leech',
    description: 'Heal 4% of melee damage dealt',
    rarity: 'rare',
    maxStacks: 3,
    apply: (s) => void (s.lifesteal += 0.04),
  },
  {
    id: 'dash_charge',
    name: 'Second Step',
    description: '+1 dash charge',
    rarity: 'rare',
    maxStacks: 2,
    apply: (s) => void (s.dashCharges += 1),
  },
  {
    id: 'magnet',
    name: 'Attunement',
    description: '+60% pickup radius, dashes recharge 15% faster',
    rarity: 'common',
    maxStacks: 3,
    apply: (s) => {
      s.pickupRadius *= 1.6;
      s.dashRecharge *= 0.85;
    },
  },
  {
    id: 'flask',
    name: 'Deep Flask',
    description: '+1 potion capacity',
    rarity: 'common',
    maxStacks: 3,
    apply: (s) => void (s.maxPotions += 1),
  },
  {
    id: 'surge',
    name: 'Soul Surge',
    description: 'Kills restore 6 mana',
    rarity: 'common',
    maxStacks: 3,
    apply: (s) => void (s.manaOnKill += 6),
  },
  {
    id: 'dash_strike',
    name: 'Phantom Rush',
    description: 'Dashing through enemies damages them',
    rarity: 'epic',
    maxStacks: 1,
    apply: (s) => void (s.dashStrike = true),
  },
  {
    id: 'shockwave',
    name: 'Echo Strike',
    description: 'The third combo hit releases a shockwave',
    rarity: 'epic',
    maxStacks: 1,
    apply: (s) => void (s.shockwave = true),
  },
  {
    id: 'vigor',
    name: 'Deep Breath',
    description: '+35 max health',
    rarity: 'rare',
    maxStacks: 3,
    apply: (s) => void (s.maxHealth += 35),
  },
  {
    id: 'frenzy',
    name: 'Frenzy',
    description: '+20% attack speed',
    rarity: 'rare',
    maxStacks: 3,
    apply: (s) => void (s.attackSpeed *= 1.2),
  },
  {
    id: 'deadeye',
    name: 'Deadeye',
    description: '+12% critical chance, +25% critical damage',
    rarity: 'epic',
    maxStacks: 2,
    apply: (s) => {
      s.critChance += 0.12;
      s.critMultiplier += 0.25;
    },
  },
  {
    id: 'aegis',
    name: 'Aegis',
    description: '+8% damage reduction, +10 max health',
    rarity: 'rare',
    maxStacks: 3,
    apply: (s) => {
      s.damageReduction = Math.min(0.6, s.damageReduction + 0.08);
      s.maxHealth += 10;
    },
  },
  {
    id: 'channel',
    name: 'Channel',
    description: '+25% bolt damage, -15% bolt cost',
    rarity: 'rare',
    maxStacks: 3,
    apply: (s) => {
      s.boltDamage *= 1.25;
      s.boltCost *= 0.85;
    },
  },
  {
    id: 'siphon',
    name: 'Siphon',
    description: '+3% lifesteal, kills restore 4 mana',
    rarity: 'rare',
    maxStacks: 3,
    apply: (s) => {
      s.lifesteal += 0.03;
      s.manaOnKill += 4;
    },
  },
];

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export function upgradeDef(id: string): UpgradeDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown upgrade '${id}'`);
  return def;
}

export function computeStats(taken: Readonly<Record<string, number>>): PlayerStats {
  const stats: PlayerStats = { ...BASE_STATS };
  for (const def of UPGRADES) {
    const count = Math.min(taken[def.id] ?? 0, def.maxStacks);
    for (let i = 0; i < count; i++) def.apply(stats);
  }
  return stats;
}

const RARITY_WEIGHTS: Record<'normal' | 'generous', Record<Rarity, number>> = {
  normal: { common: 64, rare: 28, epic: 8 },
  generous: { common: 30, rare: 50, epic: 20 },
};

/** Up to `count` distinct, non-maxed upgrade ids, weighted by rarity. */
export function rollChoices(
  rng: Rng,
  taken: Readonly<Record<string, number>>,
  count = 3,
  luck: 'normal' | 'generous' = 'normal'
): string[] {
  const pool = UPGRADES.filter((u) => (taken[u.id] ?? 0) < u.maxStacks);
  const weights = RARITY_WEIGHTS[luck];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, u) => sum + weights[u.rarity], 0);
    let roll = rng.next() * total;
    let index = 0;
    for (; index < pool.length - 1; index++) {
      roll -= weights[pool[index].rarity];
      if (roll < 0) break;
    }
    picked.push(pool[index].id);
    pool.splice(index, 1);
  }
  return picked;
}
