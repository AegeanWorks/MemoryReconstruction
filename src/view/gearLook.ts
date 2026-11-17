/**
 * How worn relics change the wanderer's look. Armor re-colours the blue robe of the player sprite,
 * a cape re-colours its cyan cloak (a separate hue band, so the two never fight); a trinket adds
 * an orbiting glow. Pure data and pixel maths, so it runs in tests without a canvas.
 */
import relicColors from '@data/relic_colors.json';
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

/**
 * Hue comes from the relic's own icon (src/data/relic_colors.json, written by
 * scripts/generate_relic_icons.py), and these tables only tune saturation and
 * brightness so the robe reads as the metal or cloth the icon draws.
 */
const ARMOR_TUNING: Readonly<Record<string, { sat: number; val: number }>> = {
  scavenger_vest: { sat: 1.5, val: 1.25 },
  crystal_mail: { sat: 1.2, val: 1.25 },
  void_shroud: { sat: 1.15, val: 0.75 },
  mire_talisman: { sat: 1.6, val: 1.35 },
  colossus_plate: { sat: 0.15, val: 1.45 },
  duelist_mantle: { sat: 1.5, val: 1.15 },
};

interface RelicColor {
  hue: number;
  sat: number;
  val: number;
}
const ICON_COLORS = relicColors as Record<string, RelicColor>;

/** One look per tuned relic, taking its hue from the icon's dominant colour. */
function iconLooks(
  tuning: Readonly<Record<string, { sat: number; val: number }>>
): Readonly<Record<string, ArmorLook>> {
  const looks: Record<string, ArmorLook> = {};
  for (const [id, tune] of Object.entries(tuning)) {
    looks[id] = { hue: ICON_COLORS[id]?.hue ?? 0, sat: tune.sat, val: tune.val };
  }
  return looks;
}

/** Armor palettes, keyed by relic id. A test checks that every armor has one. */
export const ARMOR_LOOKS: Readonly<Record<string, ArmorLook>> = iconLooks(ARMOR_TUNING);

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

/** Headwear silhouettes: each head relic changes the shape worn above the head. */
export type HeadShape = 'hood' | 'helm' | 'circlet' | 'visor';

export interface HeadLook {
  shape: HeadShape;
  /** Fill colour of the headwear, as 0xRRGGBB. */
  color: number;
  /** Optional trim colour for the band, brim or gem. */
  trim: number;
}

/**
 * Headwear looks, keyed by relic id. Every head item in equipment.json must have
 * one, so a new hat cannot ship without its silhouette.
 */
export const HEAD_LOOKS: Readonly<Record<string, HeadLook>> = {
  scout_hood: { shape: 'hood', color: 0x4a6a3a, trim: 0x2c3f22 },
  iron_helm: { shape: 'helm', color: 0x8d949c, trim: 0x5a6169 },
  oracle_circlet: { shape: 'circlet', color: 0xd9b45a, trim: 0x7ee6ff },
  void_visor: { shape: 'visor', color: 0x4a3a6a, trim: 0xb9a6ff },
};

const CAPE_TUNING: Readonly<Record<string, { sat: number; val: number }>> = {
  tattered_cloak: { sat: 1.6, val: 1.25 },
  tidecloak: { sat: 1.25, val: 1.3 },
  ember_drape: { sat: 1.6, val: 1.2 },
  void_mantle: { sat: 1.1, val: 0.8 },
};

/** Cape palettes, keyed by relic id. Every cape in equipment.json must have one. */
export const CAPE_LOOKS: Readonly<Record<string, ArmorLook>> = iconLooks(CAPE_TUNING);

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
/**
 * The wanderer's own hood is drawn in rows 7-17 of a 64 px frame and the
 * robe starts at row 26. Armor re-colours cloth, never the head, so the robe
 * pass begins below the hood; headwear is drawn as its own layer on top.
 */
const HOOD_BOTTOM = 26 / 64;
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
  hueCentre: number,
  width = Math.max(1, data.length / 4),
  minRow = 0
): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    if (minRow > 0 && Math.floor(i / 4 / width) < minRow) continue;
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

/**
 * Re-colours the robe pixels of an RGBA buffer in place. Pass the frame width
 * so the hood (and the head under it) is left alone; without a width the whole
 * buffer is treated as one column, which keeps single-pixel tests working.
 */
export function recolorPixels(
  data: Uint8ClampedArray,
  look: ArmorLook,
  width = Math.max(1, data.length / 4)
): void {
  const height = data.length / 4 / width;
  const minRow = height > 1 ? Math.round(height * HOOD_BOTTOM) : 0;
  recolorBand(data, look, ROBE_HUE_MIN, ROBE_HUE_MAX, ROBE_HUE_CENTRE, width, minRow);
}

/** Re-colours the cloak pixels of an RGBA buffer in place; run after the robe pass. */
export function recolorCapePixels(
  data: Uint8ClampedArray,
  look: ArmorLook,
  width = Math.max(1, data.length / 4)
): void {
  recolorBand(data, look, CAPE_HUE_MIN, CAPE_HUE_MAX, CAPE_HUE_CENTRE, width);
}

export interface GearLooks {
  armorId: string | null;
  armor: ArmorLook | null;
  trinketId: string | null;
  trinket: TrinketLook | null;
  capeId: string | null;
  cape: ArmorLook | null;
  headId: string | null;
  head: HeadLook | null;
}

/** The looks for what is worn; an id with no look is treated as nothing worn, never an error. */
export function gearLooks(equipment: EquipmentSlots): GearLooks {
  const armorId = equipment.armor?.defId ?? null;
  const trinketId = equipment.trinket?.defId ?? null;
  const capeId = equipment.cape?.defId ?? null;
  const armor = armorId !== null ? (ARMOR_LOOKS[armorId] ?? null) : null;
  const trinket = trinketId !== null ? (TRINKET_LOOKS[trinketId] ?? null) : null;
  const cape = capeId !== null ? (CAPE_LOOKS[capeId] ?? null) : null;
  const headId = equipment.head?.defId ?? null;
  const head = headId !== null ? (HEAD_LOOKS[headId] ?? null) : null;
  return {
    armorId: armor ? armorId : null,
    armor,
    trinketId: trinket ? trinketId : null,
    trinket,
    capeId: cape ? capeId : null,
    cape,
    headId: head ? headId : null,
    head,
  };
}
