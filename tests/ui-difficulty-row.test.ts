import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('difficulty buttons on phones', () => {
  const start = css.indexOf('/* Phone difficulty row:');
  const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('\n}\n', start) + 1));

  it('gives the label its own line so the three buttons share one full-width row', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('@media (max-width: 560px)');
    expect(block).toContain('.setting:has(.setting-options)');
    expect(block).toContain('grid-template-columns: 1fr');
    expect(block).toContain('flex-wrap: nowrap');
    expect(block).toContain('flex: 1');
  });
});
