import { describe, expect, it } from 'vitest';
import {
  ENEMY_COUNT_SCALE,
  ENEMY_DAMAGE_SCALE,
  ENEMY_SPEED_SCALE,
  ENEMY_XP_SCALE,
} from '../../src/sim/content';
import { roomCentrePx } from '../../src/sim/dungeon';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun, grantXp, xpForLevel } from '../../src/sim/run';
import { TILE_SIZE } from '../../src/sim/tiles';
import { enemyWaveCap } from '../../src/sim/tuning';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('frontier balance pass', () => {
  it('makes each level cost more than the old 30/1.36 curve', () => {
    expect(xpForLevel(1)).toBeGreaterThanOrEqual(40);
    expect(xpForLevel(5)).toBeGreaterThan(150);
    const run = createRun(1, []);
    expect(grantXp(run, 200, () => ['x'])).toBe(3);
  });

  it('pays much less kill XP and slows mobs slightly while raising damage', () => {
    expect(ENEMY_XP_SCALE).toBeLessThanOrEqual(0.6);
    expect(ENEMY_SPEED_SCALE).toBeLessThan(1.15);
    expect(ENEMY_SPEED_SCALE).toBeGreaterThan(1);
    expect(ENEMY_DAMAGE_SCALE).toBeGreaterThan(1);
    expect(ENEMY_COUNT_SCALE).toBeLessThan(1.25);
  });

  it('caps a wave by chamber area instead of depth alone', () => {
    expect(enemyWaveCap(60)).toBe(4);
    expect(enemyWaveCap(18 * 12)).toBeLessThanOrEqual(16);
    expect(enemyWaveCap(42 * 30, true)).toBeLessThanOrEqual(22);
    expect(enemyWaveCap(42 * 30, true)).toBeGreaterThan(enemyWaveCap(18 * 12));
  });

  it('never spawns more than the room cap in a late-depth wave', () => {
    const run = createRun(20261108, []);
    run.depth = 19;
    const world = new World(run);
    const room = world.floor.rooms.find((r) => r.kind === 'combat')!;
    const centre = roomCentrePx(room);
    world.player.x = centre.x;
    world.player.y = centre.y + TILE_SIZE;
    for (let i = 0; i < 40; i++) world.step(NO_INPUT, DT);
    const spawned = world.enemies.filter((e) => e.roomId === room.id).length;
    expect(spawned).toBeGreaterThan(0);
    expect(spawned).toBeLessThanOrEqual(enemyWaveCap(room.w * room.h));
  });
});
