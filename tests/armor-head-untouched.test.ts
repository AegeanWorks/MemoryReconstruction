import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARMOR_LOOKS, recolorPixels } from '../src/view/gearLook';

/**
 * The wanderer's own hood is drawn in the top rows of the 64 px frame in the
 * same blue as the robe. Armor must re-colour the robe and never the head, so a
 * hatless wanderer keeps the same hat under every armor.
 */

const FRAME = 64;

/** Reads a PNG into an RGBA buffer without a canvas, using the sheet only for its shape. */
function frameBuffer(): { data: Uint8ClampedArray; width: number } {
  // A synthetic 64x64 frame: hood rows 7-17, robe rows 26-50, both in robe blue.
  const width = FRAME;
  const data = new Uint8ClampedArray(FRAME * FRAME * 4);
  const put = (x: number, y: number): void => {
    const i = (y * width + x) * 4;
    data[i] = 52;
    data[i + 1] = 62;
    data[i + 2] = 108;
    data[i + 3] = 255;
  };
  for (let y = 7; y <= 17; y++) for (let x = 22; x <= 42; x++) put(x, y);
  for (let y = 26; y <= 50; y++) for (let x = 20; x <= 45; x++) put(x, y);
  return { data, width };
}

const pixel = (data: Uint8ClampedArray, x: number, y: number, width: number): number[] => {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
};

describe('armor never re-colours the wanderer’s hood', () => {
  it('leaves every hood row exactly as drawn', () => {
    for (const [id, look] of Object.entries(ARMOR_LOOKS)) {
      const { data } = frameBuffer();
      const before: number[][] = [];
      for (let y = 7; y <= 17; y++) before.push(pixel(data, 30, y, FRAME));
      recolorPixels(data, look, FRAME);
      for (let y = 7; y <= 17; y++) {
        expect(pixel(data, 30, y, FRAME), `${id} tinted hood row ${y}`).toEqual(before[y - 7]);
      }
    }
  });

  it('still re-colours the robe below the hood', () => {
    const { data } = frameBuffer();
    const original = pixel(data, 30, 35, FRAME);
    recolorPixels(data, ARMOR_LOOKS.crystal_mail, FRAME);
    expect(pixel(data, 30, 35, FRAME)).not.toEqual(original);
    // And in the direction of the crystal teal rather than staying blue.
    const [r, g, b] = pixel(data, 30, 35, FRAME);
    expect(g).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(r);
  });

  it('keeps working on a single-pixel buffer without a width', () => {
    const one = new Uint8ClampedArray([52, 62, 108, 255]);
    recolorPixels(one, ARMOR_LOOKS.void_shroud);
    expect([one[0], one[1], one[2]]).not.toEqual([52, 62, 108]);
  });

  it('passes the real frame width at both render sites', () => {
    const textures = readFileSync(join(__dirname, '../src/view/armorTextures.ts'), 'utf8');
    const doll = readFileSync(join(__dirname, '../src/ui/dollArt.ts'), 'utf8');
    expect(textures).toContain('recolorPixels(image.data, armor, width)');
    expect(doll).toContain('recolorPixels(data.data, armor, ctx.canvas.width)');
  });
});
