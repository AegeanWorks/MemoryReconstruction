/**
 * Level-up cards appear on top of a fight, often under the cursor that was
 * just clicking to attack. A card must never be taken by that click or by a
 * double-click: it arms after a short grace, and a mouse click only counts
 * once the pointer has actually travelled toward a card (or after a long,
 * stationary pause that proves the player is reading rather than swinging).
 * Touch taps are deliberate after the grace, and keyboard digits bypass this.
 */

/** Earliest a click may take a card. */
const ARM_MS = 550;
/** Movement from the pointer's entry point that proves a deliberate choice. */
const TRAVEL_PX = 8;
/** After this long a resting cursor may click, so a still mouse is not a trap. */
const SETTLE_MS = 1500;

export function choiceArmed(now: number, openedAt: number, pointerTravel: number): boolean {
  const elapsed = now - openedAt;
  if (elapsed < ARM_MS) return false;
  return pointerTravel >= TRAVEL_PX || elapsed >= SETTLE_MS;
}

/** A click detail above 1 is the second or later click of a double/triple click. */
export function deliberateClick(detail: number): boolean {
  return detail <= 1;
}
