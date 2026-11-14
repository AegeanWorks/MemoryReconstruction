import { describe, expect, it } from 'vitest';
import equipmentJson from '../src/data/equipment.json';
import {
  ARMOR_LOOKS,
  TRINKET_LOOKS,
  gearLooks,
  recolorPixels,
  type ArmorLook,
} from '../src/view/gearLook';
const items = (equipmentJson as { items: Array<{ id: string; slot: string }> }).items;
const rgba = (r: number, g: number, b: number, a = 255): Uint8ClampedArray =>
  new Uint8ClampedArray([r, g, b, a]);
function hueOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function recolored(pixel: Uint8ClampedArray, look: ArmorLook): Uint8ClampedArray {
  const copy = new Uint8ClampedArray(pixel);
  recolorPixels(copy, look);
  return copy;
}
describe('every worn relic has a look', () => {
  it('gives each armor in equipment.json a palette', () => {
    for (const item of items.filter((i) => i.slot === 'armor')) {
      expect(ARMOR_LOOKS[item.id], `armor ${item.id} has no look`).toBeDefined();
    }
  });
  it('gives each trinket in equipment.json an orb', () => {
    for (const item of items.filter((i) => i.slot === 'trinket')) {
      expect(TRINKET_LOOKS[item.id], `trinket ${item.id} has no look`).toBeDefined();
    }
  });
  it('has no look for a relic that does not exist', () => {
    const ids = new Set(items.map((i) => i.id));
    for (const id of [...Object.keys(ARMOR_LOOKS), ...Object.keys(TRINKET_LOOKS)]) {
      expect(ids.has(id), `${id} is not in equipment.json`).toBe(true);
    }
  });
  it('keeps every armor visibly different from the others on the robe colour', () => {
    const robe = rgba(52, 62, 108);
    const seen: Array<{ id: string; c: Uint8ClampedArray }> = [];
    for (const [id, look] of Object.entries(ARMOR_LOOKS)) {
      const c = recolored(robe, look);
      for (const other of seen) {
        const dist = Math.hypot(c[0] - other.c[0], c[1] - other.c[1], c[2] - other.c[2]);
        expect(dist, `${id} looks like ${other.id}`).toBeGreaterThan(40);
      }
      seen.push({ id, c });
    }
  });
});
describe('recolorPixels', () => {
  const void_ = ARMOR_LOOKS.void_shroud;
  it('moves the robe blue to the armor hue', () => {
    const [r, g, b] = recolored(rgba(52, 62, 108), void_);
    expect(Math.abs(hueOf(r, g, b) - void_.hue)).toBeLessThan(25);
  });
  it('leaves skin, gold, white, the cyan cape and the dark outline alone', () => {
    for (const px of [
      [173, 132, 105],
      [255, 217, 138],
      [255, 255, 255],
      [73, 185, 212],
      [10, 11, 22],
    ]) {
      expect([...recolored(rgba(px[0], px[1], px[2]), void_)]).toEqual([px[0], px[1], px[2], 255]);
    }
  });
  it('never changes the alpha channel and skips transparent pixels', () => {
    expect(recolored(rgba(52, 62, 108, 128), void_)[3]).toBe(128);
    expect([...recolored(rgba(52, 62, 108, 0), void_)]).toEqual([52, 62, 108, 0]);
  });
  it('keeps the shading: a lighter robe pixel stays lighter than a darker one', () => {
    const light = recolored(rgba(86, 104, 166), void_);
    const dark = recolored(rgba(31, 36, 66), void_);
    expect(light[0] + light[1] + light[2]).toBeGreaterThan(dark[0] + dark[1] + dark[2]);
  });
  it('recolours every pixel of a multi-pixel buffer', () => {
    const buf = new Uint8ClampedArray([52, 62, 108, 255, 52, 62, 108, 255]);
    recolorPixels(buf, void_);
    expect([...buf.slice(0, 4)]).toEqual([...buf.slice(4, 8)]);
    expect([...buf.slice(0, 3)]).not.toEqual([52, 62, 108]);
  });
});
describe('gearLooks', () => {
  const empty = { weapon: null, armor: null, trinket: null };
  it('reports nothing for an unarmoured wanderer', () => {
    expect(gearLooks(empty)).toEqual({ armorId: null, armor: null, trinketId: null, trinket: null });
  });
  it('reports the worn armor and trinket', () => {
    const looks = gearLooks({
      weapon: null,
      armor: { uid: 1, defId: 'crystal_mail' },
      trinket: { uid: 2, defId: 'sun_core' },
    });
    expect(looks.armorId).toBe('crystal_mail');
    expect(looks.armor).toBe(ARMOR_LOOKS.crystal_mail);
    expect(looks.trinketId).toBe('sun_core');
    expect(looks.trinket).toBe(TRINKET_LOOKS.sun_core);
  });
  it('ignores a relic id it has no look for instead of throwing', () => {
    const looks = gearLooks({ weapon: null, armor: { uid: 1, defId: 'mystery' }, trinket: null });
    expect(looks.armor).toBeNull();
    expect(looks.armorId).toBeNull();
  });
});
