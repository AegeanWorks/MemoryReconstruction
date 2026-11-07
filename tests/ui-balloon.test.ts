import { describe, expect, it } from 'vitest';
import { placeBalloon } from '../src/ui/balloon';

describe('resident speech balloon placement', () => {
  it('stays above the resident when the title band has room', () => {
    expect(placeBalloon(300, 454, 60, 720)).toEqual({ top: 300, below: false });
  });

  it('flips below when the balloon would cross the room title band', () => {
    expect(placeBalloon(68, 230, 78, 720)).toEqual({ top: 230, below: true });
  });

  it('clamps a flipped balloon inside a short viewport', () => {
    const placement = placeBalloon(40, 180, 80, 200);
    expect(placement.below).toBe(true);
    expect(placement.top).toBeGreaterThanOrEqual(92);
    expect(placement.top + 80).toBeLessThanOrEqual(200);
  });
});
