import { describe, expect, it } from 'vitest';
import {
  bagCells,
  dragStarted,
  nextInDirection,
  parseDropTarget,
  resolveDrop,
} from '../src/ui/inventoryDrag';
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

describe('nextInDirection', () => {
  // A 3x2 grid of box centres, 60 px apart, then one box far below on its own.
  const boxes = [
    { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 120, y: 0 },
    { x: 0, y: 60 }, { x: 60, y: 60 }, { x: 120, y: 60 },
    { x: 30, y: 200 },
  ];
  it('moves to the neighbour in each direction', () => {
    expect(nextInDirection(boxes, 1, 'left')).toBe(0);
    expect(nextInDirection(boxes, 1, 'right')).toBe(2);
    expect(nextInDirection(boxes, 1, 'down')).toBe(4);
    expect(nextInDirection(boxes, 4, 'up')).toBe(1);
  });
  it('prefers the box in line over a closer one off to the side', () => {
    expect(nextInDirection(boxes, 3, 'right')).toBe(4);
  });
  it('reaches a box that is not in any row, such as the doll above the bag', () => {
    expect(nextInDirection(boxes, 3, 'down')).toBe(6);
    expect(nextInDirection(boxes, 6, 'up')).toBe(3);
  });
  it('stays put at an edge', () => {
    expect(nextInDirection(boxes, 0, 'left')).toBe(0);
    expect(nextInDirection(boxes, 2, 'up')).toBe(2);
  });
});
