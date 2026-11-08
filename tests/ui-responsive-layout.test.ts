import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');
const html = readFileSync(join(__dirname, '../index.html'), 'utf8');

function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query}`);
  expect(start, `missing @media ${query}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed @media ${query}`);
}

function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('responsive UI review', () => {
  it('stacks checkpoint rows and shows the daily action at 390px', () => {
    const narrow = mediaBlock('(max-width: 560px)');
    expect(narrow).toContain('.checkpoint {');
    expect(narrow).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(narrow).toContain('.daily-panel .btn');
    expect(narrow).toMatch(/max-height:\s*40vh/);
  });

  it('keeps the mobile expedition actions fixed and the HUD kit wrapping', () => {
    const narrow = mediaBlock('(max-width: 560px)');
    expect(narrow).toMatch(/\.hub-expedition\s*\{[^}]*position:\s*fixed/s);
    expect(narrow).toContain('.hub-expedition .btn:disabled');
    expect(narrow).toMatch(/\.hud-kit\s*\{[^}]*white-space:\s*normal/s);
    expect(narrow).toMatch(/\.hud-vitals\s*\{[^}]*calc\(100vw - 24px\)/s);
  });

  it('wraps wide feats and bounds toasts and the loading title', () => {
    const wide = mediaBlock('(min-width: 1180px) and (max-height: 820px)');
    expect(wide).toMatch(/\.feats-panel\s*\{[^}]*flex-wrap:\s*wrap/s);
    expect(ruleBody('.toast')).toMatch(/white-space:\s*normal/);
    expect(html).toContain('clamp(1.5rem, 7vw, 3rem)');
    expect(html).toContain('overflow-wrap: anywhere');
  });
});
