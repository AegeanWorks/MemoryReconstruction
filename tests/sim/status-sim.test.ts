import { describe, expect, it } from 'vitest';
import { NO_INPUT, type InputFrame } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { applyStatus, NO_STATUS, BURN_DPS } from '../../src/sim/status';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function newWorld(seed = 4242): World {
  return new World(createRun(seed, []));
}

function stepFor(world: World, seconds: number, input: Partial<InputFrame> = {}): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) world.step({ ...NO_INPUT, ...input }, DT);
}

describe('status effects in the sim', () => {
  it('burns an enemy down over time without any attack', () => {
    const world = newWorld();
    const enemy = world.spawnEnemy('memory_echo', world.player.x + 40, world.player.y, 0);
    enemy.state = 'chase';
    enemy.stateTime = 0;
    enemy.health = enemy.maxHealth;
    enemy.status = applyStatus(NO_STATUS, 'burn', 1);
    const before = enemy.health;
    stepFor(world, 0.5);
    expect(enemy.health).toBeLessThan(before);
    expect(before - enemy.health).toBeGreaterThanOrEqual(BURN_DPS * 0.4);
  });

  it('shatters a frozen enemy for bonus damage and clears the ice', () => {
    const world = newWorld();
    const enemy = world.spawnEnemy('memory_echo', world.player.x + 40, world.player.y, 0);
    enemy.state = 'chase';
    enemy.health = enemy.maxHealth;
    enemy.status = applyStatus(NO_STATUS, 'freeze', 2);
    world.damageEnemy(enemy, 10, 'bolt', false, 0);
    expect(enemy.health).toBe(enemy.maxHealth - 15);
    expect(enemy.status?.freeze).toBe(0);
  });

  it('slows a frozen walker without stopping it', () => {
    const world = newWorld();
    const startX = world.player.x;
    world.player.status = applyStatus(NO_STATUS, 'freeze', 5);
    stepFor(world, 0.3, { moveX: 1 });
    const frozenTravel = world.player.x - startX;
    const clean = newWorld();
    const cleanStart = clean.player.x;
    clean.player.x = startX;
    stepFor(clean, 0.3, { moveX: 1 });
    expect(clean.player.x - cleanStart).toBeGreaterThan(frozenTravel);
    expect(frozenTravel).toBeGreaterThan(0);
  });

  it('burns a walker that stands in flame', () => {
    const world = newWorld();
    world.player.x = 0;
    world.player.y = 0;
    const room = world.floor.rooms[0];
    world.hazards.push({
      id: 9999,
      kind: 'flame',
      x: world.player.x,
      y: world.player.y,
      radius: 40,
      roomId: room.id,
      phase: 'idle',
      timer: 0,
      period: 3.4,
      damage: 6,
    } as never);
    stepFor(world, 1.2);
    expect(world.player.status?.burn ?? 0).toBeGreaterThan(0);
  });
});
