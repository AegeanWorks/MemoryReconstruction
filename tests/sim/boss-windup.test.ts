import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Enemy } from '../../src/sim/entities';
import { windupDuration } from '../../src/sim/enemies';

function boss(phase = 0): Enemy {
  return {
    isBoss: true,
    phase,
    attack: 'ring',
    windupTotal: 0,
  } as Enemy;
}

describe('boss windup duration is stable through a phase change', () => {
  it('keeps the cached duration when the phase jumps mid-telegraph', () => {
    const b = boss(0);
    const initial = windupDuration(b);
    expect(initial).toBeGreaterThan(0);
    b.windupTotal = initial;
    b.phase = 2;
    expect(windupDuration(b)).toBe(initial);
  });

  it('beginWindup resets and caches the duration before the phase can change', () => {
    const sim = readFileSync(join(__dirname, '../../src/sim/enemies.ts'), 'utf8');
    const start = sim.indexOf('function beginWindup');
    const body = sim.slice(start, sim.indexOf('arena.emit', start));
    expect(start).toBeGreaterThanOrEqual(0);
    expect(body).toContain('enemy.windupTotal = 0');
    expect(body).toContain('enemy.stateTime = windupDuration(enemy)');
    expect(body).toContain('enemy.windupTotal = enemy.stateTime');
  });
});
