/**
 * Run state: everything that carries from one floor to the next. It is plain
 * data, so saving a run is JSON.stringify and loading is JSON.parse plus
 * `restoreRun` (which recomputes derived stats).
 */
import { FINAL_DEPTH } from './content';
import type { Player } from './entities';
import { EQUIPMENT_SLOTS, emptyEquipment, equipmentExists } from './equipment';
import { createPlayer, refreshStats } from './player';
import { Rng } from './rng';
import { normalizeRage } from './rage';
import { normalizeStatus } from './status';
import { ENGAGEMENT_TUNING } from './tuning';
import { computeStats, upgradeExists } from './upgrades';
import { isWeaponId } from './weapons';

export type ChoiceSource = 'level' | 'chest' | 'shrine' | 'wayfarer';

export interface UpgradeChoice {
  source: ChoiceSource;
  options: string[];
}

export interface RunStats {
  kills: number;
  /** Seconds of simulated play. */
  elapsed: number;
  damageDealt: number;
  roomsCleared: number;
  /** Near misses rewarded during a dash. */
  grazes: number;
  /** Highest flow streak reached. */
  bestResonance: number;
  /** Variable-ratio loot surges seen. */
  surges: number;
  /** Floors restored to completion for the bonus. */
  floorsRestored: number;
  /** Section guardians defeated. */
  bossKills: number;
  /** Elite enemies defeated, for the late NPC chapters. */
  eliteKills: number;
  /** Kills landed while the walker was under 25% health (comeback fuel). */
  clutchKills: number;
  /** Colosseum battles survived to the final wave. */
  colosseumsWon: number;
  /**
   * Field-manual checklist bits, set as the walker first does each thing:
   * 1 swung, 2 bolted, 4 dashed, 8 healed, 16 equipped, 32 cleared a room.
   */
  onboarding: number;
}

/**
 * Checklist steps in display order: [bit, pointer label, touch label]. A phone has no LMB or
 * keyboard, so its manual names the on-screen control instead.
 */
export const ONBOARDING_STEPS: ReadonlyArray<readonly [number, string, string]> = [
  [1, 'Strike with LMB', 'Strike with the right stick'],
  [2, 'Fire a bolt with RMB', 'Fire a bolt with the Bolt button'],
  [4, 'Dash through danger with Space', 'Dash through danger with the Dash button'],
  [8, 'Drink a flask with Q', 'Drink a flask with the Flask button'],
  [16, 'Equip a relic with I', 'Equip a relic from the Relics button'],
  [32, 'Clear a hostile room', 'Clear a hostile room'],
];

/** First unfinished checklist step, or undefined when the manual is done. */
export function nextOnboardingStep(done: number, touch = false): string | undefined {
  for (const [bit, pointerLabel, touchLabel] of ONBOARDING_STEPS)
    if ((done & bit) === 0) return touch ? touchLabel : pointerLabel;
  return undefined;
}

/** Expedition modifier (omen / daily twist) definition. */
export interface ModifierDef {
  id: string;
  name: string;
  text: string;
}

/**
 * The modifier table both daily twists and expedition omens roll from.
 * (SaveStore re-exports this as DAILY_MODIFIERS for the daily UI.)
 */
export const MODIFIER_DEFS: readonly ModifierDef[] = [
  { id: 'ember_tide', name: 'Ember Tide', text: '+25% shards from every drop.' },
  { id: 'heavy_air', name: 'Heavy Air', text: 'Enemies hit 15% harder.' },
  { id: 'restless_dead', name: 'Restless Dead', text: 'Every wave brings one extra enemy.' },
  { id: 'keen_edge', name: 'Keen Edge', text: 'The walker deals +15% damage.' },
];

/**
 * Rolls an expedition omen from the run seed: ~20% no omen, otherwise one of
 * the four modifiers. Uses an independent stream (mixed seed) so existing
 * seeds generate identical floors with or without omens.
 */
export function rollOmen(seed: number): string | undefined {
  const rng = new Rng((seed ^ 0x6f6d656e) >>> 0);
  const roll = rng.int(0, 4);
  return roll === 0 ? undefined : MODIFIER_DEFS[roll - 1].id;
}

/** The modifier in force for a run: the daily twist wins over the omen. */
export function activeModifier(run: RunState): string | undefined {
  return run.dailyMod ?? run.omen;
}

/** Kills in one flow streak (tunable, see tuning.ts). */
export const RESONANCE_MAX = ENGAGEMENT_TUNING.resonanceMax;
/** Reward bonus per streak step, i.e. up to +50% XP and shards. */
export const RESONANCE_STEP = ENGAGEMENT_TUNING.resonanceStep;
/** Seconds after a kill before the streak lapses. */
export const RESONANCE_WINDOW = ENGAGEMENT_TUNING.resonanceWindow;

/** XP and shard multiplier for a flow streak count. */
export function resonanceMultiplier(count: number): number {
  return 1 + Math.max(0, Math.min(RESONANCE_MAX, count)) * RESONANCE_STEP;
}

/** Story hits softer and the walker hits harder; nightmare is the reverse. */
export type Difficulty = 'story' | 'normal' | 'nightmare';

export interface RunState {
  /** Bumped when the shape changes, so old saves are rejected rather than misread. */
  version: 1;
  seed: number;
  depth: number;
  /** Difficulty chosen for this expedition; old saves default to normal. */
  difficulty: Difficulty;
  /** Daily-descent key (YYYY-MM-DD) when this run is the daily challenge. */
  dailyKey?: string;
  /** Date-selected twist for the daily run (see dailyModifier). */
  dailyMod?: string;
  /**
   * Expedition omen: a daily-style twist rolled for normal runs, so every
   * expedition plays a little differently. The daily run always uses
   * `dailyMod` instead (see activeModifier). Absent on older saves.
   */
  omen?: string;
  /** Where the run ended, for the death recap (set on the lethal blow). */
  deathRoom?: string;
  /** Section (1-based) the run ended on, for the death recap. */
  deathSection?: number;
  player: Player;
  stats: RunStats;
  /** Fragments found during this run. */
  fragmentsFound: string[];
  /** Fragments already owned (from earlier runs) when this run began. */
  knownFragments: string[];
  pendingChoices: UpgradeChoice[];
  /**
   * Relic def ids carried when a checkpoint (section entrance) was reached.
   * They are copied into the Sanctuary vault when the run settles, even in
   * death; relics found after the last checkpoint are lost with the run.
   */
  bankedRelics: string[];
}

export function createRun(
  seed: number,
  knownFragments: readonly string[],
  difficulty: Difficulty = 'normal'
): RunState {
  return {
    version: 1,
    seed: seed >>> 0,
    depth: 0,
    difficulty,
    player: createPlayer(0, 0),
    stats: {
      kills: 0,
      elapsed: 0,
      damageDealt: 0,
      roomsCleared: 0,
      grazes: 0,
      bestResonance: 0,
      surges: 0,
      floorsRestored: 0,
      bossKills: 0,
      eliteKills: 0,
      clutchKills: 0,
      colosseumsWon: 0,
      onboarding: 0,
    },
    fragmentsFound: [],
    knownFragments: [...knownFragments],
    pendingChoices: [],
    bankedRelics: [],
  };
}

/** Every relic the walker is wearing or carrying right now, as def ids. */
export function carriedRelicIds(run: RunState): string[] {
  const worn = EQUIPMENT_SLOTS.map((slot) => run.player.equipment[slot]?.defId).filter(
    (id): id is string => !!id
  );
  return [...worn, ...run.player.inventory.map((item) => item.defId)];
}

/**
 * Reaching a checkpoint stores the carried relics in the Sanctuary: their
 * def ids join the run's bank, which survives death. Returns how many were
 * newly banked, so callers can tell the walker what was kept.
 */
export function bankCarriedRelics(run: RunState): number {
  const banked = new Set(run.bankedRelics);
  let fresh = 0;
  for (const defId of carriedRelicIds(run)) {
    if (!equipmentExists(defId) || banked.has(defId)) continue;
    banked.add(defId);
    fresh++;
  }
  run.bankedRelics = [...banked];
  return fresh;
}

/**
 * How many distinct relics the checkpoint bank holds, and how many different
 * relics the walker carries that a death would lose (found since the bank).
 */
export function bankSummary(run: RunState): { kept: number; atRisk: number } {
  const banked = new Set(run.bankedRelics);
  const carried = new Set(carriedRelicIds(run));
  let atRisk = 0;
  for (const defId of carried) {
    if (!banked.has(defId)) atRisk++;
  }
  return { kept: banked.size, atRisk };
}

/** XP needed to go from `level` to `level + 1`; deliberately steep: 42, 67, 108, 172, 275, ... */
export function xpForLevel(level: number): number {
  return Math.round(42 * Math.pow(1.6, level - 1));
}

/** Adds XP, queues one level-up choice per level gained, and returns levels gained. */
export function grantXp(run: RunState, amount: number, rollOptions: () => string[]): number {
  const p = run.player;
  p.xp += amount;
  let gained = 0;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    gained++;
    run.pendingChoices.push({ source: 'level', options: rollOptions() });
  }
  return gained;
}

/** Applies the first pending choice. Throws on an option that wasn't offered. */
export function applyChoice(run: RunState, upgradeId: string): void {
  const choice = run.pendingChoices[0];
  if (!choice) throw new Error('No upgrade choice is pending');
  // Everything maxed: the choice offered nothing, so dismissing it is the only option.
  if (choice.options.length === 0) {
    run.pendingChoices.shift();
    return;
  }
  if (!choice.options.includes(upgradeId)) throw new Error(`'${upgradeId}' was not offered`);
  run.pendingChoices.shift();
  const p = run.player;
  p.upgrades[upgradeId] = (p.upgrades[upgradeId] ?? 0) + 1;
  refreshStats(p);
  if (upgradeId === 'flask') p.potions = Math.min(p.stats.maxPotions, p.potions + 1);
}

/** Rebuilds derived fields after JSON.parse; returns undefined for unusable data. */
export function restoreRun(data: unknown): RunState | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const run = data as RunState;
  if (
    run.version !== 1 ||
    typeof run.seed !== 'number' ||
    !run.player ||
    typeof run.depth !== 'number'
  )
    return undefined;
  if (!run.player.upgrades || typeof run.player.health !== 'number') return undefined;
  // Depth drives the floor plan, the section label and the score. A hand-edited or truncated
  // save can carry a fractional, negative or absurd number, and 1e300 loaded fine but rendered
  // "Section 1e+300" in the HUD, so keep it to a real section.
  run.depth = Number.isFinite(run.depth)
    ? Math.max(0, Math.min(Math.floor(run.depth), FINAL_DEPTH))
    : 0;
  // A snapshot without a stats block is unusable, not just old: the sim
  // increments counters on it every frame, so reject instead of crashing.
  if (!run.stats || typeof run.stats !== 'object') return undefined;
  // Phantom relic ids (hand-edited or forward-incompatible saves) would crash
  // every equipmentDef call site — refreshStats here, then bag render, sell,
  // equip — so the load boundary drops them once instead of guarding callers.
  run.player.inventory = Array.isArray(run.player.inventory)
    ? run.player.inventory.filter((i) => i && equipmentExists(i.defId))
    : [];
  if (!run.player.equipment || typeof run.player.equipment !== 'object')
    run.player.equipment = emptyEquipment();
  for (const slot of EQUIPMENT_SLOTS) {
    const worn = run.player.equipment[slot];
    if (worn && !equipmentExists(worn.defId)) run.player.equipment[slot] = null;
    // A save written before the head slot existed has no key for it.
    else if (worn === undefined) run.player.equipment[slot] = null;
  }
  const health = run.player.health;
  const mana = run.player.mana;
  const dash = run.player.dashCharges;
  // Fields added after v1 shipped default safely on older snapshots.
  if (!isWeaponId(run.player.weapon)) run.player.weapon = 'sword';
  run.player.bombs ??= 0;
  run.player.traps ??= 0;
  run.player.artCooldown ??= 0;
  run.player.equipment ??= emptyEquipment();
  run.player.inventory ??= [];
  run.player.nextEquipmentId ??= 1;
  run.player.aspect ??= 'none';
  // refreshStats reads the saved block for its delta, so a missing one would
  // throw before the vitals below could be repaired.
  if (!run.player.stats || typeof run.player.stats !== 'object')
    run.player.stats = computeStats(run.player.upgrades);
  refreshStats(run.player);
  run.player.health = Number.isFinite(health)
    ? Math.min(health, run.player.stats.maxHealth)
    : run.player.stats.maxHealth;
  // Vitals missing or corrupt on an older snapshot refill to full instead
  // of loading as NaN, which would silently kill the dash and corrupt the HUD.
  run.player.mana = Number.isFinite(mana)
    ? Math.min(mana, run.player.stats.maxMana)
    : run.player.stats.maxMana;
  run.player.dashCharges = Number.isFinite(dash)
    ? Math.min(dash, run.player.stats.dashCharges)
    : run.player.stats.dashCharges;
  run.player.resonance ??= 0;
  run.player.resonanceTime ??= 0;
  run.player.attackBuffer ??= 0;
  run.player.boltBuffer ??= 0;
  run.player.dashBuffer ??= 0;
  run.player.dashGrazes ??= [];
  run.player.dashHits ??= [];
  run.player.stagger ??= 0;
  if (run.difficulty !== 'story' && run.difficulty !== 'nightmare') run.difficulty = 'normal';
  // Core counters the sim increments every frame and the death recap reads.
  run.stats.kills ??= 0;
  run.stats.elapsed ??= 0;
  run.stats.damageDealt ??= 0;
  run.stats.roomsCleared ??= 0;
  run.stats.grazes ??= 0;
  run.stats.bestResonance ??= 0;
  run.stats.surges ??= 0;
  run.stats.floorsRestored ??= 0;
  run.stats.bossKills ??= 0;
  run.stats.eliteKills ??= 0;
  run.stats.clutchKills ??= 0;
  run.stats.colosseumsWon ??= 0;
  run.stats.onboarding ??= 0;
  run.pendingChoices = Array.isArray(run.pendingChoices)
    ? run.pendingChoices
        .filter((choice): choice is UpgradeChoice => !!choice && Array.isArray(choice.options))
        .map((choice) => ({
          source: choice.source,
          options: choice.options.filter((id) => typeof id === 'string' && upgradeExists(id)),
        }))
    : [];
  // Fragment lists the world spreads into a set on entry and pushes to
  // during play; an older snapshot without them would crash on load.
  run.fragmentsFound = Array.isArray(run.fragmentsFound) ? run.fragmentsFound : [];
  run.knownFragments = Array.isArray(run.knownFragments) ? run.knownFragments : [];
  // A snapshot written before mana flasks existed starts with the default flask.
  run.player.manaPotions =
    typeof run.player.manaPotions === 'number' && Number.isFinite(run.player.manaPotions)
      ? Math.max(0, Math.floor(run.player.manaPotions))
      : 1;
  // Status counters arrived with the elemental pass; older snapshots are clear.
  run.player.status = normalizeStatus(run.player.status);
  run.player.rage = normalizeRage(run.player.rage);
  // A snapshot written before checkpoint banking has no bank; treat it as empty.
  run.bankedRelics = Array.isArray(run.bankedRelics)
    ? run.bankedRelics.filter((id): id is string => typeof id === 'string' && equipmentExists(id))
    : [];
  return run;
}
