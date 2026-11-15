import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');
const grid = read('../src/ui/InventoryGrid.ts');
const screens = read('../src/ui/Screens.ts');
const css = read('../src/ui/ui.css');
describe('inventory grid wiring', () => {
  it('mounts the grid in the inventory panel with the shared actions', () => {
    expect(screens).toMatch(/import \{ inventoryGrid[^}]*\} from '\.\/InventoryGrid';/);
    expect(screens).toMatch(/inventoryGrid\(\s*p,\s*\{ equip: equipFromBag, unequip: unequipSlot/);
  });
  // Replaced in the saves-and-inventory task (ADR-215): the list rows are gone; the detail pane is the
  // other path to the same helpers.
  it('routes the detail pane through the same equip and unequip helpers', () => {
    expect(screens).toContain('equip: equipFromBag,\n    unequip: unequipSlot,');
    expect(screens).toContain('() => act.equip(item.uid)');
    expect(screens).toContain('() => act.unequip(slot)');
  });
  it('drags with pointer events so touch works, and ignores non-primary mouse buttons', () => {
    for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      expect(grid).toContain(`'${event}'`);
    }
    expect(grid).toContain('setPointerCapture');
    expect(grid).toContain("event.pointerType === 'mouse' && event.button !== 0");
    expect(css).toMatch(/\.relic-box\.draggable\s*\{[^}]*touch-action:\s*none/);
  });
  // Replaced in the saves-and-inventory task (ADR-215): the grid is now the keyboard path.
  it('makes the grid the keyboard path: one tab stop, arrow keys, Enter selects', () => {
    expect(grid).toContain("box.tabIndex = key === focusKey ? 0 : -1");
    expect(grid).toContain('nextInDirection(');
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      expect(grid).toContain(`${key}: '`);
    }
    expect(grid).toContain("event.key === 'Enter' || event.key === ' '");
    expect(grid).toContain('box.dataset.action = key');
    expect(grid).toContain("box.setAttribute('aria-pressed', key === selected ? 'true' : 'false')");
  });
  it('selects on a plain click and wears or removes on a double click', () => {
    expect(grid).toContain('() => actions.select(key)');
    expect(grid).toContain("box.addEventListener('dblclick'");
  });
  it('declares the three drop zones the pure rules understand', () => {
    expect(grid).toContain('`slot:${slot}`');
    expect(grid).toContain("'data-drop': 'doll'");
    expect(grid).toContain("'data-drop': 'bag'");
  });
  it('sizes the bag grid from the bag capacity, not a literal', () => {
    expect(grid).toContain('bagCells(player.inventory, INVENTORY_SLOTS)');
  });
  it('stills the doll idle animation under reduced motion', () => {
    const tail = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(tail).toMatch(/\.doll-figure\s*\{\s*animation:\s*none/);
  });
});
