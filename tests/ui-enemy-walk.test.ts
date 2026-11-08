import { describe, expect, it } from 'vitest';
import spriteAtlas from '../src/data/sprite_atlas.json';
import { walkRateFor } from '../src/view/sheets';

/**
 * Commit 284ffc6 switched enemy movement from the idle strip to the real walk
 * row. The atlas must keep four populated walk frames per sheet, and the view
 * cadence must follow sim speed without becoming unreadable.
 */
describe('enemy walk animation', () => {
  it('gives every atlas sheet a four-frame walk row', () => {
    for (const [id, entry] of Object.entries(spriteAtlas.enemies)) {
      expect(entry.animations.walk, id).toBeDefined();
      expect(entry.animations.walk.frames, id).toBe(4);
    }
  });

  it('scales walk cadence with sim speed and clamps the extremes', () => {
    expect(walkRateFor(40)).toBe(0.75);
    expect(walkRateFor(80)).toBe(1);
    expect(walkRateFor(120)).toBe(1.5);
    expect(walkRateFor(200)).toBe(1.5);
  });
});
