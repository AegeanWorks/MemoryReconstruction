import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import {
  PILLARS_RADIUS,
  QUAKE_RADIUS,
  SWEEP_RANGE,
  SWEEP_SPAN,
} from '../../src/sim/enemies';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

/** The telegraph must show the whole beam: the sim reaches this far. */
describe('sweep and ground zones (the warning covers the whole hazard)', () => {
  it('shares one source of truth for beam span, beam range and zone radii', () => {
    expect(SWEEP_SPAN).toBe(1.8);
    expect(SWEEP_RANGE).toBe(520);
    expect(QUAKE_RADIUS).toBe(40);
    expect(PILLARS_RADIUS).toBe(38);
  });

  it('the sim beam hurts well past the old 220px telegraph', () => {
    const w = new World(createRun(9, []));
    const p = w.player;
    const before = p.health;
    const e = w.spawnEnemy('scavenger', p.x + 400, p.y, -1);
    e.state = 'windup';
    e.attack = 'sweep';
    e.stateTime = 0.01;
    e.dirX = -1;
    e.dirY = 0;
    for (let i = 0; i < 120; i++) w.step({ ...NO_INPUT }, DT);
    expect(p.health).toBeLessThan(before);
  });

  it('quake blasts resolve at the shared radius along the march', () => {
    const w = new World(createRun(9, []));
    const p = w.player;
    p.x += 1000;
    p.y += 1000;
    const e = w.spawnEnemy('scavenger', p.x - 1000, p.y - 1000, -1);
    const ex = e.x;
    const ey = e.y;
    e.state = 'windup';
    e.attack = 'quake';
    e.stateTime = 0.01;
    e.dirX = 1;
    e.dirY = 0;
    const blasts: { x: number; y: number; radius: number }[] = [];
    for (let i = 0; i < 120; i++) {
      for (const ev of w.step({ ...NO_INPUT }, DT)) {
        if (ev.type === 'blast') blasts.push({ x: ev.x, y: ev.y, radius: ev.radius });
      }
    }
    expect(blasts).toHaveLength(4);
    for (const b of blasts) expect(b.radius).toBe(QUAKE_RADIUS);
    const dists = blasts.map((b) => Math.hypot(b.x - ex, b.y - ey)).sort((a, b) => a - b);
    for (let i = 0; i < 4; i++) expect(dists[i]).toBeCloseTo(62 * (i + 1), 0);
  });
});
