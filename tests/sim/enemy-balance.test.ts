import { describe, expect, it } from 'vitest';
import enemiesJson from '../../src/data/enemies.json';
import {
  ENEMY_ATTACK_SPEED_SCALE,
  ENEMY_COUNT_SCALE,
  ENEMY_DAMAGE_SCALE,
  ENEMY_SPEED_SCALE,
  ENEMY_WINDUP_SCALE,
  enemyDef,
} from '../../src/sim/content';

describe('harder enemy balance pass', () => {
  it('raises every enemy knob above the old baseline', () => {
    expect(ENEMY_DAMAGE_SCALE).toBeGreaterThan(0.85);
    expect(ENEMY_SPEED_SCALE).toBeGreaterThan(1);
    expect(ENEMY_ATTACK_SPEED_SCALE).toBeGreaterThan(1);
    expect(ENEMY_WINDUP_SCALE).toBeGreaterThan(1);
    expect(ENEMY_COUNT_SCALE).toBeGreaterThan(1);
  });

  it('applies speed, damage and cooldown scales to a data enemy', () => {
    const raw = (enemiesJson as { enemies: Array<{ id: string; stats: { damage: number; speed: number }; ai: { attackCooldown: number } }> }).enemies.find(
      (enemy) => enemy.id === 'scavenger'
    )!;
    const def = enemyDef('scavenger');
    expect(def.speed).toBe(Math.round(raw.stats.speed * ENEMY_SPEED_SCALE));
    expect(def.damage).toBe(Math.max(4, Math.round(raw.stats.damage * ENEMY_DAMAGE_SCALE)));
    expect(def.attackCooldown).toBeCloseTo(raw.ai.attackCooldown / ENEMY_ATTACK_SPEED_SCALE, 6);
  });
});
