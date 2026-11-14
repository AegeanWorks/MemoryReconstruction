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

describe('short landscape screens', () => {
  it('centres the scrolling feats row safely, so its first chip stays reachable', () => {
    expect(ruleBody('.feats-panel')).toContain('justify-content: safe center');
  });

  it('keeps toasts out of the arena on short screens', () => {
    expect(ruleBody('.toasts')).toContain('top: max(16%, min(140px, 24vh))');
  });
});
