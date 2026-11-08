import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, FloorPlanSchema, arenaBossFor, enemyDef } from '../../src/sim/content';
import { checkpointDepths, createExpedition } from '../../src/sim/hub';
import { defaultMeta } from '../../src/save/SaveStore';
import { roomCentrePx } from '../../src/sim/dungeon';
import { NO_INPUT } from '../../src/sim/entities';
import { World } from '../../src/sim/world';

/** Slice 5a: the Drowned Court trial — a fourth echo trial with a new boss. */
describe('drowned court trial', () => {
  it('validates every floor plan against the zod schema', () => {
    for (const plan of FLOOR_PLANS) expect(() => FloorPlanSchema.parse(plan)).not.toThrow();
    expect(() =>
      FloorPlanSchema.parse({ depth: 99, biome: 'nope', roster: [], boss: 'x', roomCount: 1 })
    ).toThrow();
  });

  it('adds the tide trial before the sanctuary finale', () => {
    expect(FLOOR_PLANS).toHaveLength(23);
    const trial = FLOOR_PLANS[20];
    expect(trial.boss).toBe('abyssal_revenant');
    expect(trial.bossOnly).toBe(true);
    expect(trial.roster).toEqual([]);
    expect(trial.roomCount).toBe(1);
    expect(trial.trialName).toContain('Drowned Court');
    expect(FLOOR_PLANS[21].finale).toBe(false);
    expect(FLOOR_PLANS[21].boss).toBe('keeper');
    expect(FLOOR_PLANS[22].finale).toBe(true);
    expect(FLOOR_PLANS[22].boss).toBe('first_memory');
  });

  it('wires the new boss through data, sprite and pattern tables', () => {
    const def = enemyDef('abyssal_revenant', true);
    expect(def.archetype).toBe('boss');
    expect(def.behavior).toBe('boss');
    expect(def.maxHealth).toBeGreaterThan(enemyDef('abyssal_revenant').maxHealth);
    // Bosses have own presence: at least 1.5x display height of the base record.
    expect(def.displayHeight).toBeGreaterThanOrEqual(72);
  });

  it('keeps checkpoints consistent and shares the new boss with mid-floor arenas', () => {
    expect(checkpointDepths()).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 22]);
    for (let depth = 0; depth < FLOOR_PLANS.length; depth++) {
      const boss = arenaBossFor(depth);
      expect(boss).not.toBe('mirror_self');
      expect(boss).not.toBe('keeper');
    }
    // The new boss joins the echo-guardian pool like the other trial bosses.
    const pool = new Set(FLOOR_PLANS.map((_, depth) => arenaBossFor(depth)));
    expect(pool.has('abyssal_revenant')).toBe(true);
  });

  it('runs the trial boss fight: spawns, phases, portal', () => {
    const run = createExpedition(99, [], 20, defaultMeta());
    const world = new World(run);
    const bossRoom = world.floor.rooms[world.floor.bossRoom];
    const c = roomCentrePx(bossRoom);
    world.player.x = c.x;
    world.player.y = c.y;
    for (let i = 0; i < 120; i++) world.step(NO_INPUT, 1 / 60);
    const boss = world.enemies.find((e) => e.isBoss);
    expect(boss?.def.id).toBe('abyssal_revenant');
    const phases = new Set<number>();
    for (let i = 0; i < 3600 && boss && world.enemies.includes(boss); i++) {
      phases.add(boss.phase);
      world.step(NO_INPUT, 1 / 60);
      if (i % 20 === 19) world.damageEnemy(boss, 60, 'melee', false, 0);
      while (world.awaitingChoice) world.chooseUpgrade(world.run.pendingChoices[0].options[0]);
      world.player.health = world.player.stats.maxHealth;
    }
    expect(world.enemies.includes(boss!)).toBe(false);
    expect(phases.size).toBeGreaterThanOrEqual(2);
    expect(world.interactables.some((x) => x.kind === 'portal')).toBe(true);
  });
});
