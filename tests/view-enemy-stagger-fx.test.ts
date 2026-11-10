import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(__dirname, '../src/view/ActorView.ts'),
  'utf8'
);

describe('stagger daze visual feedback', () => {
  it('renders an orbital daze ring and 4-point rotating stars when an enemy is staggered', () => {
    const staggerIndex = source.indexOf('if (staggered) {');
    expect(staggerIndex).toBeGreaterThanOrEqual(0);
    const blockEnd = source.indexOf('if (e.isBoss', staggerIndex);
    expect(blockEnd).toBeGreaterThan(staggerIndex);
    const block = source.slice(staggerIndex, blockEnd);

    // Should draw an orbital ellipse halo
    expect(block).toContain('.ellipse(pos.x, headY, rx, ry)');
    // Should draw 4-pointed stars with glow and core
    expect(block).toContain('.star(');
    expect(block).toContain('4,'); // 4-pointed star
  });
});
