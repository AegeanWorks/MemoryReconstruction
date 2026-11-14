/**
 * Pure rules for dragging relics between the bag, the worn slots and the player.
 * The DOM layer (`InventoryGrid.ts`) only reports where a drag started and ended;
 * this module decides what that means, so the rules can be tested without a browser.
 */
import type { EquipmentSlot } from '../sim/equipment';

/** Where a dragged relic came from. */
export type DragSource =
  { from: 'bag'; slot: EquipmentSlot } | { from: 'worn'; slot: EquipmentSlot };

/** What the pointer was released over. */
export type DropTarget =
  { kind: 'slot'; slot: EquipmentSlot } | { kind: 'doll' } | { kind: 'bag' } | { kind: 'none' };

export type DropOutcome =
  | { action: 'equip' }
  | { action: 'unequip' }
  | { action: 'reject'; reason: string }
  | { action: 'none' };

/** Pixels the pointer must travel before a press becomes a drag, so a plain click still equips. */
export const DRAG_THRESHOLD = 6;

export function resolveDrop(source: DragSource, target: DropTarget): DropOutcome {
  if (source.from === 'worn') {
    return target.kind === 'bag' ? { action: 'unequip' } : { action: 'none' };
  }
  if (target.kind === 'doll') return { action: 'equip' };
  if (target.kind === 'slot') {
    return target.slot === source.slot
      ? { action: 'equip' }
      : {
          action: 'reject',
          reason: `That relic is ${source.slot} gear; it fits the ${source.slot} slot, not ${target.slot}.`,
        };
  }
  return { action: 'none' };
}

/** The carried relics padded with empty cells up to the bag capacity; never fewer cells than relics. */
export function bagCells<T>(carried: readonly T[], capacity: number): Array<T | null> {
  const cells: Array<T | null> = [...carried];
  while (cells.length < capacity) cells.push(null);
  return cells;
}

/** Reads a `data-drop` attribute: `slot:<slot>`, `doll` or `bag`; anything else is no target. */
export function parseDropTarget(value: string | null | undefined): DropTarget {
  if (value === 'doll') return { kind: 'doll' };
  if (value === 'bag') return { kind: 'bag' };
  if (value === 'slot:weapon' || value === 'slot:armor' || value === 'slot:trinket') {
    return { kind: 'slot', slot: value.slice(5) as EquipmentSlot };
  }
  return { kind: 'none' };
}

export function dragStarted(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD;
}
