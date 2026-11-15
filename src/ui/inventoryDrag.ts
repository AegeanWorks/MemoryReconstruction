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
  if (
    value === 'slot:weapon' ||
    value === 'slot:armor' ||
    value === 'slot:trinket' ||
    value === 'slot:head'
  ) {
    return { kind: 'slot', slot: value.slice(5) as EquipmentSlot };
  }
  return { kind: 'none' };
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * The box an arrow key moves to: the nearest box centre that lies in that direction, with distance
 * off the line counted double so a box in the same row or column wins. Works from the boxes' real
 * positions, so the doll beside the bag on a wide screen and above it on a phone both navigate.
 * Returns `from` when nothing lies that way.
 */
export function nextInDirection(
  boxes: ReadonlyArray<{ x: number; y: number }>,
  from: number,
  dir: Direction
): number {
  const origin = boxes[from];
  if (!origin) return from;
  let best = from;
  let bestScore = Infinity;
  boxes.forEach((box, i) => {
    if (i === from) return;
    const dx = box.x - origin.x;
    const dy = box.y - origin.y;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    if (along <= 1) return;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export function dragStarted(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD;
}
