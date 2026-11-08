import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function newWorld(seed = 7): World {
  return new World(createRun(seed, []));
}

/** Stage the walker mid-dash with i-frames and a full dash pool. */
function stageDash(world: World): void {
  const p = world.player;
  p.mana = 0;
  p.health = p.stats.maxHealth;
  p.dashCharges = p.stats.dashCharges;
  p.dashTime = 0.12;
  p.dashDirX = 0;
  p.dashDirY = -1;
  p.invulnerable = 0.24;
  p.action = 'dash';
}

function stageStrike(world: World): ReturnType<World['spawnEnemy']> {
  const p = world.player;
  const enemy = world.spawnEnemy('scavenger', p.x + 60, p.y, -1);
  enemy.state = 'windup';
  enemy.stateTime = 0;
  enemy.cooldown = 99;
  enemy.dirX = -1;
  enemy.dirY = 0;
  enemy.attack = 'strike';
  return enemy;
}

describe('graze consistency across attack types', () => {
  it('rewards a dash through an enemy strike instead of only absorbing it', () => {
    const world = newWorld();
    world.enemies.length = 0;
    stageDash(world);
    stageStrike(world);
    const events = world.step(NO_INPUT, DT);
    expect(world.run.stats.grazes).toBe(1);
    expect(events.some((event) => event.type === 'graze')).toBe(true);
    expect(world.player.mana).toBeGreaterThan(0);
  });

  it('still lets the same strike hurt a walker who is not dashing', () => {
    const world = newWorld();
    world.enemies.length = 0;
    const p = world.player;
    const health = p.health;
    stageStrike(world);
    const events = world.step(NO_INPUT, DT);
    expect(world.run.stats.grazes).toBe(0);
    expect(events.some((event) => event.type === 'graze')).toBe(false);
    expect(p.health).toBeLessThan(health);
  });

  it('graze i-frames that outlive the dash do not pay out', () => {
    const world = newWorld();
    const p = world.player;
    p.dashTime = 0;
    p.invulnerable = 0.24;
    const health = p.health;
    world.damagePlayer(10, p.x + 10, p.y, 0, true);
    expect(world.run.stats.grazes).toBe(0);
    expect(p.health).toBe(health);
  });

  it('rewards a dash through an enemy bomb explosion', () => {
    const world = newWorld();
    world.enemies.length = 0;
    stageDash(world);
    const p = world.player;
    world.spawnBomb(p.x, p.y, 0, 0, 'enemy', 10, 0.001);
    const events = world.step(NO_INPUT, DT);
    expect(world.run.stats.grazes).toBe(1);
    expect(events.some((event) => event.type === 'graze')).toBe(true);
  });

  it('does not pay a graze for the walker’s own bomb', () => {
    const world = newWorld();
    world.enemies.length = 0;
    stageDash(world);
    const p = world.player;
    world.spawnBomb(p.x, p.y, 0, 0, 'player', 10, 0.001);
    world.step(NO_INPUT, DT);
    expect(world.run.stats.grazes).toBe(0);
  });

  it('rewards a dash through a telegraphed blast at the shared radius', () => {
    const world = newWorld();
    world.enemies.length = 0;
    stageDash(world);
    world.spawnBlast(world.player.x, world.player.y, 40, 0.001, 10);
    const events = world.step(NO_INPUT, DT);
    expect(world.run.stats.grazes).toBe(1);
    expect(events.some((event) => event.type === 'graze')).toBe(true);
  });
});
