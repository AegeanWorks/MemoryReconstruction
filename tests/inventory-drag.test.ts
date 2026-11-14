import { describe, expect, it } from 'vitest';
import { bagCells, dragStarted, parseDropTarget, resolveDrop } from '../src/ui/inventoryDrag';
describe('parseDropTarget', () => {
  it('reads the three kinds of drop zone', () => {
    expect(parseDropTarget('slot:trinket')).toEqual({ kind: 'slot', slot: 'trinket' });
    expect(parseDropTarget('doll')).toEqual({ kind: 'doll' });
    expect(parseDropTarget('bag')).toEqual({ kind: 'bag' });
  });
  it('treats anything unknown as no target', () => {
    for (const value of [null, undefined, '', 'slot:helm', 'slot:', 'DOLL']) {
      expect(parseDropTarget(value)).toEqual({ kind: 'none' });
    }
  });
});
describe('resolveDrop', () => {
  it('equips a bag relic dropped on its own slot', () => {
    expect(resolveDrop({ from: 'bag', slot: 'armor' }, { kind: 'slot', slot: 'armor' })).toEqual({
      action: 'equip',
    });
  });
  it('equips a bag relic dropped on the player, whatever its slot', () => {
    for (const slot of ['weapon', 'armor', 'trinket'] as const) {
      expect(resolveDrop({ from: 'bag', slot }, { kind: 'doll' })).toEqual({ action: 'equip' });
    }
  });
  it('rejects a relic dropped on a different slot and names both slots', () => {
    const outcome = resolveDrop({ from: 'bag', slot: 'weapon' }, { kind: 'slot', slot: 'trinket' });
    expect(outcome.action).toBe('reject');
    if (outcome.action === 'reject') {
      expect(outcome.reason).toContain('weapon');
      expect(outcome.reason).toContain('trinket');
    }
  });
  it('does nothing when a bag relic is dropped back on the bag or on empty space', () => {
    expect(resolveDrop({ from: 'bag', slot: 'armor' }, { kind: 'bag' })).toEqual({ action: 'none' });
    expect(resolveDrop({ from: 'bag', slot: 'armor' }, { kind: 'none' })).toEqual({ action: 'none' });
  });
  it('unequips a worn relic dropped on the bag and ignores any other drop', () => {
    expect(resolveDrop({ from: 'worn', slot: 'armor' }, { kind: 'bag' })).toEqual({
      action: 'unequip',
    });
    expect(resolveDrop({ from: 'worn', slot: 'armor' }, { kind: 'doll' })).toEqual({
      action: 'none',
    });
    expect(resolveDrop({ from: 'worn', slot: 'armor' }, { kind: 'slot', slot: 'weapon' })).toEqual({
      action: 'none',
    });
  });
});
describe('bagCells', () => {
  it('pads the carried relics with empty cells up to the capacity', () => {
    const cells = bagCells([{ uid: 1 }, { uid: 2 }], 5);
    expect(cells).toHaveLength(5);
    expect(cells.map((c) => c?.uid ?? null)).toEqual([1, 2, null, null, null]);
  });
  it('never drops a relic when the bag holds more than its capacity', () => {
    expect(bagCells([{ uid: 1 }, { uid: 2 }, { uid: 3 }], 2)).toHaveLength(3);
  });
});
describe('dragStarted', () => {
  it('starts only after the pointer moved past the threshold', () => {
    expect(dragStarted(0, 0)).toBe(false);
    expect(dragStarted(3, 3)).toBe(false);
    expect(dragStarted(6, 0)).toBe(true);
    expect(dragStarted(-4, 5)).toBe(true);
  });
});
