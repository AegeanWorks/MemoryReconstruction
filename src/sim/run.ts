/**
 * Run state: everything that carries from one floor to the next. It is plain
 * data, so saving a run is JSON.stringify and loading is JSON.parse plus
 * `restoreRun` (which recomputes derived stats).
 */
import type { Player } from './entities';
import { EQUIPMENT_SLOTS, emptyEquipment, equipmentExists } from './equipment';
import { createPlayer, refreshStats } from './player';

export type ChoiceSource = 'level' | 'chest' | 'shrine';

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
}

/** Kills in one flow streak. */
export const RESONANCE_MAX = 10;
/** Reward bonus per streak step, i.e. up to +50% XP and shards. */
export const RESONANCE_STEP = 0.05;
/** Seconds after a kill before the streak lapses. */
export const RESONANCE_WINDOW = 3;

/** XP and shard multiplier for a flow streak count. */
export function resonanceMultiplier(count: number): number {
  return 1 + Math.max(0, Math.min(RESONANCE_MAX, count)) * RESONANCE_STEP;
}

export interface RunState {
  /** Bumped when the shape changes, so old saves are rejected rather than misread. */
  version: 1;
  seed: number;
  depth: number;
  player: Player;
  stats: RunStats;
  /** Fragments found during this run. */
  fragmentsFound: string[];
  /** Fragments already owned (from earlier runs) when this run began. */
  knownFragments: string[];
  pendingChoices: UpgradeChoice[];
}

export function createRun(seed: number, knownFragments: readonly string[]): RunState {
  return {
    version: 1,
    seed: seed >>> 0,
    depth: 0,
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
    },
    fragmentsFound: [],
    knownFragments: [...knownFragments],
    pendingChoices: [],
  };
}

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.round(30 * Math.pow(1.36, level - 1));
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
  }
  const health = run.player.health;
  const mana = run.player.mana;
  const dash = run.player.dashCharges;
  // Fields added after v1 shipped default safely on older snapshots.
  run.player.weapon ??= 'sword';
  run.player.bombs ??= 0;
  run.player.traps ??= 0;
  run.player.artCooldown ??= 0;
  run.player.equipment ??= { weapon: null, armor: null, trinket: null };
  run.player.inventory ??= [];
  run.player.nextEquipmentId ??= 1;
  run.player.aspect ??= 'none';
  refreshStats(run.player);
  run.player.health = Math.min(health, run.player.stats.maxHealth);
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
  run.player.dashGrazes ??= [];
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
  run.pendingChoices = Array.isArray(run.pendingChoices) ? run.pendingChoices : [];
  // Fragment lists the world spreads into a set on entry and pushes to
  // during play; an older snapshot without them would crash on load.
  run.fragmentsFound = Array.isArray(run.fragmentsFound) ? run.fragmentsFound : [];
  run.knownFragments = Array.isArray(run.knownFragments) ? run.knownFragments : [];
  return run;
}
