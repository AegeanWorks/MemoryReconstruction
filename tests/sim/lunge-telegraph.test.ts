import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enemyDef } from '../../src/sim/content';
import { lungeRange } from '../../src/sim/enemies';

describe('lunge telegraph (the lane is the real travel)', () => {
  it('covers a fast hound, not a fixed 140px', () => {
    const hound = enemyDef('magma_hound');
    expect(lungeRange(hound)).toBeGreaterThan(140);
    expect(lungeRange(hound)).toBe(Math.round((hound.speed * 4 + 120) * 0.22));
  });

  it('draws the lunge lane from the shared range helper', () => {
    const view = readFileSync(join(__dirname, '../../src/view/ActorView.ts'), 'utf8');
    const start = view.indexOf("case 'lunge'");
    const end = view.indexOf("case 'shot'", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(view.slice(start, end)).toContain('lungeRange(e.def)');
  });
});
