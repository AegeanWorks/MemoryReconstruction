/**
 * Places a resident's overhead speech balloon. The balloon normally hangs
 * above the resident, but resident rooms hold the camera at the top of the
 * room: there the balloon would cross the room title and clip off-screen.
 * In that case it flips below the resident, and either way it is clamped to
 * the viewport.
 */

export interface BalloonPlacement {
  /** CSS `top` in screen pixels. */
  top: number;
  /** True when the balloon hangs below the resident instead of above. */
  below: boolean;
}

/** Screen band reserved for the room title and its control hint. */
const TITLE_BAND = 92;
/** Gap kept below a flipped balloon. */
const BOTTOM_MARGIN = 12;

export function placeBalloon(
  aboveAnchorY: number,
  belowAnchorY: number,
  height: number,
  viewportHeight: number
): BalloonPlacement {
  if (aboveAnchorY - height >= TITLE_BAND) {
    return { top: aboveAnchorY, below: false };
  }
  const lowest = Math.max(TITLE_BAND, viewportHeight - height - BOTTOM_MARGIN);
  return { top: Math.min(Math.max(belowAnchorY, TITLE_BAND), lowest), below: true };
}
