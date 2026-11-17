import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, allEnemyIds, enemyDef, guardianIds } from '../src/sim/content';
import { NO_INPUT } from '../src/sim/entities';
import { createRun } from '../src/sim/run';
import { NO_STATUS, moveScale } from '../src/sim/status';
import { TILE_SIZE } from '../src/sim/tiles';
import { World } from '../src/sim/world';

const DT = 1 / 60;

function stepFor(world: World, seconds: number, input = {}): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) world.step({ ...NO_INPUT, ...input }, DT);
}

describe('freezing enemies', () => {
  it('registers the Rime Chanter as a real, non-guardian species', () => {
    expect(allEnemyIds()).toContain('rime_chanter');
    const def = enemyDef('rime_chanter');
    expect(def.name).toBe('Rime Chanter');
    expect(def.description.length).toBeGreaterThan(20);
    expect(def.sprite.length).toBeGreaterThan(0);
    expect(guardianIds()).not.toContain('rime_chanter');
  });

  it('places it only on cold-flavoured sections', () => {
    const floors = FLOOR_PLANS.filter((plan) => plan.roster.includes('rime_chanter'));
    expect(floors.length).toBeGreaterThan(0);
    for (const plan of floors) expect(['frost', 'crystal', 'storm']).toContain(plan.biome);
  });

  it('freezes the walker when the verse lands', () => {
    const world = new World(createRun(201, []));
    const enemy = world.spawnEnemy('rime_chanter', world.player.x + 80, world.player.y, 0);
    enemy.state = 'chase';
    // Long enough for the first pulse (CHILL_PERIOD is 3.2 s).
    stepFor(world, 3.5);
    expect(world.player.status?.freeze ?? 0).toBeGreaterThan(0);
    expect(moveScale(world.player.status ?? NO_STATUS)).toBeLessThan(1);
  });

  it('lets the freeze lapse instead of rooting the walker for good', () => {
    const world = new World(createRun(202, []));
    world.player.status = { burn: 0, freeze: 1.4, mud: 0 };
    stepFor(world, 2);
    expect(world.player.status?.freeze ?? 0).toBe(0);
    expect(moveScale(world.player.status ?? NO_STATUS)).toBe(1);
  });
});

describe('ice on the floor', () => {
  it('never scorches the floor of a frozen section', () => {
    // Depth 10 is the Frozen Choir's neighbourhood; several seeds so the roll varies.
    for (const seed of [303, 404, 505, 606]) {
      const run = createRun(seed, []);
      run.depth = 10;
      const world = new World(run);
      const kinds = new Set(world.hazards.map((hazard) => hazard.kind));
      expect(kinds.has('flame'), `seed ${seed} placed flame on a frozen floor`).toBe(false);
    }
  });

  it('freezes a walker standing on it, then drains away', () => {
    const world = new World(createRun(304, []));
    const room = world.floor.rooms[0];
    const x = (room.x + 2) * TILE_SIZE;
    const y = (room.y + 2) * TILE_SIZE;
    world.hazards.push({
      id: 9001,
      kind: 'ice',
      x,
      y,
      radius: 40,
      roomId: room.id,
      phase: 'active',
      timer: 3,
      period: 9,
      damage: 0,
      hp: 0,
      maxHp: 0,
      disabled: false,
    });
    world.player.x = x;
    world.player.y = y;
    stepFor(world, 0.3);
    expect(world.player.status?.freeze ?? 0).toBeGreaterThan(0);
    // The patch is gone once its timer runs out.
    stepFor(world, 3.2);
    expect(world.hazards.some((hazard) => hazard.kind === 'ice')).toBe(false);
  });

  it('never lets ice damage the walker like a trap', () => {
    const world = new World(createRun(305, []));
    const room = world.floor.rooms[0];
    const x = (room.x + 2) * TILE_SIZE;
    const y = (room.y + 2) * TILE_SIZE;
    world.hazards.push({
      id: 9002,
      kind: 'ice',
      x,
      y,
      radius: 40,
      roomId: room.id,
      phase: 'active',
      timer: 5,
      period: 9,
      damage: 0,
      hp: 0,
      maxHp: 0,
      disabled: false,
    });
    world.player.x = x;
    world.player.y = y;
    const before = world.player.health;
    stepFor(world, 1);
    expect(world.player.health).toBe(before);
  });
});
