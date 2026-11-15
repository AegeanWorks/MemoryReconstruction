import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');
const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('relic rarity is readable without colour', () => {
  it('renders rarity as text in every relic row', () => {
    expect(screens).toContain('function rarityTag(');
    expect(screens).toContain("class: 'rarity-tag'");
    // Four relic display sites: reliquary, reforge, relic market and the inventory detail pane. The
    // inventory's equipped and carried rows became one detail pane (ADR-215); its grid boxes name
    // the rarity in their accessible label instead.
    const uses = screens.match(/rarityTag\(/g) ?? [];
    expect(uses.length).toBe(5); // one definition plus four call sites
    const grid = readFileSync(join(__dirname, '../src/ui/InventoryGrid.ts'), 'utf8');
    expect(grid).toContain('· ${def.rarity} ${def.slot}');
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
