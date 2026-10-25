/**
 * Run state: everything that carries from one floor to the next. It is plain
 * data, so saving a run is JSON.stringify and loading is JSON.parse plus
 * `restoreRun` (which recomputes derived stats).
 */
import type { Player } from './entities';
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
    stats: { kills: 0, elapsed: 0, damageDealt: 0, roomsCleared: 0 },
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
  const health = run.player.health;
  const mana = run.player.mana;
  const dash = run.player.dashCharges;
  refreshStats(run.player);
  run.player.health = Math.min(health, run.player.stats.maxHealth);
  run.player.mana = Math.min(mana, run.player.stats.maxMana);
  run.player.dashCharges = Math.min(dash, run.player.stats.dashCharges);
  run.pendingChoices = Array.isArray(run.pendingChoices) ? run.pendingChoices : [];
  return run;
}
