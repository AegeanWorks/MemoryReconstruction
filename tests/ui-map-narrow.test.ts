import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('narrow map canvas', () => {
  it('constrains the big map to the viewport and keeps its ratio', () => {
    const start = css.indexOf('.big-map {');
    const end = css.indexOf('}', start);
    const body = css.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(body).toContain('max-width: min(640px, 100%)');
    expect(body).toContain('height: auto');
    expect(body).toContain('display: block');
  });
});
