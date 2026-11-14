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

describe('title screen style', () => {
  it('sweeps a slow gold sheen across the title lettering', () => {
    expect(css).toContain('@keyframes title-sheen');
    const title = ruleBody('.title');
    expect(title).toContain('animation: title-sheen');
    expect(title).toContain('240% 100%');
  });

  it('lights the title scene with a warm bloom behind the lettering', () => {
    const body = ruleBody('.screen.clear:has(> .title)');
    expect(body).toContain('radial-gradient(ellipse at 50% 26%');
    expect(body).toContain('rgba(255, 190, 90');
  });

  it('breathes a glow on the primary action', () => {
    expect(css).toContain('@keyframes primary-breathe');
    expect(ruleBody('.title-menu .btn.primary')).toContain('animation: primary-breathe');
  });

  it('stills every title animation under reduced motion', () => {
    const idx = css.lastIndexOf('@media (prefers-reduced-motion: reduce)');
    const tail = css.slice(idx);
    expect(tail).toContain('.title');
    expect(tail).toContain('.title-menu .btn.primary');
  });
});
