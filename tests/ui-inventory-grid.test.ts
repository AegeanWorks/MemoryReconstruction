import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');
const grid = read('../src/ui/InventoryGrid.ts');
const screens = read('../src/ui/Screens.ts');
const css = read('../src/ui/ui.css');
describe('inventory grid wiring', () => {
  it('mounts the grid in the inventory panel with the shared actions', () => {
    expect(screens).toContain("import { inventoryGrid } from './InventoryGrid';");
    expect(screens).toContain('inventoryGrid(p, { equip: equipFromBag, unequip: unequipSlot');
  });
  it('routes the list rows through the same equip and unequip helpers', () => {
    expect(screens).toContain('const equip = (): void => equipFromBag(item.uid);');
    expect(screens).toContain("button('Unequip', () => unequipSlot(slot), 'btn small')");
  });
  it('drags with pointer events so touch works, and ignores non-primary mouse buttons', () => {
    for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      expect(grid).toContain(`'${event}'`);
    }
    expect(grid).toContain('setPointerCapture');
    expect(grid).toContain("event.pointerType === 'mouse' && event.button !== 0");
    expect(css).toMatch(/\.relic-box\.draggable\s*\{[^}]*touch-action:\s*none/);
  });
  it('leaves the list rows as the keyboard path: no action keys or tab stops on the boxes', () => {
    expect(grid).not.toContain('data-action');
    expect(grid).not.toContain('dataset.action');
    expect(grid).not.toContain('tabindex');
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
