/** Camera focus shared by the renderer and its tests. */
export interface FocusPoint {
  x: number;
  y: number;
}

export interface BossFocusTarget extends FocusPoint {
  /** Visual height in world pixels, from the enemy definition. */
  displayHeight: number;
}

/** Maximum world pixels the camera may push the player off centre vertically. */
export const BOSS_FOCUS_PLAYER_OFFSET = 80;

/**
 * Frame the player and the active boss together. A boss's origin is at its
 * feet (the sprite is anchored near the bottom), so the head sits roughly
 * `displayHeight * 0.9` above its y. Centring between the head, the feet and
 * the player keeps giant bosses from clipping off the top of the screen.
 */
export function cameraFocus(player: FocusPoint, boss?: BossFocusTarget): FocusPoint {
  if (!boss) return { x: player.x, y: player.y };
  const headY = boss.y - boss.displayHeight * 0.9;
  const midpoint = (Math.min(player.y, headY) + Math.max(player.y, boss.y)) / 2;
  // Do not let a giant boss push the walker under the HUD. The boss head still
  // stays inside the 520px view because the offset is capped, not removed.
  const y = Math.max(
    player.y - BOSS_FOCUS_PLAYER_OFFSET,
    Math.min(player.y + BOSS_FOCUS_PLAYER_OFFSET, midpoint)
  );
  return { x: (player.x + boss.x) / 2, y };
}
