import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('relic rows with actions on phones', () => {
  const start = css.indexOf('/* Phone relic rows:');
  const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('\n}\n', start) + 1));

  it('has a phone block', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('@media (max-width: 560px)');
  });

  it('wraps and shrinks the action buttons instead of overflowing the row', () => {
    expect(block).toContain('flex-wrap: wrap');
    expect(block).toContain('flex: 1 1 auto');
    expect(block).toContain('min-width: 0');
    expect(css).toMatch(/\.gear-copy \{[^}]*min-width: 0/s);
  });

  it('gives the text the width by dropping the button onto its own full-width row', () => {
    expect(block).toContain('.gear-row:has(.gear-actions)');
    expect(block).toContain('grid-template-columns: 52px minmax(0, 1fr)');
    expect(block).toContain('.gear-row:has(.gear-actions) .gear-actions');
    expect(block).toContain('grid-column: 1 / -1');
  });
});
