import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('controls panel never clips its rows', () => {
  const start = css.indexOf('\n.panel:has(> .controls) {');
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));

  it('is not height-capped or shrunk, so the screen scrolls instead of the panel', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(body).toContain('max-height: none');
    expect(body).toContain('flex-shrink: 0');
  });
});
