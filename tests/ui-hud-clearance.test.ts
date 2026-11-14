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

describe('HUD clearance', () => {
  it('keeps toasts below the boss bar', () => {
    // 140px clears the boss bar at 720p; 24vh stops short screens pushing toasts into the arena.
    expect(ruleBody('.toasts')).toContain('top: max(16%, min(140px, 24vh))');
  });

  it('keeps the vitals panel in its original look (opaque plate, roomy spacing)', () => {
    const vitals = ruleBody('.hud-vitals');
    expect(vitals).toContain('rgba(14, 12, 24, 0.88)');
    expect(vitals).toContain('gap: 6px');
    expect(vitals).toContain('padding: 10px 14px 9px');
  });
});
