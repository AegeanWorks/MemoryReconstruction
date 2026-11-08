import { describe, expect, it } from 'vitest';
import { cameraFocus } from '../src/view/camera';

describe('boss camera framing', () => {
  it('frames the boss head and feet without pushing the player off centre', () => {
    const focus = cameraFocus(
      { x: 100, y: 200 },
      { x: 100, y: 100, displayHeight: 200 }
    );
    // The raw midpoint is 60, but the player offset is capped at 80.
    expect(focus.y).toBe(120);
    expect(focus.x).toBe(100);
    expect(Math.abs(focus.y - 200)).toBeLessThanOrEqual(80);
  });

  it('keeps the player as the focus when no boss is active', () => {
    expect(cameraFocus({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
  });

  it('pulls the focus toward a boss that is above and to the side', () => {
    const focus = cameraFocus(
      { x: 400, y: 500 },
      { x: 200, y: 300, displayHeight: 120 }
    );
    expect(focus.x).toBe(300);
    expect(focus.y).toBe(420);
    expect(Math.abs(focus.y - 500)).toBeLessThanOrEqual(80);
  });

  it('keeps the player above the HUD even for a huge boss above them', () => {
    const player = { x: 700, y: 900 };
    const focus = cameraFocus(player, { x: 700, y: 848, displayHeight: 192 });
    expect(focus.y).toBe(820);
    expect(focus.y).toBeGreaterThanOrEqual(player.y - 80);
  });
});
