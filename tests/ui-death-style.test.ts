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

describe('death screen style', () => {
  it('lights the scene with a crimson bloom behind the heading', () => {
    const body = ruleBody('.screen:has(> .heading.dead)');
    expect(body).toContain('radial-gradient(ellipse at 50% 14%');
    expect(body).toContain('rgba(255, 77, 94');
  });

  it('settles the heading in slowly', () => {
    expect(css).toContain('@keyframes dead-settle');
    expect(ruleBody('.heading.dead')).toContain('animation: dead-settle');
  });

  it('reveals the stat rows one after another', () => {
    expect(css).toContain('@keyframes stat-in');
    expect(ruleBody('.stats-panel .stats > *')).toContain('animation: stat-in');
    // The delay comes from a per-row --i set in the markup, so any row count cascades.
    expect(ruleBody('.stats-panel .stats > *')).toContain(
      'animation-delay: calc(var(--i, 0) * 70ms + 350ms)'
    );
    expect(css).not.toContain('.stats-panel .stats > :nth-child(');
  });

  it('stills them all under reduced motion', () => {
    const tail = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(tail).toContain('.heading.dead');
    expect(tail).toContain('.stats-panel .stats > *');
  });
});
