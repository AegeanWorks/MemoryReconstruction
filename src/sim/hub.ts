/**
 * The Sanctuary between expeditions: the meta-progression domain.
 *
 * Everything here is pure data and deterministic helpers. The hub UI reads
 * restoration definitions and prices; the App spends echoes into the meta and
 * builds a fresh RunState at a checkpoint. Gains are banked as echoes at the
 * end of an expedition, and echoes rebuild the Sanctuary, whose restorations
 * are permanent starting bonuses.
 */
import { FLOOR_PLANS } from './content';
import { equipmentDef } from './equipment';
import { refreshStats } from './player';
import { Rng } from './rng';
import { createRun, type RunState } from './run';
import { isAspectId, type AspectId } from './aspects';
import { rollChoices } from './upgrades';

export {
  ASPECTS,
  aspectDef,
  applyAspect,
  isAspectId,
  type AspectDef,
  type AspectId,
} from './aspects';

/** A structure the player can rebuild; each level grants starting upgrades. */
export interface RestorationDef {
  id: string;
  name: string;
  cost: number;
  maxLevel: number;
  description: string;
  lore: string;
  /** Upgrade id granted per level, applied as free starting stacks. */
  upgrade: string;
  perLevel: number;
}

export const RESTORATIONS: readonly RestorationDef[] = [
  {
    id: 'hearth',
    name: 'The Hearth',
    cost: 20,
    maxLevel: 2,
    description: '+20 max health per level',
    lore: 'Stones that remembered warmth. The first thing rebuilt is the fire.',
    upgrade: 'vitality',
    perLevel: 1,
  },
  {
    id: 'armory',
    name: 'The Armory',
    cost: 25,
    maxLevel: 2,
    description: '+18% melee damage per level',
    lore: 'Racks for the blades walkers carried home and never spoke about.',
    upgrade: 'edge',
    perLevel: 1,
  },
  {
    id: 'infirmary',
    name: 'The Infirmary',
    cost: 20,
    maxLevel: 2,
    description: '+1 potion capacity per level',
    lore: 'Where the wounds of remembering are dressed and sent back out.',
    upgrade: 'flask',
    perLevel: 1,
  },
  {
    id: 'wellspring',
    name: 'The Wellspring',
    cost: 20,
    maxLevel: 2,
    description: '+15 max mana and faster regeneration per level',
    lore: 'The old water still holds the shape of a sky nobody remembers.',
    upgrade: 'flow',
    perLevel: 1,
  },
  {
    id: 'watchtower',
    name: 'The Watchtower',
    cost: 30,
    maxLevel: 1,
    description: '+8% critical chance',
    lore: 'From the top, walkers can see which memory is missing before it is gone.',
    upgrade: 'precision',
    perLevel: 1,
  },
  {
    id: 'bulwark',
    name: 'The Bulwark',
    cost: 35,
    maxLevel: 2,
    description: 'Take 10% less damage per level',
    lore: 'The wall that keeps the void out while the sanctuary sleeps.',
    upgrade: 'guard',
    perLevel: 1,
  },
  {
    id: 'vault',
    name: 'The Vault',
    cost: 25,
    maxLevel: 1,
    description: '+60% pickup radius, dashes recharge 15% faster',
    lore: 'What the walkers bring back is kept here until the sanctuary can use it.',
    upgrade: 'magnet',
    perLevel: 1,
  },
];

export const TOTAL_RESTORATION_LEVELS = RESTORATIONS.reduce((sum, r) => sum + r.maxLevel, 0);

/** Everything the Sanctuary persists between expeditions. */
export interface SanctuaryProgress {
  echoes: number;
  restorations: Readonly<Record<string, number>>;
  /** Deepest section checkpoint unlocked, as a floor depth. */
  checkpoint: number;
  /** Permanent starting relics earned from NPC quests. */
  vault?: readonly string[];
  /** Relic attuned at the Reliquary; equipped first when an expedition starts. */
  attunedRelic?: string | null;
  /** Shard offerings banked at the Cairn, consumed by the next expedition. */
  offerings?: number;
  /** Weapon chosen at the Training Yard. */
  startingWeapon?: 'sword' | 'spear' | 'greatsword';
  /** One-shot meditation boon bought before an expedition. */
  boon?: 'vitality' | 'edge' | 'flow' | null;
  /** Playstyle aspect chosen at the Shrine. */
  aspect?: AspectId;
  /** Permanent reforge ranks per vault relic id, 0..3. */
  relicRanks?: Readonly<Record<string, number>>;
}

/** Sets the aspect; unknown ids are refused rather than silently stored. */
export function chooseAspect(
  progress: SanctuaryProgress,
  id: string
): SanctuaryProgress | undefined {
  if (!isAspectId(id)) return undefined;
  return { ...progress, aspect: id };
}

export const CHECKPOINT_STEP = 3;
/** Echoes to fully heal the saved expedition at a given depth. */
export function restCost(depth: number): number {
  return 10 + Math.max(0, Math.floor(depth)) * 2;
}
/** Echoes per shard offering at the Cairn. */
export const CAIRN_COST = 20;
/** Offerings that can be banked before setting out. */
export const CAIRN_MAX = 3;
/** Starting shards each offering grants. */
export const CAIRN_SHARDS = 45;
/** Echoes per reforge step, indexed by the relic's current rank. */
export const REFORGE_COSTS = [30, 60, 100] as const;
export const REFORGE_RANKS = REFORGE_COSTS.length;

/** Offerings currently banked, clamped to the allowed range. */
export function cairnOfferings(progress: SanctuaryProgress): number {
  return Math.max(0, Math.min(CAIRN_MAX, Math.floor(progress.offerings ?? 0)));
}

/** Echoes to leave the next offering, or undefined when the cairn is full. */
export function cairnCost(progress: SanctuaryProgress): number | undefined {
  return cairnOfferings(progress) >= CAIRN_MAX ? undefined : CAIRN_COST;
}

/** Banks one offering; returns the new progress, or undefined when unaffordable/full. */
export function purchaseOffering(progress: SanctuaryProgress): SanctuaryProgress | undefined {
  const cost = cairnCost(progress);
  if (cost === undefined || progress.echoes < cost) return undefined;
  return {
    ...progress,
    echoes: progress.echoes - cost,
    offerings: cairnOfferings(progress) + 1,
  };
}

/** Consumes every banked offering, as the expedition that took them has begun. */
export function clearOfferings(progress: SanctuaryProgress): SanctuaryProgress {
  if (cairnOfferings(progress) === 0) return progress;
  return { ...progress, offerings: 0 };
}

/** Reforge rank of a vault relic, clamped to the legal range. */
export function relicRank(progress: SanctuaryProgress, defId: string): number {
  const raw = Math.floor(progress.relicRanks?.[defId] ?? 0);
  return Math.max(0, Math.min(REFORGE_RANKS, raw));
}

/** Echoes to reinforce one relic, or undefined when maxed or not owned. */
export function reforgeCost(progress: SanctuaryProgress, defId: string): number | undefined {
  if (!(progress.vault ?? []).includes(defId)) return undefined;
  const rank = relicRank(progress, defId);
  if (rank >= REFORGE_RANKS) return undefined;
  return REFORGE_COSTS[rank];
}

/**
 * Permanently reinforces one vault relic. Ranks multiply its numeric mods, so
 * the Forge turns a long echo surplus into a stronger starting relic.
 */
export function reforgeRelic(
  progress: SanctuaryProgress,
  defId: string
): SanctuaryProgress | undefined {
  const cost = reforgeCost(progress, defId);
  if (cost === undefined || progress.echoes < cost) return undefined;
  const rank = relicRank(progress, defId) + 1;
  return {
    ...progress,
    echoes: progress.echoes - cost,
    relicRanks: { ...(progress.relicRanks ?? {}), [defId]: rank },
  };
}

/**
 * Attunes one owned relic as the guaranteed first pick. The relic must already
 * be in the vault, so the Reliquary cannot mint gear.
 */
export function attuneRelic(
  progress: SanctuaryProgress,
  defId: string | null
): SanctuaryProgress | undefined {
  if (defId === null) return { ...progress, attunedRelic: null };
  if (!(progress.vault ?? []).includes(defId)) return undefined;
  return { ...progress, attunedRelic: defId };
}

/** Sections that can be started directly: every third one, plus the last. */
export function checkpointDepths(): number[] {
  const last = FLOOR_PLANS.length - 1;
  const depths: number[] = [];
  for (let depth = 0; depth <= last; depth += CHECKPOINT_STEP) depths.push(depth);
  if (depths[depths.length - 1] !== last) depths.push(last);
  return depths;
}

/** The deepest checkpoint at or before `depth`. */
export function checkpointForDepth(depth: number): number {
  const last = FLOOR_PLANS.length - 1;
  const clamped = Math.max(0, Math.min(depth, last));
  let best = 0;
  for (const checkpoint of checkpointDepths()) if (checkpoint <= clamped) best = checkpoint;
  return best;
}

/** One-based section number for a floor depth. */
export function sectionNumber(depth: number): number {
  return Math.max(1, Math.min(depth, FLOOR_PLANS.length - 1) + 1);
}

/** Echoes banked when an expedition ends: half the unspent shards plus bonuses. */
export function echoesEarned(run: RunState, won: boolean): number {
  return Math.floor(run.player.shards / 2) + run.stats.floorsRestored * 5 + (won ? 60 : 0);
}

export function restorationLevel(progress: SanctuaryProgress, id: string): number {
  const def = RESTORATIONS.find((r) => r.id === id);
  if (!def) return 0;
  return Math.max(0, Math.min(def.maxLevel, Math.floor(progress.restorations[id] ?? 0)));
}

/** Echoes needed for the next level of a structure, or undefined when maxed. */
export function nextRestorationCost(progress: SanctuaryProgress, id: string): number | undefined {
  const def = RESTORATIONS.find((r) => r.id === id);
  if (!def) return undefined;
  const level = restorationLevel(progress, id);
  return level >= def.maxLevel ? undefined : def.cost;
}

/** Buys one level; returns the new progress, or undefined when unaffordable or maxed. */
export function purchaseRestoration(
  progress: SanctuaryProgress,
  id: string
): SanctuaryProgress | undefined {
  const cost = nextRestorationCost(progress, id);
  if (cost === undefined || progress.echoes < cost) return undefined;
  return {
    ...progress,
    echoes: progress.echoes - cost,
    restorations: {
      ...progress.restorations,
      [id]: restorationLevel(progress, id) + 1,
    },
  };
}

/** How many levels of everything the player has rebuilt. */
export function restoredLevels(progress: SanctuaryProgress): number {
  return RESTORATIONS.reduce((sum, r) => sum + restorationLevel(progress, r.id), 0);
}

/**
 * Builds a fresh expedition. Restorations are free starting upgrades; starting
 * from a later checkpoint grants two vestige upgrades per section skipped and
 * raises the starting level, so a deep start is playable rather than a trap.
 */
export function createExpedition(
  seed: number,
  knownFragments: readonly string[],
  startDepth: number,
  progress: SanctuaryProgress
): RunState {
  const run = createRun(seed, knownFragments);
  run.depth = Math.max(0, Math.min(startDepth, FLOOR_PLANS.length - 1));
  const p = run.player;

  for (const def of RESTORATIONS) {
    const level = restorationLevel(progress, def.id);
    if (level > 0) p.upgrades[def.upgrade] = (p.upgrades[def.upgrade] ?? 0) + level * def.perLevel;
  }

  const vestige = run.depth * 2;
  const rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
  for (let i = 0; i < vestige; i++) {
    const [id] = rollChoices(rng, p.upgrades, 1);
    if (!id) break;
    p.upgrades[id] = (p.upgrades[id] ?? 0) + 1;
  }

  // Quest rewards live in a permanent vault; each expedition starts with them,
  // with the attuned relic equipped before the rest so its slot is reserved.
  const vault = progress.vault ?? [];
  const attuned = progress.attunedRelic;
  const ordered =
    attuned && vault.includes(attuned) ? [attuned, ...vault.filter((id) => id !== attuned)] : vault;
  for (const defId of ordered) {
    try {
      const def = equipmentDef(defId);
      const item = { uid: p.nextEquipmentId++, defId, rank: relicRank(progress, defId) };
      if (!p.equipment[def.slot]) p.equipment[def.slot] = item;
      else p.inventory.push(item);
    } catch {
      // Unknown id in an old save: ignore rather than break the expedition.
    }
  }

  if (progress.startingWeapon) p.weapon = progress.startingWeapon;
  if (progress.boon === 'vitality') p.upgrades.vitality = (p.upgrades.vitality ?? 0) + 1;
  if (progress.boon === 'edge') p.upgrades.edge = (p.upgrades.edge ?? 0) + 1;
  if (progress.boon === 'flow') p.upgrades.flow = (p.upgrades.flow ?? 0) + 1;

  p.level = 1 + run.depth * 2;
  p.xp = 0;
  p.aspect = progress.aspect ?? 'none';
  refreshStats(p);
  p.health = p.stats.maxHealth;
  p.mana = p.stats.maxMana;
  p.potions = p.stats.maxPotions;
  // The Cairn's banked offerings are spent shards, not saved echoes.
  p.shards = cairnOfferings(progress) * CAIRN_SHARDS;
  p.resonance = 0;
  p.resonanceTime = 0;
  run.pendingChoices = [];
  return run;
}
