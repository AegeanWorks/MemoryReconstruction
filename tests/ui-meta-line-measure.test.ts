import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('long help text keeps a readable measure', () => {
  const start = css.indexOf('\n.meta-line {');
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));

  it('caps .meta-line well below the whole screen width', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(body).toContain('max-width: min(880px, 92vw)');
  });

  it('gives it comfortable leading and balanced wrapping', () => {
    expect(body).toContain('line-height: 1.45');
    expect(body).toContain('text-wrap: pretty');
  });
});
