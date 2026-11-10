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

describe('HUD vitals backplate & depth polish', () => {
  it('frames hud-vitals with a dark panel and border to isolate it from floor props', () => {
    const vitals = ruleBody('.hud-vitals');
    expect(vitals).toMatch(/background:\s*[^;]+rgba/);
    expect(vitals).toMatch(/border:\s*1px solid/);
    expect(vitals).toMatch(/border-radius:\s*\d+px/);
    expect(vitals).toMatch(/padding:\s*\d+px/);
  });

  it('provides gloss overlay on bar fills', () => {
    expect(css).toContain('.bar-fill::after');
  });
});
