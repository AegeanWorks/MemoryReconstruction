/**
 * How worn relics change the wanderer's look. Armor re-colours the blue robe of the player sprite,
 * a cape re-colours its cyan cloak (a separate hue band, so the two never fight); a trinket adds
 * an orbiting glow. Pure data and pixel maths, so it runs in tests without a canvas.
 */
import type { EquipmentSlots } from '../sim/equipment';

export interface ArmorLook {
  /** Target hue of the robe, in degrees. */
  hue: number;
  /** Multiplies the robe saturation. */
  sat: number;
  /** Multiplies the robe brightness. */
  val: number;
}

export interface TrinketLook {
  /** Colour of the orbiting glow. */
  color: number;
  /** Size of the glow relative to the base orb. */
  scale: number;
}

/** Armor palettes, keyed by relic id. A test checks that every armor in equipment.json has one. */
export const ARMOR_LOOKS: Readonly<Record<string, ArmorLook>> = {
  scavenger_vest: { hue: 30, sat: 1.2, val: 1.25 },
  crystal_mail: { hue: 182, sat: 1.1, val: 1.45 },
  void_shroud: { hue: 275, sat: 0.95, val: 0.7 },
  mire_talisman: { hue: 105, sat: 0.9, val: 0.95 },
  colossus_plate: { hue: 215, sat: 0.1, val: 1.55 },
  duelist_mantle: { hue: 350, sat: 1.4, val: 1.05 },
};

/** Trinket glows, keyed by relic id. Common relics glow small, rare normal, epic large. */
export const TRINKET_LOOKS: Readonly<Record<string, TrinketLook>> = {
  ember_charm: { color: 0xff7a3a, scale: 0.8 },
  tide_lens: { color: 0x4fb8ff, scale: 1 },
  thorn_ring: { color: 0x7ee07a, scale: 1 },
  clockwork_gear: { color: 0xd9b45a, scale: 1.25 },
  sun_core: { color: 0xffd84a, scale: 1.25 },
  bog_crown: { color: 0x8fbf3a, scale: 1 },
  soul_anchor: { color: 0xb9a6ff, scale: 1 },
  storm_dial: { color: 0x9fe8ff, scale: 1 },
  ember_ward: { color: 0xff5a5a, scale: 1 },
};

/** Cape palettes, keyed by relic id. Every cape in equipment.json must have one. */
export const CAPE_LOOKS: Readonly<Record<string, ArmorLook>> = {
  tattered_cloak: { hue: 28, sat: 1.25, val: 0.95 },
  tidecloak: { hue: 210, sat: 1.35, val: 1.2 },
  ember_drape: { hue: 6, sat: 1.5, val: 1.15 },
  void_mantle: { hue: 285, sat: 1.15, val: 0.72 },
};

/** The robe blue sits here in the player sheets; nothing else in the sprite does. */
const ROBE_HUE_MIN = 205;
const ROBE_HUE_MAX = 255;
const ROBE_HUE_CENTRE = 230;
/** The cloak's cyan sits well below the robe band, so cape and armor can both recolour safely. */
const CAPE_HUE_MIN = 175;
const CAPE_HUE_MAX = 202;
const CAPE_HUE_CENTRE = 190;
const ROBE_MIN_SAT = 0.25;
/** Below this the pixel is the outline or deep shadow; leaving it keeps the silhouette crisp. */
const ROBE_MIN_VAL = 0.14;
/** How much of the robe's own hue variation survives, so shading keeps a little colour shift. */
const HUE_KEEP = 0.3;

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;
  const sector = Math.floor(hue / 60);
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector % 6];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Re-colours pixels inside one hue band; alpha is never touched. */
function recolorBand(
  data: Uint8ClampedArray,
  look: ArmorLook,
  hueMin: number,
  hueMax: number,
  hueCentre: number
): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (d === 0 || max < ROBE_MIN_VAL || d / max < ROBE_MIN_SAT) continue;
    const sector = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const hue = (sector * 60 + 360) % 360;
    if (hue < hueMin || hue > hueMax) continue;
    const [nr, ng, nb] = hsvToRgb(
      look.hue + (hue - hueCentre) * HUE_KEEP,
      Math.min(1, (d / max) * look.sat),
      Math.min(1, max * look.val)
    );
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

/** Re-colours the robe pixels of an RGBA buffer in place. */
export function recolorPixels(data: Uint8ClampedArray, look: ArmorLook): void {
  recolorBand(data, look, ROBE_HUE_MIN, ROBE_HUE_MAX, ROBE_HUE_CENTRE);
}

/** Re-colours the cloak pixels of an RGBA buffer in place; run after the robe pass. */
export function recolorCapePixels(data: Uint8ClampedArray, look: ArmorLook): void {
  recolorBand(data, look, CAPE_HUE_MIN, CAPE_HUE_MAX, CAPE_HUE_CENTRE);
}

export interface GearLooks {
  armorId: string | null;
  armor: ArmorLook | null;
  trinketId: string | null;
  trinket: TrinketLook | null;
  capeId: string | null;
  cape: ArmorLook | null;
}

/** The looks for what is worn; an id with no look is treated as nothing worn, never an error. */
export function gearLooks(equipment: EquipmentSlots): GearLooks {
  const armorId = equipment.armor?.defId ?? null;
  const trinketId = equipment.trinket?.defId ?? null;
  const capeId = equipment.cape?.defId ?? null;
  const armor = armorId !== null ? (ARMOR_LOOKS[armorId] ?? null) : null;
  const trinket = trinketId !== null ? (TRINKET_LOOKS[trinketId] ?? null) : null;
  const cape = capeId !== null ? (CAPE_LOOKS[capeId] ?? null) : null;
  return {
    armorId: armor ? armorId : null,
    armor,
    trinketId: trinket ? trinketId : null,
    trinket,
    capeId: cape ? capeId : null,
    cape,
  };
}
