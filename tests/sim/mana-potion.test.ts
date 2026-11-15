import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun, restoreRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('mana flasks', () => {
  it('starts every walker with one flask', () => {
    expect(createRun(1, []).player.manaPotions).toBe(1);
  });

  it('drinks a flask with R, restores 60% of max mana and spends the flask', () => {
    const run = createRun(2, []);
    const world = new World(run);
    world.player.mana = 0;
    const max = world.player.stats.maxMana;
    const events = world.step({ ...NO_INPUT, manaPotion: true }, DT);
    // The flask lands first; the step's passive regeneration adds a sliver after it.
    expect(world.player.mana).toBeGreaterThanOrEqual(Math.round(max * 0.6));
    expect(world.player.mana).toBeLessThan(Math.round(max * 0.6) + 1);
    expect(world.player.manaPotions).toBe(0);
    expect(events.some((event) => event.type === 'manaPotion')).toBe(true);
  });

  it('refuses a flask at full mana and with none left', () => {
    const run = createRun(2, []);
    const world = new World(run);
    world.player.mana = world.player.stats.maxMana;
    world.step({ ...NO_INPUT, manaPotion: true }, DT);
    expect(world.player.manaPotions).toBe(1);
    world.player.mana = 0;
    world.player.manaPotions = 0;
    world.step({ ...NO_INPUT, manaPotion: true }, DT);
    // Without a flask the bar only gains the step's passive regeneration.
    expect(world.player.mana).toBeLessThan(1);
  });

  it('collects a mana pickup as another flask', () => {
    const run = createRun(2, []);
    const world = new World(run);
    const p = world.player;
    world.pickups.push({
      id: 9999,
      kind: 'mana',
      x: p.x,
      y: p.y,
      amount: 1,
      age: 1,
      vx: 0,
      vy: 0,
    });
    world.step(NO_INPUT, DT);
    expect(p.manaPotions).toBe(2);
    expect(world.pickups.some((item) => item.id === 9999)).toBe(false);
  });

  it('loads an old snapshot with the default flask and clamps nonsense', () => {
    const older = JSON.parse(JSON.stringify(createRun(8, []))) as {
      player: Record<string, unknown>;
    };
    delete older.player.manaPotions;
    expect(restoreRun(older)?.player.manaPotions).toBe(1);
    older.player.manaPotions = -3;
    expect(restoreRun(older)?.player.manaPotions).toBe(0);
  });
});
