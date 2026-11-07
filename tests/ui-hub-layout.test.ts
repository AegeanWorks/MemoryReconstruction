import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

/** Returns the body of the first `@media <query> { ... }` block. */
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

describe('Sanctuary hub responsive layout', () => {
  it('puts the six residents in one gallery row on wide screens', () => {
    const wide = mediaBlock('(min-width: 1180px)');
    expect(wide).toContain('.building-grid');
    expect(wide).toMatch(/grid-template-columns:\s*repeat\(6/);
  });

  it('keeps the expedition actions on screen at common laptop heights', () => {
    const medium = mediaBlock('(min-width: 1180px) and (max-height: 1000px)');
    expect(medium).toContain('.building-art');
    expect(medium).toMatch(/height:\s*72px/);
    expect(medium).toContain('-webkit-line-clamp: 2');

    const compact = mediaBlock('(max-height: 820px)');
    expect(compact).toContain('.building-art');
    expect(compact).toMatch(/display:\s*none/);
    expect(compact).toContain('.building-blurb');
    expect(compact).toContain('overflow-x: auto');
  });

  it('lets the compact height block win over the medium one', () => {
    const medium = css.indexOf('@media (min-width: 1180px) and (max-height: 1000px)');
    const compact = css.indexOf('@media (max-height: 820px)');
    expect(medium).toBeGreaterThanOrEqual(0);
    expect(compact).toBeGreaterThan(medium);
  });
});
