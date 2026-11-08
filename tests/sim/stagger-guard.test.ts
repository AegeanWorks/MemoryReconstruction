import { describe, expect, it } from 'vitest';
import { enemyDef } from '../../src/sim/content';
import { createEnemy, staggerEnemy } from '../../src/sim/enemies';

function mob(defId = 'scavenger', boss = false): ReturnType<typeof createEnemy> {
  return createEnemy(
    1,
    enemyDef(defId, boss),
    0,
    0,
    -1,
    { health: 1, damage: 1 },
    false
  );
}

describe('mob stagger guard', () => {
  it('applies the first stagger and blocks an instant re-stagger', () => {
    const enemy = mob();
    enemy.state = 'chase';
    staggerEnemy(enemy);
    expect(enemy.state).toBe('stagger');
    expect(enemy.staggerGuard).toBeGreaterThan(0);
    enemy.stateTime = 0.01;
    staggerEnemy(enemy);
    expect(enemy.stateTime).toBeCloseTo(0.01);
  });

  it('allows a fresh stagger after the guard expires', () => {
    const enemy = mob();
    enemy.state = 'chase';
    staggerEnemy(enemy);
    enemy.staggerGuard = 0;
    enemy.state = 'chase';
    enemy.stateTime = 0;
    staggerEnemy(enemy);
    expect(enemy.state).toBe('stagger');
    expect(enemy.stateTime).toBeGreaterThan(0.1);
  });

  it('never staggers a boss', () => {
    const boss = mob('keeper', true);
    boss.state = 'chase';
    staggerEnemy(boss);
    expect(boss.state).toBe('chase');
  });
});
