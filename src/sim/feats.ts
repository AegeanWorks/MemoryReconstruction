import type { RunState } from './run';

/**
 * Feats: a permanent mastery ladder evaluated once per settled run.
 *
 * CyberPulse's literature review (ADR-002/028) shows variable rewards pull
 * players in, but settlement-evaluated achievements are what stay visible
 * after the run ends. Feats are idempotent (a set union at settlement), so
 * re-settling can never farm them, and the catalog lives in one module.
 */

export interface FeatDef {
  id: string;
  name: string;
  text: string;
}

export const FEATS: readonly FeatDef[] = [
  { id: 'first_steps', name: 'First Steps', text: 'Reach Section 2.' },
  { id: 'delver', name: 'Delver', text: 'Reach Section 8.' },
  { id: 'abyss_walker', name: 'Abyss Walker', text: 'Reach Section 15.' },
  { id: 'slayer', name: 'Slayer', text: 'Put down 500 memories across all runs.' },
  { id: 'executioner', name: 'Executioner', text: 'Defeat 4 guardians in one expedition.' },
  { id: 'restorer', name: 'Restorer', text: 'Restore a floor to its full-clear bonus.' },
  { id: 'champion', name: 'Colosseum Champion', text: 'Survive a colosseum to the final wave.' },
  { id: 'flow_master', name: 'Flow Master', text: 'Reach a 10-kill flow streak.' },
  { id: 'grazer', name: 'Ghost', text: 'Graze 25 attacks in one expedition.' },
  { id: 'surge_rider', name: 'Surge Rider', text: 'Ride 3 loot surges in one expedition.' },
  { id: 'comeback', name: 'Comeback', text: 'Land 3 clutch kills while near death.' },
  { id: 'victor', name: 'Victor', text: 'Finish the expedition. The world remembers.' },
];

export interface FeatContext {
  fragments: number;
  kills: number;
  victories: number;
  vaultSize: number;
}

/** Pure predicate pass: returns every feat id earned by this settlement. */
export function evaluateFeats(context: FeatContext, run: RunState, won: boolean): string[] {
  const earned: string[] = [];
  const s = run.stats;
  const section = run.depth + 1;
  if (section >= 2) earned.push('first_steps');
  if (section >= 8) earned.push('delver');
  if (section >= 15) earned.push('abyss_walker');
  if (context.kills >= 500) earned.push('slayer');
  if (s.bossKills >= 4) earned.push('executioner');
  if (s.floorsRestored >= 1) earned.push('restorer');
  if (s.colosseumsWon >= 1) earned.push('champion');
  if (s.bestResonance >= 10) earned.push('flow_master');
  if (s.grazes >= 25) earned.push('grazer');
  if (s.surges >= 3) earned.push('surge_rider');
  if (s.clutchKills >= 3) earned.push('comeback');
  if (won) earned.push('victor');
  return earned;
}

export interface FeatProgressContext {
  kills: number;
  bestDepth: number;
  bestResonance: number;
  victories: number;
}

/**
 * Endowed-progress preview (a Zeigarnik nudge): how close the unfinished
 * countable feats are. Per-run feats (executioner, restorer, ...) have no
 * standing progress and return undefined.
 */
export function featProgress(
  id: string,
  context: FeatProgressContext
): { current: number; target: number } | undefined {
  switch (id) {
    case 'first_steps':
      return { current: Math.min(context.bestDepth, 2), target: 2 };
    case 'delver':
      return { current: Math.min(context.bestDepth, 8), target: 8 };
    case 'abyss_walker':
      return { current: Math.min(context.bestDepth, 15), target: 15 };
    case 'slayer':
      return { current: Math.min(context.kills, 500), target: 500 };
    case 'flow_master':
      return { current: Math.min(context.bestResonance, 10), target: 10 };
    case 'victor':
      return { current: Math.min(context.victories, 1), target: 1 };
    default:
      return undefined;
  }
}

/**
 * Streak-announcer copy: names a flow streak at widening milestones so long
 * flows feel seen. Pure, so the App and the tests share the wording.
 */
export function flowMilestone(count: number): string | undefined {
  if (count === 5) return 'Flow quickens — x5';
  if (count === 10) return 'The deep notices — flow x10';
  if (count === 15) return 'Unstoppable — flow x15';
  if (count >= 20 && count % 10 === 0) return `Relentless — flow x${count}`;
  return undefined;
}

export interface ScoreBreakdown {
  total: number;
  parts: Array<{ label: string; value: number }>;
}

/**
 * Transparent run scoring (cyberpulse ADR-035): one comparable number per
 * settled run. Nightmare pays a premium, story pays a discount.
 */
export function scoreRun(run: RunState, won: boolean): ScoreBreakdown {
  const s = run.stats;
  const parts = [
    { label: 'Depth', value: (run.depth + 1) * 100 },
    { label: 'Kills', value: s.kills * 5 },
    { label: 'Guardians', value: s.bossKills * 150 },
    { label: 'Restored', value: s.floorsRestored * 200 },
    { label: 'Colosseum', value: s.colosseumsWon * 250 },
    { label: 'Clutch', value: s.clutchKills * 75 },
    { label: 'Grazes', value: s.grazes * 2 },
    { label: 'Surges', value: s.surges * 50 },
  ];
  if (won) parts.push({ label: 'Victory', value: 1000 });
  const raw = parts.reduce((sum, part) => sum + part.value, 0);
  const mult = run.difficulty === 'nightmare' ? 1.25 : run.difficulty === 'story' ? 0.8 : 1;
  return { total: Math.round(raw * mult), parts };
}
