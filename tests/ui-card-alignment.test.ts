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

describe('upgrade card alignment', () => {
  it('reserves two title lines so descriptions line up across cards', () => {
    const name = ruleBody('.card .name');
    expect(name).toContain('line-height: 1.3');
    expect(name).toContain('min-height: calc(20px * 1.3 * 2)');
    expect(name).toContain('align-items: center');
  });

  it('stretches cards to a common height', () => {
    expect(ruleBody('.cards')).toContain('align-items: stretch');
  });
});
