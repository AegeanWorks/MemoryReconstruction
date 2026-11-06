import { describe, expect, it } from 'vitest';
import type { AttackKind } from '../../src/sim/entities';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function trackingDuel(attack: AttackKind, seed = 77): { dot: number; fired: boolean } {
  const run = createRun(seed, []);
  const w = new World(run);
  const p = w.player;
  const enemy = w.spawnEnemy('scavenger', p.x + 200, p.y, -1);
  enemy.state = 'windup';
  enemy.attack = attack;
  enemy.stateTime = 0.5;
  enemy.cooldown = 99;
  // Aim east while the player stands north: a tracking attacker must turn.
  enemy.dirX = 1;
  enemy.dirY = 0;
  p.x = enemy.x;
  p.y = enemy.y - 200;
  let fired = false;
  // 0.5s windup needs 31 decrements (float dust); 40 frames leaves margin.
  for (let i = 0; i < 40; i++) {
    const events = w.step({ ...NO_INPUT }, DT);
    if (events.some((e) => e.type === 'enemyAttack')) fired = true;
    if (fired) break;
  }
  const want = Math.atan2(p.y - enemy.y, p.x - enemy.x);
  const got = Math.atan2(enemy.dirY, enemy.dirX);
  let diff = Math.abs(want - got) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return { dot: Math.cos(diff), fired };
}

describe('windup tracking (aimed shots follow a strafing walker)', () => {
  it.each(['shot', 'spread', 'volley', 'fan', 'wall'] as const)(
    '%s tracks the player until the last 0.15s',
    (attack) => {
      const { dot, fired } = trackingDuel(attack);
      expect(fired).toBe(true);
      expect(dot).toBeGreaterThan(0.99);
    }
  );

  it('committed melee stays committed (slam does not track)', () => {
    const { dot } = trackingDuel('slam');
    // Slam fires at its windup-start aim: east, while the player is north.
    expect(dot).toBeLessThan(0.2);
  });
});
