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
  void: {
    floor: '#232740',
    floorAlt: '#1f2238',
    grout: '#141628',
    wallCap: '#08090f',
    wallFace: '#323858',
    wallMortar: '#1f2339',
    wallHighlight: '#6672a8',
    accent: '#6fe7ff',
    growth: '#b89cff',
    background: 0x030307,
    darkness: 0.74,
    floorStyle: 'tiles',
  },
  sanctuary: {
    floor: '#8c7d5c',
    floorAlt: '#837454',
    grout: '#5f5538',
    wallCap: '#3a3221',
    wallFace: '#c4ad78',
    wallMortar: '#8a7850',
    wallHighlight: '#fff0c2',
    accent: '#fff4d0',
    growth: '#ffd98a',
    background: 0x171307,
    darkness: 0.5,
    floorStyle: 'tiles',
  },
};

/** '#rrggbb' -> 0xrrggbb */
export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}
