/**
 * Ambient particle fields for each biome. These are presentation only: the
 * renderer uses them to decide the colour, texture, motion and density of the
 * slow motes that drift through a room.
 */
import type { BiomeId } from '../sim/content';

export type AtmosphereTexture = 'spark' | 'flake' | 'petal' | 'smoke' | 'bubble';
export type AtmosphereMotion = 'rise' | 'fall' | 'drift' | 'wander';
export type AtmosphereBlend = 'add' | 'normal';

export interface AtmosphereLayer {
  /** Texture key in `fxTextures()`. */
  texture: AtmosphereTexture;
  blend: AtmosphereBlend;
  motion: AtmosphereMotion;
  /** Tint colours; a mote picks one at random. */
  colors: readonly number[];
  count: number;
  size: readonly [number, number];
  /** Vertical speed in px/s; positive falls, negative rises. */
  speed: readonly [number, number];
  drift: readonly [number, number];
  sway: number;
  swayRate: readonly [number, number];
  spin: readonly [number, number];
  /** Base opacity range; the sprite also fades in and out over its life. */
  alpha: readonly [number, number];
  life: readonly [number, number];
  /** Flicker the opacity like an ember or firefly. */
  pulse?: boolean;
}

export interface AtmosphereProfile {
  layers: readonly AtmosphereLayer[];
}

/** Reusable layer shapes; a biome supplies its own colours and count. */
type LayerPreset = Omit<AtmosphereLayer, 'colors' | 'count'>;

const DUST: LayerPreset = {
  texture: 'spark',
  blend: 'add',
  motion: 'drift',
  size: [1.2, 2.6],
  speed: [-6, -2],
  drift: [-5, 5],
  sway: 3,
  swayRate: [0.3, 0.8],
  spin: [0, 0],
  alpha: [0.14, 0.32],
  life: [5, 11],
};

const SPORE: LayerPreset = {
  texture: 'spark',
  blend: 'add',
  motion: 'rise',
  size: [1.4, 3],
  speed: [-16, -6],
  drift: [-6, 6],
  sway: 6,
  swayRate: [0.7, 1.6],
  spin: [0, 0],
  alpha: [0.18, 0.45],
  life: [5, 12],
};

const EMBER: LayerPreset = {
  texture: 'spark',
  blend: 'add',
  motion: 'rise',
  size: [1.2, 2.6],
  speed: [-42, -18],
  drift: [-10, 10],
  sway: 4,
  swayRate: [1, 2.4],
  spin: [0, 0],
  alpha: [0.35, 0.75],
  life: [3, 7],
  pulse: true,
};

const ASH: LayerPreset = {
  texture: 'flake',
  blend: 'normal',
  motion: 'fall',
  size: [1.2, 2.8],
  speed: [8, 20],
  drift: [-8, 8],
  sway: 5,
  swayRate: [0.5, 1.4],
  spin: [0.3, 1.2],
  alpha: [0.18, 0.4],
  life: [6, 13],
};

const SNOW: LayerPreset = {
  texture: 'flake',
  blend: 'normal',
  motion: 'fall',
  size: [1.5, 3.2],
  speed: [18, 40],
  drift: [-10, 10],
  sway: 8,
  swayRate: [0.6, 1.6],
  spin: [0.4, 1.6],
  alpha: [0.35, 0.7],
  life: [5, 11],
};

const PETAL: LayerPreset = {
  texture: 'petal',
  blend: 'normal',
  motion: 'fall',
  size: [2.4, 4.4],
  speed: [10, 22],
  drift: [-14, 14],
  sway: 12,
  swayRate: [0.7, 1.7],
  spin: [1.2, 3.2],
  alpha: [0.35, 0.65],
  life: [5, 10],
};

const BUBBLE: LayerPreset = {
  texture: 'bubble',
  blend: 'normal',
  motion: 'rise',
  size: [1.6, 3.6],
  speed: [-18, -6],
  drift: [-4, 4],
  sway: 5,
  swayRate: [1, 2.2],
  spin: [0, 0],
  alpha: [0.25, 0.55],
  life: [4, 9],
};

const SMOKE: LayerPreset = {
  texture: 'smoke',
  blend: 'normal',
  motion: 'rise',
  size: [6, 16],
  speed: [-10, -3],
  drift: [-6, 6],
  sway: 4,
  swayRate: [0.2, 0.6],
  spin: [0.05, 0.2],
  alpha: [0.05, 0.14],
  life: [6, 14],
};

/** Slow, directionless float for void and crystal rooms. */
const FLOAT: LayerPreset = {
  texture: 'spark',
  blend: 'add',
  motion: 'wander',
  size: [1.2, 2.8],
  speed: [-4, 4],
  drift: [-8, 8],
  sway: 4,
  swayRate: [0.2, 0.6],
  spin: [0, 0],
  alpha: [0.18, 0.5],
  life: [5, 12],
};

const FIREFLY: LayerPreset = {
  texture: 'spark',
  blend: 'add',
  motion: 'wander',
  size: [1.6, 2.8],
  speed: [-6, 6],
  drift: [-12, 12],
  sway: 6,
  swayRate: [1.5, 3],
  spin: [0, 0],
  alpha: [0.15, 0.8],
  life: [4, 9],
  pulse: true,
};

function layer(preset: LayerPreset, colors: readonly number[], count: number): AtmosphereLayer {
  return { ...preset, colors, count };
}

/**
 * One field per biome. Counts stay between 32 and 48 so the air reads as
 * alive without turning into confetti or costing a frame.
 */
export const ATMOSPHERE: Record<BiomeId, AtmosphereProfile> = {
  ruins: {
    layers: [layer(DUST, [0xffd98a, 0xe8c88a], 26), layer(ASH, [0xcdb98f], 10)],
  },
  forest: {
    layers: [layer(SPORE, [0xb7ff8a, 0x9ee06a], 26), layer(PETAL, [0x7aa548, 0x5f8a3a], 8)],
  },
  caves: {
    layers: [layer(DUST, [0x6fe7ff, 0x9ad9ff], 22), layer(ASH, [0x8a8ba6], 10)],
  },
  crystal: {
    layers: [layer(FLOAT, [0xff8ad8, 0xc7a2ff, 0x9ef3ff], 30), layer(SNOW, [0x9ef3ff], 8)],
  },
  ash: {
    layers: [layer(EMBER, [0xff8a4c, 0xffb35c], 22), layer(ASH, [0x9a8070, 0x6b5a50], 16)],
  },
  foundry: {
    layers: [
      layer(EMBER, [0xffb347, 0xff8a3c], 20),
      layer(SMOKE, [0x5a4a3a], 10),
      layer(ASH, [0x3a3028], 8),
    ],
  },
  abyss: {
    layers: [layer(BUBBLE, [0x6fe7ff, 0x57d6c6], 22), layer(FLOAT, [0x57d6c6, 0x2f8f88], 10)],
  },
  void: {
    layers: [layer(FLOAT, [0xb89cff, 0x6fe7ff], 28), layer(ASH, [0x6672a8], 8)],
  },
  frost: {
    // 48 motes turned snowfall into confetti over bright ice; 38 keeps the
    // storm while telegraphs and pickups stay readable.
    layers: [layer(SNOW, [0xffffff, 0xbfe9ff], 30), layer(FLOAT, [0xdff3ff], 8)],
  },
  mire: {
    layers: [
      layer(FIREFLY, [0xb8e06a, 0xe8ff9a], 12),
      layer(SPORE, [0x8fb76a, 0x6f9a4e], 22),
      layer(PETAL, [0x5a7a42], 6),
    ],
  },
  bloom: {
    layers: [
      layer(PETAL, [0xff9ad8, 0xffb8e8, 0xd88aff], 22),
      layer(SPORE, [0x9ef3b0, 0xe8ffb0], 18),
    ],
  },
  hive: {
    layers: [layer(DUST, [0xffb347, 0xe8c070], 28), layer(ASH, [0x8a6a3a], 8)],
  },
  catacomb: {
    layers: [layer(ASH, [0xb8b09a, 0x8f8a78], 30), layer(FLOAT, [0x8fd8c8], 8)],
  },
  sanctuary: {
    layers: [layer(DUST, [0xffe2a0, 0xffd98a], 30), layer(FLOAT, [0xffffff, 0xfff4d0], 8)],
  },
  tide: {
    layers: [layer(BUBBLE, [0x7fd4c1, 0xbfe8dd], 24), layer(FLOAT, [0x57d6c6, 0x3f9f96], 12)],
  },
  storm: {
    layers: [layer(SNOW, [0xe4ecff, 0xc9d8ff], 26), layer(DUST, [0x9fb4dd], 10)],
  },
};

export function atmosphereFor(biome: BiomeId): AtmosphereProfile {
  return ATMOSPHERE[biome];
}
