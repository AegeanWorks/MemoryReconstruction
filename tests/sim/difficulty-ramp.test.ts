import { describe, expect, it } from 'vitest';
import {
  ENEMY_XP_SCALE,
  ROOM_DAMAGE_STEP,
  WAVE_DAMAGE_STEP,
  enemyDamageMultiplier,
  enemyDef,
  waveEnemyCount,
} from '../../src/sim/content';
import { roomCentrePx } from '../../src/sim/dungeon';
import { NO_INPUT } from '../../src/sim/entities';
import { applyChoice, createRun, xpForLevel } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('a slower climb and a crueller expedition', () => {
  it('makes every level beyond the first cost more than the old curve', () => {
    expect(xpForLevel(5)).toBeGreaterThanOrEqual(200);
    expect(xpForLevel(10)).toBeGreaterThan(42 * Math.pow(1.42, 9));
    expect(ENEMY_XP_SCALE).toBeLessThanOrEqual(0.45);
  });

  it('adds 5% enemy damage for every cleared room, so twenty rooms double it', () => {
    expect(ROOM_DAMAGE_STEP).toBe(0.05);
    expect(enemyDamageMultiplier(0, 0)).toBe(1);
    expect(enemyDamageMultiplier(0, 10)).toBeCloseTo(1.5);
    expect(enemyDamageMultiplier(0, 20)).toBe(2);
    expect(enemyDamageMultiplier(20, 0)).toBeCloseTo(3);
    expect(enemyDamageMultiplier(20, 20)).toBeCloseTo(4);
  });

  it('adds damage and one more enemy with each wave of a room', () => {
    expect(WAVE_DAMAGE_STEP).toBe(0.1);
    expect(enemyDamageMultiplier(0, 0, 1)).toBe(1);
    expect(enemyDamageMultiplier(0, 0, 2)).toBeCloseTo(1.1);
    expect(enemyDamageMultiplier(0, 0, 3)).toBeCloseTo(1.2);
    expect(waveEnemyCount(3, 40, 1)).toBe(3);
    expect(waveEnemyCount(3, 40, 2)).toBeGreaterThan(waveEnemyCount(3, 40, 1));
    expect(waveEnemyCount(3, 40, 3)).toBeGreaterThan(waveEnemyCount(3, 40, 2));
    expect(waveEnemyCount(10, 8, 6)).toBe(8);
  });

  it('stamps the room and wave scaling onto spawned enemies', () => {
    const run = createRun(3, []);
    const world = new World(run);
    const base = enemyDef('memory_echo').damage;
    const fresh = world.spawnEnemy('memory_echo', 100, 100, 0);
    expect(fresh.def.damage).toBe(base);

    run.stats.roomsCleared = 20;
    const twenty = world.spawnEnemy('memory_echo', 100, 100, 0);
    expect(twenty.def.damage).toBe(base * 2);

    const thirdWave = world.spawnEnemy('memory_echo', 100, 100, 0, false, 3);
    expect(thirdWave.def.damage).toBe(Math.round(base * (2 + WAVE_DAMAGE_STEP * 2)));
  });

  it('makes a real room’s second wave hit harder than its first', () => {
    const run = createRun(11, []);
    const world = new World(run);
    const room = [...world.floor.rooms]
      .filter((r) => r.kind === 'combat')
      .sort((a, b) => b.w * b.h - a.w * a.h)[0]!;
    const centre = roomCentrePx(room);
    world.player.x = centre.x;
    world.player.y = centre.y;
    let warmup = 0;
    while (
      world.enemies.filter((e) => e.roomId === room.id && e.state !== 'dying').length === 0 &&
      warmup < 300
    ) {
      world.step(NO_INPUT, DT);
      warmup++;
    }
    // A spawning enemy cannot be hurt yet; wait it out before clearing the wave.
    let ready = 0;
    while (
      world.enemies.some((e) => e.roomId === room.id && e.state === 'spawning') &&
      ready < 120
    ) {
      world.step(NO_INPUT, DT);
      ready++;
    }
    // The plan may roll any wave count; pin exactly two so the test is about growth, not luck.
    // The first wave already spawned, so one wave is left and the next one is wave 2.
    const state = world.rooms[room.id];
    state.wavesLeft = 1;
    state.totalWaves = 2;
    const firstWave = world.enemies.filter((e) => e.roomId === room.id && e.state !== 'dying');
    expect(firstWave.length).toBeGreaterThan(0);
    for (const enemy of [...world.enemies]) world.damageEnemy(enemy, 100000, 'melee', false, 0);
    // A level-up freezes the world until its card is answered; the kills may have earned one.
    while (run.pendingChoices.length > 0) {
      applyChoice(run, run.pendingChoices[0].options[0] ?? '');
    }

    let secondWave: typeof world.enemies = [];
    let wait = 0;
    while (secondWave.length === 0 && wait < 300) {
      world.step(NO_INPUT, DT);
      secondWave = world.enemies.filter(
        (e) => e.roomId === room.id && e.state !== 'dying' && !firstWave.includes(e)
      );
      wait++;
    }
    expect(secondWave.length).toBeGreaterThan(0);
    for (const enemy of secondWave) {
      const expected = Math.round(
        enemyDef(enemy.def.id).damage *
          enemyDamageMultiplier(run.depth, run.stats.roomsCleared, 2)
      );
      expect(enemy.def.damage, enemy.def.id).toBe(expected);
    }
  });
});
