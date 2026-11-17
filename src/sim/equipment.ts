/**
 * Equipment: run-scoped relics with one slot each. Instances are plain
 * `{ uid, defId }` records so they survive a JSON save; their stats come from
 * the data file, which keeps balance in one place.
 */
import equipmentJson from '../data/equipment.json';
import type { Rng } from './rng';
import type { PlayerStats } from './upgrades';

export type EquipmentSlot = 'weapon' | 'armor' | 'trinket' | 'head' | 'cape';
export type EquipmentRarity = 'common' | 'rare' | 'epic';

export interface EquipmentDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  description: string;
  mods: Partial<PlayerStats>;
  /** Weapon stances this relic works with; omitted means any stance. */
  restrictTo?: readonly string[];
}

export interface EquipmentItem {
  uid: number;
  defId: string;
  /** Permanent reforge ranks from the Sanctuary, 0..3. */
  rank?: number;
}

export type EquipmentSlots = Record<EquipmentSlot, EquipmentItem | null>;

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'weapon',
  'armor',
  'trinket',
  'head',
  'cape',
];
/** Carried (unequipped) relics the bag holds before pickups start selling. */
export const INVENTORY_SLOTS = 20;
/** Each reforge rank multiplies a relic's numeric mods by this fraction. */
export const REFORGE_STEP = 0.12;
export const REFORGE_MAX = 3;

export const EQUIPMENT: readonly EquipmentDef[] = (equipmentJson as { items: EquipmentDef[] })
  .items;

const BY_ID = new Map(EQUIPMENT.map((def) => [def.id, def]));

export function equipmentDef(id: string): EquipmentDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown equipment '${id}' (not in equipment.json)`);
  return def;
}

/**
 * Trust boundary for save data: every `equipmentDef` call site throws on an
 * unknown id, so snapshots are filtered through this at load and the twenty
 * render/sell/equip callers never see a phantom defId.
 */
export function equipmentExists(defId: string): boolean {
  return BY_ID.has(defId);
}

/** True when a relic may be worn with the given weapon stance. */
export function weaponAllows(def: EquipmentDef, weapon: string): boolean {
  if (!def.restrictTo || def.restrictTo.length === 0) return true;
  return def.restrictTo.includes(weapon);
}

/** Slots whose relics are live for this weapon; restricted relics fall dark. */
export function liveEquipment(
  equipped: EquipmentSlots | undefined,
  weapon: string
): EquipmentSlots | undefined {
  if (!equipped) return undefined;
  const out = emptyEquipment();
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipped[slot];
    if (item && weaponAllows(equipmentDef(item.defId), weapon)) out[slot] = item;
  }
  return out;
}

export function emptyEquipment(): EquipmentSlots {
  return { weapon: null, armor: null, trinket: null, head: null, cape: null };
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
  equipped: EquipmentSlots | undefined,
  weapon?: string
): PlayerStats {
  if (!equipped) return stats;
  // A relic locked to a stance only counts while that stance is held.
  const live = weapon === undefined ? equipped : (liveEquipment(equipped, weapon) ?? equipped);
  const out = { ...stats };
  for (const slot of EQUIPMENT_SLOTS) {
    const item = live[slot];
    if (!item) continue;
    const def = equipmentDef(item.defId);
    const scale = 1 + REFORGE_STEP * Math.max(0, Math.min(REFORGE_MAX, item.rank ?? 0));
    applyMods(out, def.mods, scale);
  }
  for (const { set, count } of activeSets(live)) {
    applyMods(out, set.two, 1);
    if (count >= 3) applyMods(out, set.three, 1);
  }
  out.damageReduction = Math.max(0, Math.min(0.65, out.damageReduction));
  out.critChance = Math.max(0, Math.min(1, out.critChance));
  out.attackSpeed = Math.max(0.4, out.attackSpeed);
  out.moveSpeed = Math.max(60, out.moveSpeed);
  out.dashRecharge = Math.max(0.25, out.dashRecharge);
  return out;
}

/** A named trio of relics; wearing two or three adds bonus mods on top of their own. */
export interface RelicSet {
  id: string;
  name: string;
  pieces: readonly string[];
  two: Partial<PlayerStats>;
  three: Partial<PlayerStats>;
}

export const RELIC_SETS: readonly RelicSet[] = [
  {
    id: 'ashforged',
    name: 'Ashforged',
    pieces: ['ember_core', 'ember_charm', 'ember_drape'],
    two: { meleeDamage: 6 },
    three: { critMultiplier: 0.25 },
  },
  {
    id: 'tidebound',
    name: 'Tidebound',
    pieces: ['tide_lens', 'tidecloak', 'crystal_mail'],
    two: { maxMana: 12 },
    three: { manaRegen: 1.5, damageReduction: 0.05 },
  },
  {
    id: 'voidwrought',
    name: 'Voidwrought',
    pieces: ['void_cleaver', 'void_shroud', 'void_mantle'],
    two: { critChance: 0.05 },
    three: { critMultiplier: 0.35, damageReduction: 0.05 },
  },
  {
    id: 'reliquary',
    name: 'Reliquary',
    pieces: ['colossus_plate', 'iron_helm', 'ember_ward'],
    two: { maxHealth: 20 },
    three: { damageReduction: 0.08 },
  },
];

const SET_BY_PIECE = new Map<string, RelicSet>();
for (const set of RELIC_SETS) for (const piece of set.pieces) SET_BY_PIECE.set(piece, set);

export function setForRelic(defId: string): RelicSet | undefined {
  return SET_BY_PIECE.get(defId);
}

/** How many pieces of this set are worn, even before the two-piece bonus starts. */
export function wornSetCount(set: RelicSet, equipped: EquipmentSlots | undefined): number {
  if (!equipped) return 0;
  const worn = new Set(
    EQUIPMENT_SLOTS.map((slot) => equipped[slot]?.defId).filter((id): id is string => !!id)
  );
  return set.pieces.filter((piece) => worn.has(piece)).length;
}

/** Every set with at least two pieces worn, and how many are worn. */
export function activeSets(
  equipped: EquipmentSlots | undefined
): Array<{ set: RelicSet; count: number }> {
  const out: Array<{ set: RelicSet; count: number }> = [];
  for (const set of RELIC_SETS) {
    const count = wornSetCount(set, equipped);
    if (count >= 2) out.push({ set, count });
  }
  return out;
}

/** The aggregate bonus a set contributes at its current worn count. */
export function setMods(equipped: EquipmentSlots | undefined): Partial<PlayerStats> {
  const out: Record<string, number> = {};
  for (const { set, count } of activeSets(equipped)) {
    const mods = count >= 3 ? [set.two, set.three] : [set.two];
    for (const block of mods) {
      for (const [key, raw] of Object.entries(block)) {
        if (typeof raw === 'number') out[key] = (out[key] ?? 0) + raw;
      }
    }
  }
  return out as Partial<PlayerStats>;
}

function applyMods(out: PlayerStats, mods: Partial<PlayerStats>, scale: number): void {
  for (const [key, raw] of Object.entries(mods)) {
    if (typeof raw !== 'number') continue;
    const value = raw * scale;
    const stat = key as keyof PlayerStats;
    const current = out[stat];
    if (typeof current !== 'number') continue;
    const next = MULTIPLICATIVE.has(stat) ? current * (1 + value) : current + value;
    (out[stat] as number) = INTEGER.has(stat) ? Math.round(next) : next;
  }
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
  let score = rarityRank(def.rarity) * 10 + (item.rank ?? 0) * 4;
  for (const value of Object.values(def.mods)) if (typeof value === 'number') score += value;
  return score;
}

/** Shards a carried relic fetches when sold mid-expedition. */
export function relicSellShards(def: EquipmentDef): number {
  return def.rarity === 'epic' ? 24 : def.rarity === 'rare' ? 14 : 8;
}
