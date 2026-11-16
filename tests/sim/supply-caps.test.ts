import { describe, expect, it } from 'vitest';
import { defaultMeta } from '../../src/save/SaveStore';
import { createPlayer } from '../../src/sim/player';
import { createRun, restoreRun } from '../../src/sim/run';
import { BASE_STATS, UPGRADES, computeStats } from '../../src/sim/upgrades';
import { World } from '../../src/sim/world';

const upgrade = (id: string) => {
  const found = UPGRADES.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing upgrade ${id}`);
  return found;
};

describe('carried-supply capacities', () => {
  it('ships defaults for mana flasks, bombs and traps', () => {
    expect(BASE_STATS.maxManaFlask).toBe(3);
    expect(BASE_STATS.maxBombs).toBe(4);
    expect(BASE_STATS.maxTraps).toBe(3);
  });

  it('has a capacity skill for each supply', () => {
    for (const [id, key, step] of [
      ['mana_rack', 'maxManaFlask', 1],
      ['bomb_rig', 'maxBombs', 2],
      ['trap_kit', 'maxTraps', 2],
    ] as const) {
      const skill = upgrade(id);
      expect(skill.maxStacks).toBeGreaterThan(0);
      const before = BASE_STATS[key];
      const after = computeStats({ [id]: 1 });
      expect(after[key]).toBe(before + step);
    }
  });

  it('stacks the capacity skills up to their cap', () => {
    const stats = computeStats({ mana_rack: 3, bomb_rig: 2, trap_kit: 3 });
    expect(stats.maxManaFlask).toBe(BASE_STATS.maxManaFlask + 3);
    expect(stats.maxBombs).toBe(BASE_STATS.maxBombs + 4);
    expect(stats.maxTraps).toBe(BASE_STATS.maxTraps + 6);
  });

  it('never collects past the capacity and pays shards instead', () => {
    const world = new World(createRun(5, []));
    const p = world.player;
    p.bombs = p.stats.maxBombs;
    const shards = p.shards;
    // A bomb pickup at full rig converts to shards rather than overflowing.
    (world as unknown as { collect: (i: unknown) => boolean }).collect({
      id: 1,
      kind: 'bomb',
      x: p.x,
      y: p.y,
      amount: 2,
    });
    expect(p.bombs).toBe(p.stats.maxBombs);
    expect(p.shards).toBeGreaterThan(shards);
  });

  it('clamps a restored run to the capacity the skills allow', () => {
    const run = createRun(6, []);
    run.player.bombs = 99;
    run.player.traps = 99;
    run.player.manaPotions = 99;
    const restored = restoreRun(JSON.parse(JSON.stringify(run)))!;
    expect(restored.player.bombs).toBeLessThanOrEqual(restored.player.stats.maxBombs);
    expect(restored.player.traps).toBeLessThanOrEqual(restored.player.stats.maxTraps);
    expect(restored.player.manaPotions).toBeLessThanOrEqual(restored.player.stats.maxManaFlask);
  });

  it('starts a fresh expedition inside the caps', () => {
    const p = createPlayer(0, 0);
    expect(p.bombs).toBeLessThanOrEqual(p.stats.maxBombs);
    expect(p.traps).toBeLessThanOrEqual(p.stats.maxTraps);
    expect(p.manaPotions).toBeLessThanOrEqual(p.stats.maxManaFlask);
    expect(defaultMeta().bestiary).toEqual([]);
  });
});
