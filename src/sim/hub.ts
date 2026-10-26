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
import { rollChoices } from './upgrades';

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

/** Persisted sanctuary progress; the rest of Meta lives in SaveStore. */
export interface SanctuaryProgress {
  echoes: number;
  restorations: Readonly<Record<string, number>>;
  /** Deepest section checkpoint unlocked, as a floor depth. */
  checkpoint: number;
  /** Permanent starting relics earned from NPC quests. */
  vault?: readonly string[];
  /** Weapon chosen at the Training Yard. */
  startingWeapon?: 'sword' | 'spear' | 'greatsword';
  /** One-shot meditation boon bought before an expedition. */
  boon?: 'vitality' | 'edge' | 'flow' | null;
}

export const CHECKPOINT_STEP = 3;

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

  // Quest rewards live in a permanent vault; each expedition starts with them.
  for (const defId of progress.vault ?? []) {
    try {
      const def = equipmentDef(defId);
      const item = { uid: p.nextEquipmentId++, defId };
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
  refreshStats(p);
  p.health = p.stats.maxHealth;
  p.mana = p.stats.maxMana;
  p.potions = p.stats.maxPotions;
  p.shards = 0;
  p.resonance = 0;
  p.resonanceTime = 0;
  run.pendingChoices = [];
  return run;
}
