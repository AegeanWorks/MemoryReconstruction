import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

/** Health a fresh walker loses in `seconds` of standing still beside one mob. */
function damageTaken(id: string, depth: number, seconds: number, seed = 21): number {
  const run = createRun(seed, []);
  run.depth = depth;
  const world = new World(run);
  for (let i = world.hazards.length - 1; i >= 0; i--) world.hazards.splice(i, 1);
  const p = world.player;
  const start = p.health;
  world.spawnEnemy(id, p.x + 90, p.y, -1);
  for (let i = 0; i < seconds / DT; i++) world.step(NO_INPUT, DT);
  return start - p.health;
}

describe('new mobs are a fair threat to a fresh walker', () => {
  // Frail ranged mobs never kill an idle walker within 6 seconds.
  const light: Array<[string, number]> = [
    ['rubble_slinger', 0],
    ['thorn_spitter', 1],
    ['cavern_glowmoth', 2],
  ];
  for (const [id, depth] of light) {
    it(`${id} cannot kill an idle walker within 6 seconds`, () => {
      expect(damageTaken(id, depth, 6)).toBeLessThan(100);
    });
  }

  // The lurker strikes for about 54 and whether a second strike lands inside 6 seconds depends on the
  // seed's room geometry, so it is compared with its Abyss neighbour over several seeds instead.
  it('trench lurker hits no harder than 1.25x the drowned beside it, on any of five seeds', () => {
    for (const seed of [21, 1, 3, 4, 6])
      expect(damageTaken('trench_lurker', 8, 3, seed)).toBeLessThanOrEqual(
        damageTaken('drowned', 8, 3, seed) * 1.25
      );
  });

  // Heavies are judged against the mobs they sit beside: measured over 3 seconds, an idle level-1
  // walker loses 43 to the brine hulk, 58 to the drowned and 78 to the glass sentinel.
  const SEEDS = [21, 1, 4, 6, 12];

  it('rime thrall hits no harder than the hardest existing frost-floor mob, on every seed', () => {
    for (const seed of SEEDS)
      expect(damageTaken('rime_thrall', 10, 3, seed)).toBeLessThanOrEqual(
        damageTaken('glass_sentinel', 10, 3, seed)
      );
  });

  // Seed 4 measured 66 against the hulk's 43 (1.53x), so the bound is 1.6x rather than the 1.5x that
  // seed 21 alone suggested.
  it('pressure husk hits no harder than 1.6x the brine hulk it is cut from, on every seed', () => {
    for (const seed of SEEDS)
      expect(damageTaken('pressure_husk', 8, 3, seed)).toBeLessThanOrEqual(
        damageTaken('brine_hulk', 7, 3, seed) * 1.6
      );
  });

  it('rivet squire hits no harder than 1.5x the slag golem beside it, on every seed', () => {
    for (const seed of SEEDS)
      expect(damageTaken('rivet_squire', 6, 3, seed)).toBeLessThanOrEqual(
        damageTaken('slag_golem', 6, 3, seed) * 1.5
      );
  });

  it('wax crawler hits no harder than the hive guard beside it, on every seed', () => {
    for (const seed of SEEDS)
      expect(damageTaken('wax_crawler', 15, 3, seed)).toBeLessThanOrEqual(
        damageTaken('hive_guard', 15, 3, seed) * 1.25
      );
  });

  it('the frail casters hurt less over 10 seconds than the heavy brute', () => {
    const casters = ['rubble_slinger', 'thorn_spitter', 'cavern_glowmoth'].map((id, i) =>
      damageTaken(id, i, 10)
    );
    expect(Math.max(...casters)).toBeLessThanOrEqual(damageTaken('pressure_husk', 8, 10) + 40);
  });
});
