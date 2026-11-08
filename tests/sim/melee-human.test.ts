import { describe, expect, it } from 'vitest';
import spriteAtlas from '../../src/data/sprite_atlas.json';
import { enemyDef, FLOOR_PLANS } from '../../src/sim/content';
import { NO_INPUT } from '../../src/sim/entities';
import { equipmentDef } from '../../src/sim/equipment';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;
const ATLAS_KEYS = new Set(Object.keys(spriteAtlas.enemies));

function newWorld(depth: number, seed: number): World {
  const run = createRun(seed, []);
  run.depth = depth;
  const world = new World(run);
  // Keep the subject out of room-lock crossfire: clear nearby hazards.
  for (let i = world.hazards.length - 1; i >= 0; i--) {
    const h = world.hazards[i];
    if (Math.hypot(h.x - world.player.x, h.y - world.player.y) < 400) {
      world.hazards.splice(i, 1);
    }
  }
  return world;
}

/** Third wave: melee-led and human-like blades arrive as DATA, never code. */
describe('melee and human-like wave', () => {
  it('defines two melee attackers and one human-like duelist', () => {
    expect(enemyDef('ember_squire').archetype).toBe('melee');
    expect(enemyDef('ember_squire').behavior).toBe('chase');
    expect(enemyDef('mire_halberdier').archetype).toBe('melee');
    expect(enemyDef('mire_halberdier').behavior).toBe('chase');
    expect(enemyDef('pale_blademaster').archetype).toBe('duelist');
    expect(enemyDef('pale_blademaster').behavior).toBe('duelist');
  });

  it('reuses existing atlas sheets so the atlas gate stays green', () => {
    for (const id of ['ember_squire', 'pale_blademaster', 'mire_halberdier']) {
      const sprite = enemyDef(id).sprite;
      expect(sprite).not.toBe('mirror');
      expect(ATLAS_KEYS.has(sprite)).toBe(true);
    }
  });

  it('reaches players through existing progression rosters', () => {
    const rosters = FLOOR_PLANS.flatMap((plan) => plan.roster);
    for (const id of ['ember_squire', 'pale_blademaster', 'mire_halberdier']) {
      expect(rosters).toContain(id);
    }
    expect(FLOOR_PLANS[4].roster).toContain('ember_squire');
    expect(FLOOR_PLANS[10].roster).toContain('pale_blademaster');
    expect(FLOOR_PLANS[12].roster).toContain('mire_halberdier');
  });

  it('melee closes distance on a seeded run', () => {
    const world = newWorld(4, 1234);
    const p = world.player;
    const squire = world.spawnEnemy('ember_squire', p.x + 100, p.y, -1);
    const halberdier = world.spawnEnemy('mire_halberdier', p.x - 120, p.y, -1);
    for (const foe of [squire, halberdier]) {
      foe.state = 'chase';
      foe.cooldown = 999;
      for (let i = world.hazards.length - 1; i >= 0; i--) {
        const h = world.hazards[i];
        if (Math.hypot(h.x - foe.x, h.y - foe.y) < 120) world.hazards.splice(i, 1);
      }
    }
    const d0 = Math.hypot(squire.x - p.x, squire.y - p.y);
    const e0 = Math.hypot(halberdier.x - p.x, halberdier.y - p.y);
    for (let i = 0; i < 120; i++) world.step(NO_INPUT, DT);
    const d1 = Math.hypot(squire.x - p.x, squire.y - p.y);
    const e1 = Math.hypot(halberdier.x - p.x, halberdier.y - p.y);
    expect(d1).toBeLessThan(d0);
    expect(e1).toBeLessThan(e0);
    // The halberd keeps spear length: it should not need to touch the player.
    expect(halberdier.def.attackRange).toBeGreaterThan(squire.def.attackRange);
  });

  it('human-like duelist answers at range bands, not as a reskinned chaser', () => {
    const world = newWorld(10, 99);
    const p = world.player;
    const blade = world.spawnEnemy('pale_blademaster', p.x + 80, p.y, -1);
    blade.state = 'chase';
    blade.cooldown = 0;
    const seen = new Set<string>([blade.state]);
    for (let i = 0; i < 600; i++) {
      world.step(NO_INPUT, DT);
      if (world.enemies.includes(blade)) seen.add(blade.state);
      if (seen.has('windup') && seen.has('attack')) break;
    }
    expect([...seen].join(',')).toContain('chase');
    expect(seen.has('windup') || seen.has('attack')).toBe(true);
    expect(blade.def.behavior).toBe('duelist');
  });
});

/** Slice 5 mechanics arrive as data tables with existing mod keys. */
describe('wave mechanics tables', () => {
  it('defines the duelist mantle and ember ward relics', () => {
    expect(equipmentDef('duelist_mantle').slot).toBe('armor');
    expect(equipmentDef('ember_ward').slot).toBe('trinket');
    expect(equipmentDef('duelist_mantle').mods.attackSpeed).toBeGreaterThan(0);
    expect(equipmentDef('ember_ward').mods.maxHealth).toBeGreaterThan(0);
  });
});
