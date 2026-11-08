import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function blinkBoss() {
  const world = new World(createRun(7, []));
  world.enemies.length = 0;
  const p = world.player;
  const room = world.floor.rooms[0];
  p.x = (room.x + room.w / 2) * 32;
  p.y = (room.y + room.h / 2) * 32;
  p.invulnerable = 9999;
  const enemy = world.spawnEnemy('crystal_guardian', p.x + 200, p.y, -1, true);
  enemy.state = 'chase';
  enemy.cooldown = 0;
  enemy.patternIndex = 3;
  enemy.phase = 0;
  return { world, enemy, player: p };
}

describe('blink landing telegraph', () => {
  it('locks the landing point during windup and lands there', () => {
    const { world, enemy, player } = blinkBoss();
    for (let i = 0; i < 8 && enemy.state !== 'windup'; i++) world.step(NO_INPUT, DT);
    expect(enemy.state).toBe('windup');
    expect(enemy.attack).toBe('blink');
    expect(typeof enemy.blinkX).toBe('number');
    expect(typeof enemy.blinkY).toBe('number');

    const tx = enemy.blinkX!;
    const ty = enemy.blinkY!;
    expect(Math.hypot(tx - player.x, ty - player.y)).toBeCloseTo(58, 0);

    for (let i = 0; i < 80 && enemy.state !== 'attack'; i++) world.step(NO_INPUT, DT);
    expect(enemy.state).toBe('attack');
    expect(enemy.x).toBeCloseTo(tx, 0);
    expect(enemy.y).toBeCloseTo(ty, 0);
  });

  it('draws the strike zone at the locked landing point', () => {
    const view = readFileSync(join(__dirname, '../../src/view/ActorView.ts'), 'utf8');
    const start = view.indexOf("case 'blink'");
    const end = view.indexOf("case 'bomb'", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(view.slice(start, end)).toContain('e.blinkX');
  });
});
