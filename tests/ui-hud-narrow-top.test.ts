import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('top HUD pills clear the minimap on phones', () => {
  const start = css.indexOf('/* Phone top HUD:');
  const block = css.slice(start, css.indexOf('\n}\n', start));

  it('has a phone block', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('@media (max-width: 560px)');
  });

  it('left-aligns the floor name and objectives and caps their width clear of the map', () => {
    expect(block).toContain('left: calc(10px + var(--safe-left))');
    expect(block).toContain('transform: none');
    expect(block).toContain('max-width: calc(100vw - 140px)');
    expect(block).toContain('text-overflow: ellipsis');
  });
});
