import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('boss bar phase ticks', () => {
  it('marks the 60% and 30% phase thresholds', () => {
    expect(css).toContain('.boss-bar .bar {');
    expect(css).toMatch(/\.boss-bar \.bar::before[\s\S]*?left:\s*60%/);
    expect(css).toMatch(/\.boss-bar \.bar::after[\s\S]*?left:\s*30%/);
  });
});
