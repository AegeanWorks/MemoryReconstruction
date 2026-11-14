import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');
const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('relic rarity is readable without colour', () => {
  it('renders rarity as text in every relic row', () => {
    expect(screens).toContain('function rarityTag(');
    expect(screens).toContain("class: 'rarity-tag'");
    // Five relic row sites: reliquary, reforge, relic market, equipped slots, carried relics.
    const uses = screens.match(/rarityTag\(/g) ?? [];
    expect(uses.length).toBe(6); // one definition plus five call sites
  });

  it('separates the tag from the name in the DOM, not only with CSS margin', () => {
    // The source spells the separator with escapes so the file stays ASCII (eslint
    // no-irregular-whitespace); this asserts the escapes reach the template.
    expect(screens).toContain('`\\u00a0\\u00b7 ${rarity}`');
  });

  it('styles the tag as small uppercase dim text that still clears AA', () => {
    const start = css.indexOf('.rarity-tag {');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
    expect(body).toContain('text-transform: uppercase');
    expect(body).toContain('color: var(--ink-dim)');
    expect(body).toContain('font-size: 9px');
  });

  it('keeps text rarity on the upgrade cards too', () => {
    expect(screens).toContain("h('div', { class: 'rarity' }, def.rarity)");
  });
});
