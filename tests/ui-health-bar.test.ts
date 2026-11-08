import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('health bar height', () => {
  it('keeps the verified 18px combat bar', () => {
    expect(ruleBody('.bar')).toMatch(/height:\s*18px/);
  });

  it('keeps thin bars compact', () => {
    expect(ruleBody('.bar.thin')).toMatch(/height:\s*5px/);
  });
});
