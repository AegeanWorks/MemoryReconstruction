/**
 * Equipment: run-scoped relics with one slot each. Instances are plain
 * `{ uid, defId }` records so they survive a JSON save; their stats come from
 * the data file, which keeps balance in one place.
 */
import equipmentJson from '../data/equipment.json';
import type { Rng } from './rng';
import type { PlayerStats } from './upgrades';

export type EquipmentSlot = 'weapon' | 'armor' | 'trinket';
export type EquipmentRarity = 'common' | 'rare' | 'epic';

export interface EquipmentDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  description: string;
  mods: Partial<PlayerStats>;
}

export interface EquipmentItem {
  uid: number;
  defId: string;
}

export type EquipmentSlots = Record<EquipmentSlot, EquipmentItem | null>;

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['weapon', 'armor', 'trinket'];

export const EQUIPMENT: readonly EquipmentDef[] = (equipmentJson as { items: EquipmentDef[] })
  .items;

const BY_ID = new Map(EQUIPMENT.map((def) => [def.id, def]));

export function equipmentDef(id: string): EquipmentDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown equipment '${id}' (not in equipment.json)`);
  return def;
}

export function emptyEquipment(): EquipmentSlots {
  return { weapon: null, armor: null, trinket: null };
}

/** Percentage stats multiply; everything else is a flat add. */
const MULTIPLICATIVE = new Set<keyof PlayerStats>(['moveSpeed', 'attackSpeed']);
const INTEGER = new Set<keyof PlayerStats>([
  'maxHealth',
  'maxMana',
  'meleeDamage',
  'boltDamage',
  'boltCost',
  'boltCount',
  'boltPierce',
  'dashCharges',
  'maxPotions',
  'pickupRadius',
  'manaOnKill',
]);

/** Applies every equipped item's mods to a stat block. */
export function applyEquipment(
  stats: PlayerStats,
  equipped: EquipmentSlots | undefined
): PlayerStats {
  if (!equipped) return stats;
  const out = { ...stats };
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipped[slot];
    if (!item) continue;
    const def = equipmentDef(item.defId);
    for (const [key, value] of Object.entries(def.mods)) {
      if (typeof value !== 'number') continue;
      const stat = key as keyof PlayerStats;
      const current = out[stat];
      if (typeof current !== 'number') continue;
      const next = MULTIPLICATIVE.has(stat) ? current * (1 + value) : current + value;
      (out[stat] as number) = INTEGER.has(stat) ? Math.round(next) : next;
    }
  }
  out.damageReduction = Math.max(0, Math.min(0.65, out.damageReduction));
  out.critChance = Math.max(0, Math.min(1, out.critChance));
  out.attackSpeed = Math.max(0.4, out.attackSpeed);
  out.moveSpeed = Math.max(60, out.moveSpeed);
  out.dashRecharge = Math.max(0.25, out.dashRecharge);
  return out;
}

/** Weighted equipment roll. Deeper sections find better relics. */
export function rollEquipment(rng: Rng, depth: number): EquipmentDef {
  const epic = Math.min(0.28, 0.03 + depth * 0.025);
  const rare = Math.min(0.52, 0.18 + depth * 0.03);
  const roll = rng.next();
  const rarity: EquipmentRarity = roll < epic ? 'epic' : roll < epic + rare ? 'rare' : 'common';
  const pool = EQUIPMENT.filter((def) => def.rarity === rarity);
  return pool.length > 0 ? rng.pick(pool) : rng.pick(EQUIPMENT);
}

export function slotFor(defId: string): EquipmentSlot {
  return equipmentDef(defId).slot;
}

export function rarityRank(rarity: EquipmentRarity): number {
  return rarity === 'epic' ? 2 : rarity === 'rare' ? 1 : 0;
}

/** A short "is this better?" score, used only by the UI. */
export function equipmentScore(item: EquipmentItem): number {
  const def = equipmentDef(item.defId);
  let score = rarityRank(def.rarity) * 10;
  for (const value of Object.values(def.mods)) if (typeof value === 'number') score += value;
  return score;
}
