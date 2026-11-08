import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { spiralAngles } from '../../src/sim/enemies';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

function spiritBoss(phase: 0 | 1 | 2, patternIndex: number) {
  const world = new World(createRun(7, []));
  const enemy = world.spawnEnemy('spirit', 100, 100, -1, true);
  enemy.phase = phase;
  enemy.patternIndex = patternIndex;
  return enemy;
}

describe('spiral telegraph (the markers are the real bullets)', () => {
  it('marks every bullet the phase actually fires', () => {
    // The old tell drew six rotating spokes; phase 0 fires ten bullets.
    const angles = spiralAngles(spiritBoss(0, 2));
    expect(angles).toHaveLength(10);

    const unique = new Set(angles.map((a) => a.toFixed(5)));
    expect(unique.size).toBe(angles.length);

    const step = (Math.PI * 2) / angles.length;
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo(step, 5);
    }
  });

  it('uses the phase bullet count and the same twist as the attack', () => {
    const phase2 = spiralAngles(spiritBoss(2, 4));
    expect(phase2).toHaveLength(18);
    expect(phase2[0]).toBeCloseTo((4 + 2) * 0.35, 5);
  });

  it('draws the tell from the shared angle helper', () => {
    const view = readFileSync(join(__dirname, '../../src/view/ActorView.ts'), 'utf8');
    expect(view).toContain('for (const a of spiralAngles(e))');
  });
});
