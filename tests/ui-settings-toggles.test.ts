import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

function ruleBody(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

describe('settings toggle rows', () => {
  it('give the hint the wide column instead of the 40px slider value column', () => {
    const body = ruleBody(".setting:has(input[type='checkbox'])");
    expect(body).toContain('grid-template-columns: 130px 22px 1fr');
  });

  it('keep hints dim, not the cyan used for slider values', () => {
    expect(ruleBody('.setting .setting-hint')).toContain('color: var(--ink-dim)');
  });
});

describe('settings difficulty row', () => {
  it('lets the option buttons span the value column so they stay on one row', () => {
    expect(ruleBody('.setting-options')).toContain('grid-column: 2 / -1');
  });
});
