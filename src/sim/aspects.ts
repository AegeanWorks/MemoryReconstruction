/**
 * Aspects: the permanent playstyle mark chosen at the Sanctuary Shrine.
 *
 * They live in their own module because they are part of stat derivation:
 * `refreshStats` re-applies the aspect after upgrades and equipment, so the
 * mark survives level-ups, relic swaps and a Continue from a saved run.
 * Keeping this module free of hub/player imports also avoids a cycle.
 */
import type { PlayerStats } from './upgrades';

export type AspectId = 'none' | 'ember' | 'tide' | 'stone';

export interface AspectDef {
  id: AspectId;
  name: string;
  description: string;
  /** Changes the computed starting stats for every expedition. */
  apply(stats: PlayerStats): void;
}

export const ASPECTS: readonly AspectDef[] = [
  {
    id: 'none',
    name: 'Unmarked',
    description: 'No aspect. A balanced walker with no borrowed element.',
    apply: () => void 0,
  },
  {
    id: 'ember',
    name: 'Aspect of Ember',
    description: '+15% melee damage, +3% crit chance, -10 max health.',
    apply: (s) => {
      s.meleeDamage *= 1.15;
      s.critChance += 0.03;
      s.maxHealth = Math.max(60, s.maxHealth - 10);
    },
  },
  {
    id: 'tide',
    name: 'Aspect of Tide',
    description: '+25 max mana, +25% bolt damage, -10 max health.',
    apply: (s) => {
      s.maxMana += 25;
      s.boltDamage *= 1.25;
      s.maxHealth = Math.max(60, s.maxHealth - 10);
    },
  },
  {
    id: 'stone',
    name: 'Aspect of Stone',
    description: '+25 max health, +5% damage reduction, -6% move speed.',
    apply: (s) => {
      s.maxHealth += 25;
      s.damageReduction = Math.min(0.6, s.damageReduction + 0.05);
      s.moveSpeed *= 0.94;
    },
  },
];

export function aspectDef(id: string | undefined): AspectDef {
  return ASPECTS.find((a) => a.id === id) ?? ASPECTS[0];
}

export function isAspectId(id: string): id is AspectId {
  return ASPECTS.some((a) => a.id === id);
}

/** Applies the chosen aspect to a freshly computed stat block. */
export function applyAspect(stats: PlayerStats, id: string | undefined): PlayerStats {
  const def = aspectDef(id);
  if (def.id === 'none') return stats;
  def.apply(stats);
  stats.damageReduction = Math.max(0, Math.min(0.65, stats.damageReduction));
  stats.moveSpeed = Math.max(60, stats.moveSpeed);
  return stats;
}
