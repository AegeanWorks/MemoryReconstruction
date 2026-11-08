/**
 * Render palettes per biome. biomes.json carries thematic colours; these are
 * tuned for top-down readability (floor clearly lighter than walls, walls
 * clearly lighter than the void) while keeping each biome's identity.
 */
import type { BiomeId } from '../sim/content';

export type FloorStyle = 'slabs' | 'grass' | 'rock' | 'facets' | 'tiles';

export interface BiomeArt {
  floor: string;
  floorAlt: string;
  grout: string;
  wallCap: string;
  wallFace: string;
  wallMortar: string;
  wallHighlight: string;
  /** Glyphs, door barriers and ambient motes. */
  accent: string;
  /** Moss / flowers / crystals scattered on floors. */
  growth: string;
  background: number;
  /** Darkness around the player's light; alpha at the screen edge. */
  darkness: number;
  floorStyle: FloorStyle;
}

export const BIOME_ART: Record<BiomeId, BiomeArt> = {
  ruins: {
    floor: '#6e5c49',
    floorAlt: '#625241',
    grout: '#463a2f',
    wallCap: '#2b2521',
    wallFace: '#8c7459',
    wallMortar: '#5b4b3c',
    wallHighlight: '#b8a083',
    accent: '#ffd98a',
    growth: '#6f8a45',
    background: 0x0f0c0a,
    darkness: 0.62,
    floorStyle: 'slabs',
  },
  forest: {
    floor: '#3f5c2f',
    floorAlt: '#37522a',
    grout: '#2b3f1f',
    wallCap: '#17230f',
    wallFace: '#5d5a3e',
    wallMortar: '#3e3c28',
    wallHighlight: '#8fae68',
    accent: '#b7ff8a',
    growth: '#e8d36a',
    background: 0x081006,
    darkness: 0.66,
    floorStyle: 'grass',
  },
  caves: {
    floor: '#45465a',
    floorAlt: '#3d3e50',
    grout: '#2b2c3a',
    wallCap: '#15151d',
    wallFace: '#55566e',
    wallMortar: '#383949',
    wallHighlight: '#8a8ba6',
    accent: '#ff9a5a',
    growth: '#6fe7ff',
    background: 0x07070b,
    darkness: 0.72,
    floorStyle: 'rock',
  },
  crystal: {
    floor: '#3f3158',
    floorAlt: '#382b4f',
    grout: '#271d39',
    wallCap: '#170f25',
    wallFace: '#5f4486',
    wallMortar: '#3d2b58',
    wallHighlight: '#c7a2ff',
    accent: '#ff8ad8',
    growth: '#9ef3ff',
    background: 0x0c0716,
    darkness: 0.64,
    floorStyle: 'facets',
  },
  ash: {
    floor: '#4a3a36',
    floorAlt: '#43332f',
    grout: '#2c211f',
    wallCap: '#1a1312',
    wallFace: '#6b4a3e',
    wallMortar: '#422c25',
    wallHighlight: '#b8876b',
    accent: '#ff8a4c',
    growth: '#ffb35c',
    background: 0x0d0807,
    darkness: 0.7,
    floorStyle: 'rock',
  },
  abyss: {
    floor: '#233b4a',
    floorAlt: '#1f3542',
    grout: '#14232b',
    wallCap: '#0a1418',
    wallFace: '#2f5366',
    wallMortar: '#1d3540',
    wallHighlight: '#6fb7cc',
    accent: '#6fe7ff',
    growth: '#57d6c6',
    background: 0x04090c,
    darkness: 0.76,
    floorStyle: 'slabs',
  },
  frost: {
    // Darkened ~18% from the original wash: bright ice floors blew out the
    // player's cyan telegraphs and the HUD prompt on top of them.
    floor: '#74879a',
    floorAlt: '#6b7f92',
    grout: '#4c5a68',
    wallCap: '#333f4c',
    wallFace: '#9db4c6',
    wallMortar: '#67798a',
    wallHighlight: '#dceaf4',
    accent: '#bfe9ff',
    growth: '#dff3ff',
    background: 0x0b1218,
    darkness: 0.58,
    floorStyle: 'facets',
  },
  bloom: {
    floor: '#4a3a4f',
    floorAlt: '#42344a',
    grout: '#2c2233',
    wallCap: '#1a1320',
    wallFace: '#6e4f6f',
    wallMortar: '#463050',
    wallHighlight: '#d49ad4',
    accent: '#ff9ad8',
    growth: '#9ef3b0',
    background: 0x0c0710,
    darkness: 0.66,
    floorStyle: 'grass',
  },
  foundry: {
    floor: '#4a4038',
    floorAlt: '#42382f',
    grout: '#2a221c',
    wallCap: '#1c1712',
    wallFace: '#6b5844',
    wallMortar: '#3f3227',
    wallHighlight: '#c08a3e',
    accent: '#ffb347',
    growth: '#e0b96a',
    background: 0x0a0704,
    darkness: 0.68,
    floorStyle: 'slabs',
  },
  mire: {
    floor: '#33463a',
    floorAlt: '#2c3d32',
    grout: '#1b261f',
    wallCap: '#131c16',
    wallFace: '#4c5f48',
    wallMortar: '#2c3a2e',
    wallHighlight: '#6f8f4e',
    accent: '#b8e06a',
    growth: '#8fb76a',
    background: 0x060a07,
    darkness: 0.74,
    floorStyle: 'grass',
  },
  hive: {
    floor: '#4a3520',
    floorAlt: '#3e2c1b',
    grout: '#2a1b0d',
    wallCap: '#1a1108',
    wallFace: '#6b4a28',
    wallMortar: '#3f2a16',
    wallHighlight: '#e8c070',
    accent: '#ffb347',
    growth: '#e8c070',
    background: 0x0b0703,
    darkness: 0.7,
    floorStyle: 'grass',
  },
  catacomb: {
    floor: '#3e4446',
    floorAlt: '#343a3c',
    grout: '#202628',
    wallCap: '#141a1b',
    wallFace: '#59615f',
    wallMortar: '#333a39',
    wallHighlight: '#d8d2b8',
    accent: '#8fd8c8',
    growth: '#b8b09a',
    background: 0x080b0b,
    // 0.80 crushed bone piles and iron gates into silhouette; 0.72 keeps
    // the tomb gloom while hazards stay legible.
    darkness: 0.72,
    floorStyle: 'slabs',
  },
  void: {
    // Lifted ~12% with a stronger wall highlight: the void read as pure
    // black on dim displays and walls disappeared into the background.
    floor: '#2a2f4c',
    floorAlt: '#262a44',
    grout: '#181b30',
    wallCap: '#0c0e18',
    wallFace: '#3d4468',
    wallMortar: '#262b44',
    wallHighlight: '#7d88c0',
    accent: '#6fe7ff',
    growth: '#b89cff',
    background: 0x030307,
    darkness: 0.72,
    floorStyle: 'tiles',
  },
  tide: {
    // Drowned harbor stone: teal-dark floors with a bright sea-glass accent
    // so telegraphs and crystals pop against the water gloom.
    floor: '#2e4a52',
    floorAlt: '#29424a',
    grout: '#18292e',
    wallCap: '#0c1619',
    wallFace: '#3f6470',
    wallMortar: '#2a444b',
    wallHighlight: '#7fd4c1',
    accent: '#7fd4c1',
    growth: '#5ec8b4',
    background: 0x060d10,
    darkness: 0.7,
    floorStyle: 'tiles',
  },
  storm: {
    // Spire ramparts: cold cut stone with a pale sky accent; the brightest
    // floors in the rotation, so darkness sits a touch higher.
    floor: '#5a6b8c',
    floorAlt: '#516079',
    grout: '#39445a',
    wallCap: '#1b2233',
    wallFace: '#7d90b3',
    wallMortar: '#4d5a74',
    wallHighlight: '#c9d8ff',
    accent: '#c9d8ff',
    growth: '#9fb4dd',
    background: 0x0b1020,
    darkness: 0.6,
    floorStyle: 'slabs',
  },
  sanctuary: {
    floor: '#5f523f',
    floorAlt: '#574a38',
    grout: '#493d2b',
    wallCap: '#2f2619',
    wallFace: '#8b7452',
    wallMortar: '#6c5a40',
    wallHighlight: '#e8cf94',
    accent: '#ffe2a0',
    growth: '#8caf6a',
    background: 0x120f07,
    darkness: 0.62,
    floorStyle: 'tiles',
  },
};

/** '#rrggbb' -> 0xrrggbb */
export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}
