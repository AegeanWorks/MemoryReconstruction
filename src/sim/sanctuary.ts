/**
 * The Sanctuary hub is a UI screen, but each resident still lives in a real
 * room you can walk around. This module owns the village's data: which
 * buildings exist, what art faces them, and the sealed interior floor each one
 * builds for the dungeon World. The village square itself is not a floor.
 */
import type { BiomeId } from './content';
import type { FloorMap, Room } from './dungeon';
import { Deco, Tile, TileGrid, TILE_SIZE } from './tiles';

/** Every interior shares one tile footprint so the camera framing is uniform. */
const GRID_W = 25;
const GRID_H = 17;
const ROOM_X = 2;
const ROOM_Y = 2;
const ROOM_W = 21;
const ROOM_H = 13;

/** Arrival tile, exit tile and resident tile, identical in every interior. */
export const INTERIOR_SPAWN = { tx: 12, ty: 11 };
export const INTERIOR_EXIT = { tx: 12, ty: 14 };
export const INTERIOR_RESIDENT = { tx: 12, ty: 5 };

export interface SanctuaryDecorSpot {
  prop: string;
  tx: number;
  ty: number;
  size: number;
  /** Rugs render on the floor layer, under actors. */
  layer?: 'ground';
}

export interface SanctuaryBuilding {
  /** Resident id; also the building id used by the UI and events. */
  id: string;
  /** Shown on the hub card and the room title. */
  name: string;
  /** One line of role copy for the hub card. */
  role: string;
  /** Prop key of the facade art on the hub card. */
  facade: string;
  /** One line describing the room, for the hub card. */
  blurb: string;
  /** Biome art the room borrows, so every interior has its own material palette. */
  theme: BiomeId;
  /** Small prop shown on the hub card so residents are distinguishable by silhouette. */
  cardProp: string;
  /** Furniture inside the room, in this interior's tile coordinates. */
  decor: readonly SanctuaryDecorSpot[];
}

export const SANCTUARY_BUILDINGS: readonly SanctuaryBuilding[] = [
  {
    id: 'archivist',
    name: 'The Archive',
    role: 'Lorekeeper',
    facade: 'building_archive',
    blurb: 'Shelves of salvaged pages, and a table kept clear for you.',
    theme: 'crystal',
    cardProp: 'furn_shelf',
    decor: [
      { prop: 'furn_shelf', tx: 4, ty: 4, size: 66 },
      { prop: 'furn_shelf', tx: 6, ty: 4, size: 66 },
      { prop: 'furn_shelf', tx: 18, ty: 4, size: 66 },
      { prop: 'furn_shelf', tx: 20, ty: 4, size: 66 },
      { prop: 'furn_table', tx: 7, ty: 9, size: 66 },
      { prop: 'furn_chair', tx: 7, ty: 11, size: 42 },
      { prop: 'furn_chair', tx: 9, ty: 9, size: 42 },
      { prop: 'furn_bench', tx: 17, ty: 9, size: 62 },
      { prop: 'furn_lantern', tx: 4, ty: 12, size: 54 },
      { prop: 'furn_lantern', tx: 20, ty: 12, size: 54 },
      { prop: 'furn_books', tx: 4, ty: 8, size: 44 },
      { prop: 'furn_books', tx: 20, ty: 8, size: 42 },
      { prop: 'furn_candle', tx: 7, ty: 7, size: 40 },
      { prop: 'furn_candle', tx: 17, ty: 7, size: 40 },
      { prop: 'furn_shelf', tx: 3, ty: 8, size: 62 },
      { prop: 'furn_stool', tx: 19, ty: 11, size: 38 },
      { prop: 'furn_desk', tx: 12, ty: 3, size: 66 },
      { prop: 'furn_strings', tx: 8, ty: 3, size: 70 },
      { prop: 'furn_strings', tx: 16, ty: 3, size: 70 },
    ],
  },
  {
    id: 'smith',
    name: 'The Forge',
    role: 'Weaponsmith',
    facade: 'building_forge',
    blurb: 'Heat, hammer and a rack of half-finished blades.',
    theme: 'foundry',
    cardProp: 'furn_anvil',
    decor: [
      { prop: 'station_armory', tx: 6, ty: 4, size: 84 },
      { prop: 'station_hearth', tx: 18, ty: 4, size: 80 },
      { prop: 'furn_crate', tx: 20, ty: 8, size: 46 },
      { prop: 'furn_crate', tx: 20, ty: 10, size: 40 },
      { prop: 'barrel', tx: 20, ty: 12, size: 40 },
      { prop: 'barrel', tx: 3, ty: 8, size: 40 },
      { prop: 'furn_bench', tx: 5, ty: 11, size: 60 },
      { prop: 'furn_lantern', tx: 3, ty: 5, size: 54 },
      { prop: 'furn_anvil', tx: 10, ty: 8, size: 56 },
      { prop: 'furn_weapon_rack', tx: 14, ty: 3, size: 66 },
      { prop: 'furn_brazier', tx: 15, ty: 10, size: 50 },
      { prop: 'furn_stool', tx: 8, ty: 10, size: 38 },
      { prop: 'furn_weapon_rack', tx: 3, ty: 12, size: 60 },
      { prop: 'furn_cauldron', tx: 14, ty: 12, size: 54 },
      { prop: 'furn_strings', tx: 12, ty: 3, size: 66 },
    ],
  },
  {
    id: 'gardener',
    name: 'The Garden House',
    role: 'Grower',
    facade: 'building_garden',
    blurb: 'Green things that survived the dark, and a bench to sit on.',
    theme: 'forest',
    cardProp: 'ancient_tree',
    decor: [
      { prop: 'ancient_tree', tx: 5, ty: 4, size: 96 },
      { prop: 'furn_planter', tx: 9, ty: 4, size: 50 },
      { prop: 'furn_planter', tx: 16, ty: 4, size: 50 },
      { prop: 'furn_planter', tx: 19, ty: 5, size: 46 },
      { prop: 'furn_bench', tx: 7, ty: 9, size: 66 },
      { prop: 'furn_planter', tx: 18, ty: 9, size: 46 },
      { prop: 'furn_planter', tx: 17, ty: 12, size: 42 },
      { prop: 'furn_lantern', tx: 4, ty: 12, size: 54 },
      { prop: 'furn_vines', tx: 5, ty: 3, size: 58 },
      { prop: 'furn_vines', tx: 19, ty: 3, size: 58 },
      { prop: 'furn_vines', tx: 3, ty: 8, size: 54 },
      { prop: 'furn_herbs', tx: 9, ty: 9, size: 46 },
      { prop: 'furn_herbs', tx: 15, ty: 9, size: 46 },
      { prop: 'furn_stool', tx: 9, ty: 11, size: 38 },
      { prop: 'furn_cauldron', tx: 12, ty: 3, size: 56 },
      { prop: 'furn_desk', tx: 6, ty: 12, size: 64 },
    ],
  },
  {
    id: 'warden',
    name: 'The Barracks',
    role: 'Warden',
    facade: 'building_barracks',
    blurb: 'A drill mat, a shield on the wall, and no dust anywhere.',
    theme: 'frost',
    cardProp: 'station_bulwark',
    decor: [
      { prop: 'station_bulwark', tx: 6, ty: 4, size: 84 },
      { prop: 'station_training', tx: 18, ty: 4, size: 84 },
      { prop: 'furn_bench', tx: 15, ty: 6, size: 66 },
      { prop: 'furn_bench', tx: 7, ty: 9, size: 62 },
      { prop: 'furn_crate', tx: 4, ty: 12, size: 46 },
      { prop: 'furn_crate', tx: 17, ty: 11, size: 44 },
      { prop: 'furn_lantern', tx: 20, ty: 12, size: 54 },
      { prop: 'furn_weapon_rack', tx: 5, ty: 3, size: 62 },
      { prop: 'furn_weapon_rack', tx: 19, ty: 3, size: 62 },
      { prop: 'furn_brazier', tx: 14, ty: 9, size: 48 },
      { prop: 'furn_stool', tx: 5, ty: 8, size: 38 },
      { prop: 'furn_stool', tx: 19, ty: 9, size: 38 },
      { prop: 'furn_desk', tx: 12, ty: 3, size: 66 },
      { prop: 'furn_strings', tx: 8, ty: 3, size: 70 },
      { prop: 'furn_strings', tx: 16, ty: 3, size: 70 },
    ],
  },
  {
    id: 'lamplighter',
    name: 'The Lamp House',
    role: 'Lamplighter',
    facade: 'building_lamphouse',
    blurb: 'Every lamp in the Sanctuary is trimmed from this one room.',
    theme: 'catacomb',
    cardProp: 'furn_lantern',
    decor: [
      { prop: 'furn_lantern', tx: 6, ty: 4, size: 58 },
      { prop: 'furn_lantern', tx: 18, ty: 4, size: 58 },
      { prop: 'furn_lantern', tx: 4, ty: 9, size: 54 },
      { prop: 'furn_lantern', tx: 20, ty: 9, size: 54 },
      { prop: 'furn_table', tx: 8, ty: 9, size: 66 },
      { prop: 'furn_chair', tx: 8, ty: 11, size: 42 },
      { prop: 'furn_chair', tx: 6, ty: 9, size: 42 },
      { prop: 'furn_shelf', tx: 20, ty: 6, size: 62 },
      { prop: 'furn_candle', tx: 10, ty: 7, size: 42 },
      { prop: 'furn_candle', tx: 14, ty: 7, size: 42 },
      { prop: 'furn_brazier', tx: 16, ty: 9, size: 52 },
      { prop: 'furn_books', tx: 3, ty: 7, size: 42 },
      { prop: 'furn_stool', tx: 19, ty: 8, size: 38 },
      { prop: 'furn_strings', tx: 6, ty: 3, size: 76 },
      { prop: 'furn_strings', tx: 12, ty: 3, size: 76 },
      { prop: 'furn_strings', tx: 18, ty: 3, size: 76 },
    ],
  },
];

export function buildingById(id: string): SanctuaryBuilding | undefined {
  return SANCTUARY_BUILDINGS.find((b) => b.id === id);
}

/** Stations that live in the hub UI rather than in a walkable room. */
export interface SanctuaryStation {
  id: string;
  name: string;
  /** Short line shown under the station name in the hub. */
  hint: string;
}

export const SANCTUARY_STATIONS: readonly SanctuaryStation[] = [
  {
    id: 'restoration',
    name: 'Restore the Sanctuary',
    hint: 'Spend echoes to rebuild what was lost.',
  },
  { id: 'training', name: 'Training Yard', hint: 'Practise with the weapons you have found.' },
  { id: 'meditation', name: 'Meditation Stone', hint: 'Steady your mind between expeditions.' },
  {
    id: 'noticeboard',
    name: 'Notice Board',
    hint: 'Read the tasks the residents still need done.',
  },
  {
    id: 'reliquary',
    name: 'The Reliquary',
    hint: 'Attune one relic to start every expedition.',
  },
  {
    id: 'cairn',
    name: 'The Cairn',
    hint: 'Press echoes into shards for the road ahead.',
  },
  {
    id: 'aspect',
    name: 'The Aspect Shrine',
    hint: 'Mark your walker with an element.',
  },
  {
    id: 'reforge',
    name: 'The Reforge',
    hint: 'Reinforce a vault relic for every expedition.',
  },
];

export function spotToPixels(spot: { tx: number; ty: number }): { x: number; y: number } {
  return { x: (spot.tx + 0.5) * TILE_SIZE, y: (spot.ty + 0.5) * TILE_SIZE };
}

/**
 * Each room paints its own floor: a ward ring for the Archive, soot cracks for
 * the Forge, moss for the Garden, drill lines for the Barracks and pools of
 * lamplight for the Lamp House. The centre lane stays plain so the walk from
 * the door to the resident never runs over decoration.
 */
function interiorDeco(building: SanctuaryBuilding, tx: number, ty: number): Deco | undefined {
  const cx = INTERIOR_RESIDENT.tx;
  const cy = ROOM_Y + 7;
  const lane = Math.abs(tx - INTERIOR_EXIT.tx) <= 2;
  if (lane) return undefined;
  switch (building.theme) {
    case 'crystal': {
      const dist = Math.hypot(tx - cx, ty - cy);
      return dist > 3.6 && dist < 4.6 && Math.round(dist) === 4 ? Deco.Glyph : undefined;
    }
    case 'foundry': {
      const spread = Math.abs(tx - cx) + Math.abs(ty - cy);
      return (tx + ty) % 7 === 0 && spread > 4
        ? Deco.Crack
        : (tx * ty) % 29 === 0
          ? Deco.Rubble
          : undefined;
    }
    case 'forest': {
      const clump = Math.sin(tx * 1.7) + Math.cos(ty * 1.3);
      return clump > 0.7 ? Deco.Moss : undefined;
    }
    case 'frost': {
      // Straight drill lines: two verticals and one crossbar.
      const vertical =
        (tx === cx - 5 || tx === cx + 5) && ty > ROOM_Y + 2 && ty < ROOM_Y + ROOM_H - 2;
      const bar = ty === cy && Math.abs(tx - cx) <= 6 && tx !== cx;
      return vertical || bar ? Deco.Glyph : undefined;
    }
    case 'catacomb': {
      const pool = Math.hypot(tx - cx, ty - cy) < 2.2 || (ty === ROOM_Y + 2 && (tx - cx) % 5 === 0);
      return pool ? Deco.Glyph : undefined;
    }
    default:
      return undefined;
  }
}

function carveRoom(grid: TileGrid, decoAt: (tx: number, ty: number) => Deco | undefined): void {
  for (let ty = ROOM_Y; ty < ROOM_Y + ROOM_H; ty++)
    for (let tx = ROOM_X; tx < ROOM_X + ROOM_W; tx++) {
      grid.set(tx, ty, Tile.Floor);
      const deco = decoAt(tx, ty);
      grid.deco[grid.index(tx, ty)] = deco ?? Deco.None;
    }
  for (let ty = ROOM_Y - 1; ty <= ROOM_Y + ROOM_H; ty++)
    for (let tx = ROOM_X - 1; tx <= ROOM_X + ROOM_W; tx++) {
      if (tx >= ROOM_X && tx < ROOM_X + ROOM_W && ty >= ROOM_Y && ty < ROOM_Y + ROOM_H) continue;
      grid.set(tx, ty, Tile.Wall);
    }
}

/**
 * A single sealed room: walls all round, a lit ward ring, and a clear mat at
 * the entrance so the walker never spawns inside furniture.
 */
export function buildBuildingFloor(building: SanctuaryBuilding): FloorMap {
  const grid = new TileGrid(GRID_W, GRID_H);
  carveRoom(grid, (tx, ty) => interiorDeco(building, tx, ty));
  // Keep the door approach and the spot in front of the resident plain.
  for (let tx = INTERIOR_EXIT.tx - 2; tx <= INTERIOR_EXIT.tx + 2; tx++) {
    for (let ty = INTERIOR_EXIT.ty - 2; ty < ROOM_Y + ROOM_H; ty++)
      grid.deco[grid.index(tx, ty)] = Deco.None;
  }
  for (let tx = INTERIOR_RESIDENT.tx - 2; tx <= INTERIOR_RESIDENT.tx + 2; tx++)
    grid.deco[grid.index(tx, INTERIOR_RESIDENT.ty + 1)] = Deco.None;
  // A prop stands on its tile, so no floor glyph should be drawn under it.
  for (const item of building.decor) {
    if (
      item.tx >= ROOM_X &&
      item.tx < ROOM_X + ROOM_W &&
      item.ty >= ROOM_Y &&
      item.ty < ROOM_Y + ROOM_H
    )
      grid.deco[grid.index(item.tx, item.ty)] = Deco.None;
  }

  const room: Room = {
    id: 0,
    cellX: 0,
    cellY: 0,
    x: ROOM_X,
    y: ROOM_Y,
    w: ROOM_W,
    h: ROOM_H,
    kind: 'start',
    shape: 'rect',
    doors: [],
    distance: 0,
  };
  return {
    seed: 0x5a17 + building.id.length,
    depth: 0,
    grid,
    rooms: [room],
    startRoom: 0,
    bossRoom: 0,
  };
}
