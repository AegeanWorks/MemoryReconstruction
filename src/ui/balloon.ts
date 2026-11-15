/**
 * Places a resident's overhead speech balloon. The message belongs at the top
 * of the screen, above the resident rather than beneath them: resident rooms
 * hold the camera at the top of the room, so a balloon under the resident
 * would cover the room itself, and a balloon at the top still reads as speech
 * from the person below it. The balloon is clamped to the viewport.
 */

export interface BalloonPlacement {
  /** CSS `top` in screen pixels. */
  top: number;
}

/** Screen band reserved for the room title and its control hint. */
const TITLE_BAND = 92;
/** Gap kept below a clamped balloon. */
const BOTTOM_MARGIN = 12;

export function placeBalloon(
  aboveAnchorY: number,
  _belowAnchorY: number,
  height: number,
  viewportHeight: number
): BalloonPlacement {
  const ceiling = Math.max(0, viewportHeight - height - BOTTOM_MARGIN);
  // `top` is the bottom edge of the balloon (CSS translateY(-100%)). Above the
  // resident when the whole balloon clears the title band, otherwise its top
  // edge is pinned just under the room title: never below the resident.
  const wanted = aboveAnchorY - height >= TITLE_BAND ? aboveAnchorY : TITLE_BAND + height;
  return { top: Math.min(wanted, ceiling) };
}
