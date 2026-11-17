import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, allEnemyIds, enemyDef, guardianIds } from '../../src/sim/content';
import { NO_INPUT } from '../../src/sim/entities';
import { defaultAttack } from '../../src/sim/enemies';
import { createRun } from '../../src/sim/run';
import { NO_STATUS, moveScale } from '../../src/sim/status';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

const NEW = ['prism_lancer', 'quake_colossus', 'mire_warden', 'brine_charger', 'bog_spitter'];

function stepFor(world: World, seconds: number, input = {}): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) world.step({ ...NO_INPUT, ...input }, DT);
}

describe('cycle 109 enemy archetypes', () => {
  it('registers all five species with a tint, a sheet and a behaviour', () => {
    for (const id of NEW) {
      expect(allEnemyIds(), id).toContain(id);
      const entry = enemyDef(id);
      expect(entry.name.length, id).toBeGreaterThan(0);
      expect(entry.description.length, id).toBeGreaterThan(0);
      expect(entry.archetype, id).not.toBe('boss');
      expect(entry.sprite.length, id).toBeGreaterThan(0);
    }
  });

  it('never makes a new species a guardian', () => {
    for (const id of NEW) expect(guardianIds()).not.toContain(id);
  });

  it('roster-places every new species on at least one real section', () => {
    const rosters = FLOOR_PLANS.flatMap((plan) => plan.roster);
    for (const id of NEW) expect(rosters, id).toContain(id);
  });

  it('gives the laser a lane beam, the stomper a radial slam and the spitter a shot', () => {
    expect(defaultAttack(enemyDef('prism_lancer'))).toBe('beam');
    expect(defaultAttack(enemyDef('quake_colossus'))).toBe('slam');
    expect(defaultAttack(enemyDef('bog_spitter'))).toBe('shot');
    // The stomper's slam reaches further than a normal brute's.
    expect(enemyDef('quake_colossus').attackRange).toBeGreaterThan(80);
  });

  it('lays a slowing mud patch where the spitter aims', () => {
    const world = new World(createRun(31, []));
    const y = world.player.y;
    const x = world.player.x + 30;
    world.spawnMud(x, y, 46);
    const mud = world.hazards.find((h) => h.kind === 'mud');
    expect(mud).toBeDefined();
    expect(mud!.radius).toBe(46);
    world.player.x = x;
    world.player.y = y;
    stepFor(world, 0.2);
    expect(world.player.status?.mud ?? 0).toBeGreaterThan(0);
    expect(moveScale(world.player.status ?? NO_STATUS)).toBeLessThan(1);
    // It drains away on its own.
    stepFor(world, 8);
    expect(world.hazards.some((h) => h.kind === 'mud')).toBe(false);
  });

  it('slows the walker inside a slow-field warden aura', () => {
    const world = new World(createRun(32, []));
    const warden = world.spawnEnemy('mire_warden', world.player.x + 60, world.player.y, 0);
    warden.state = 'chase';
    stepFor(world, 0.3);
    expect(world.player.status?.mud ?? 0).toBeGreaterThan(0);
    expect(moveScale(world.player.status ?? NO_STATUS)).toBeLessThan(1);
  });

  it('runs a charger in with the heavy charge knockback', () => {
    const world = new World(createRun(33, []));
    const charger = world.spawnEnemy('brine_charger', world.player.x + 140, world.player.y, 0);
    charger.state = 'chase';
    charger.cooldown = 0;
    let charged = false;
    for (let i = 0; i < 400 && !charged; i++) {
      world.step(NO_INPUT, DT);
      if (charger.attack === 'charge') charged = true;
    }
    expect(charged).toBe(true);
  });
});

describe('new species reach the codex', () => {
  it('lists every new id once over the real 102 species', () => {
    expect(allEnemyIds()).toHaveLength(104);
    expect(new Set(allEnemyIds()).size).toBe(104);
    for (const id of NEW) expect(enemyDef(id).name.length).toBeGreaterThan(0);
  });
});
