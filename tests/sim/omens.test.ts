import { describe, expect, it } from 'vitest';
import { createRun, rollOmen, activeModifier, MODIFIER_DEFS } from '../../src/sim/run';
import { createExpedition } from '../../src/sim/hub';
import { defaultMeta } from '../../src/save/SaveStore';
import { roomCentrePx } from '../../src/sim/dungeon';
import { World } from '../../src/sim/world';
import { NO_INPUT } from '../../src/sim/entities';

/** Slice 4: expedition omens — daily-style twists for normal runs. */
describe('expedition omens', () => {
  it('rolls deterministically from the seed', () => {
    expect(rollOmen(12345)).toBe(rollOmen(12345));
    expect(rollOmen(1)).toBe(rollOmen(1));
  });

  it('covers all outcomes (none + every modifier) across seeds', () => {
    const seen = new Set<string | undefined>();
    for (let seed = 0; seed < 500; seed++) seen.add(rollOmen(seed));
    expect(seen.has(undefined)).toBe(true);
    for (const def of MODIFIER_DEFS) expect(seen.has(def.id)).toBe(true);
  });

  it('attaches the omen at expedition creation', () => {
    const run = createExpedition(4242, [], 0, defaultMeta());
    expect(run.omen).toBe(rollOmen(4242));
  });

  it('dailyMod takes precedence over omen', () => {
    const run = createRun(7, []);
    run.omen = 'keen_edge';
    expect(activeModifier(run)).toBe('keen_edge');
    run.dailyMod = 'heavy_air';
    expect(activeModifier(run)).toBe('heavy_air');
  });

  it('no omen and no daily means no modifier', () => {
    expect(activeModifier(createRun(7, []))).toBe(undefined);
  });

  it('keen_edge omen sharpens strikes like the daily twist', () => {
    const modded = createExpedition(11, [], 0, defaultMeta());
    modded.omen = 'keen_edge';
    const plain = createExpedition(11, [], 0, defaultMeta());
    plain.omen = undefined;
    const wMod = new World(modded);
    const wPlain = new World(plain);
    const defId = wMod.plan.roster[0];
    const eMod = wMod.enemies[0] ?? wMod.spawnEnemy(defId, 100, 100, 0);
    const ePlain = wPlain.enemies[0] ?? wPlain.spawnEnemy(defId, 100, 100, 0);
    eMod.state = 'chase';
    ePlain.state = 'chase';
    const hp = 100000;
    eMod.health = hp;
    ePlain.health = hp;
    wMod.damageEnemy(eMod, 100, 'melee', false, 0);
    wPlain.damageEnemy(ePlain, 100, 'melee', false, 0);
    expect(hp - eMod.health).toBeGreaterThan(hp - ePlain.health);
  });

  it('heavy_air omen sharpens incoming blows', () => {
    const mk = (omen: string | undefined): World => {
      const run = createExpedition(21, [], 0, defaultMeta());
      run.omen = omen;
      const w = new World(run);
      w.player.invulnerable = 0;
      w.player.health = 100000;
      return w;
    };
    const wMod = mk('heavy_air');
    const wPlain = mk(undefined);
    wMod.damagePlayer(100, wMod.player.x + 10, wMod.player.y, 0);
    wPlain.damagePlayer(100, wPlain.player.x + 10, wPlain.player.y, 0);
    expect(100000 - wMod.player.health).toBeGreaterThan(100000 - wPlain.player.health);
  });

  it('restless_dead omen adds one enemy per wave', () => {
    const DT = 1 / 60;
    const mk = (omen: string | undefined): number => {
      const run = createExpedition(31, [], 0, defaultMeta());
      run.omen = omen;
      const w = new World(run);
      const room = w.floor.rooms.find((r) => r.kind === 'combat')!;
      const c = roomCentrePx(room);
      w.player.x = c.x;
      w.player.y = c.y;
      for (let i = 0; i < 30; i++) w.step(NO_INPUT, DT);
      return w.enemies.length;
    };
    // Same seed, same room: omen run must spawn exactly one more than plain.
    expect(mk('restless_dead')).toBe(mk(undefined) + 1);
  });
});
