import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { MORTAR_OFFSETS, mortarRadius } from '../../src/sim/enemies';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

/** The warning must mark the landing zone: three blasts across the walker. */
describe('mortar warning (the rings sit where the blasts land)', () => {
  it('shares one layout and radius between sim and telegraph', () => {
    expect(MORTAR_OFFSETS).toEqual([-70, 0, 70]);
    expect(mortarRadius(false)).toBe(40);
    expect(mortarRadius(true)).toBe(52);
  });

  it('blasts resolve across the walker, not at the caster', () => {
    const w = new World(createRun(9, []));
    const p = w.player;
    const e = w.spawnEnemy('scavenger', p.x + 300, p.y, -1);
    const ex = e.x;
    const ey = e.y;
    const px = p.x;
    const py = p.y;
    e.state = 'windup';
    e.attack = 'mortar';
    e.stateTime = 0.01;
    e.dirX = -1;
    e.dirY = 0;
    const blasts: { x: number; y: number; radius: number }[] = [];
    for (let i = 0; i < 120; i++) {
      for (const ev of w.step({ ...NO_INPUT }, DT)) {
        if (ev.type === 'blast') blasts.push({ x: ev.x, y: ev.y, radius: ev.radius });
      }
    }
    expect(blasts).toHaveLength(3);
    for (const b of blasts) expect(b.radius).toBe(mortarRadius(false));
    // Launch angle is due west; the perpendicular spread runs north-south
    // across the walker's launch-time position.
    for (const b of blasts) expect(b.x).toBeCloseTo(px, 0);
    const spread = blasts.map((b) => b.y - py).sort((a, b) => a - b);
    for (let i = 0; i < 3; i++) expect(spread[i]).toBeCloseTo(MORTAR_OFFSETS[i], 0);
    // And nowhere near the caster that the old warning ringed.
    for (const b of blasts) expect(Math.hypot(b.x - ex, b.y - ey)).toBeGreaterThan(200);
  });
});
