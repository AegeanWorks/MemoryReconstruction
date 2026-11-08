import { describe, expect, it } from 'vitest';
import { windupDuration } from '../../src/sim/enemies';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

function windupEnemy(attack: 'strike' | 'slam' | 'blink', boss = false, phase = 0) {
  const world = new World(createRun(1, []));
  const enemy = world.spawnEnemy('scavenger', 0, 0, -1);
  enemy.attack = attack;
  enemy.isBoss = boss;
  enemy.phase = phase;
  return enemy;
}

describe('windup duration', () => {
  it('matches the scaled strike windup', () => {
    expect(windupDuration(windupEnemy('strike'))).toBeCloseTo(0.42 / 1.1);
  });

  it('matches the short blink windup', () => {
    expect(windupDuration(windupEnemy('blink'))).toBeCloseTo(0.4 / 1.1);
  });

  it('applies the boss phase cooldown with its 0.75 floor', () => {
    expect(windupDuration(windupEnemy('slam', true, 0))).toBeCloseTo(0.75 / 1.1);
    expect(windupDuration(windupEnemy('slam', true, 1))).toBeCloseTo((0.75 / 1.1) * 0.8);
    // Phase 2's 0.62 cooldown is floored to 0.75.
    expect(windupDuration(windupEnemy('slam', true, 2))).toBeCloseTo((0.75 / 1.1) * 0.75);
  });
});
