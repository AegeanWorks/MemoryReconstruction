import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { MINE_DISTANCE, MINE_RADIUS, mineOffsets } from '../../src/sim/enemies';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('mine telegraph', () => {
  it('lands mines on the three points the ground warning shows', () => {
    const run = createRun(20261107, []);
    run.depth = 9;
    const w = new World(run);
    const p = w.player;
    p.invulnerable = 9999;
    const boss = w.spawnEnemy('forgotten', p.x + 120, p.y, -1, true);
    boss.state = 'windup';
    boss.attack = 'mines';
    boss.stateTime = 0;
    boss.dirX = -1;
    boss.dirY = 0;

    for (let i = 0; i < 120 && w.mines.length === 0; i++) w.step(NO_INPUT, DT);
    expect(w.mines).toHaveLength(3);

    const offsets = mineOffsets(boss);
    for (let i = 0; i < 3; i++) {
      expect(w.mines[i].x).toBeCloseTo(p.x + Math.cos(offsets[i]) * MINE_DISTANCE, 5);
      expect(w.mines[i].y).toBeCloseTo(p.y + Math.sin(offsets[i]) * MINE_DISTANCE, 5);
    }
  });

  it('shares one lethal radius between the blast and the warning', () => {
    const w = new World(createRun(20261107, []));
    const p = w.player;
    p.invulnerable = 9999;
    w.spawnMine(p.x + 200, p.y, 10);
    w.mines[0].arm = 0;
    w.mines[0].life = 0.001;
    const events = w.step(NO_INPUT, DT);
    const blast = events.find((event) => event.type === 'blast');
    expect(blast && 'radius' in blast ? blast.radius : 0).toBe(MINE_RADIUS);
    const view = readFileSync(join(__dirname, '../../src/view/ActorView.ts'), 'utf8');
    const start = view.indexOf("case 'mines'");
    expect(view.slice(start, start + 500)).toContain('MINE_RADIUS');
  });

  it('draws the warning from the same shared layout', () => {
    const view = readFileSync(join(__dirname, '../../src/view/ActorView.ts'), 'utf8');
    const start = view.indexOf("case 'mines'");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(view.slice(start, start + 500)).toContain('mineOffsets(e)');
  });
});
