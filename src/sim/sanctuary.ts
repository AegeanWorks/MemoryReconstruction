/**
 * The Sanctuary as a place rather than a menu: a compact hall with the seven
 * restorations, three civic stations, five NPCs and the gate the expeditions
 * leave from. It reuses the dungeon World for movement, collision, camera and
 * interactables, while its layout stays tight enough that the hall reads at a
 * glance instead of as an empty courtyard.
 */
import type { FloorMap, Room } from './dungeon';
import { Deco, Tile, TileGrid, TILE_SIZE } from './tiles';

export interface SanctuarySpot {
  kind: 'structure' | 'npc' | 'gate';
  id: string;
  tx: number;
  ty: number;
}

export const SANCTUARY_STRUCTURES: readonly SanctuarySpot[] = [
  { kind: 'structure', id: 'hearth', tx: 20, ty: 10 },
  { kind: 'structure', id: 'armory', tx: 25, ty: 10 },
  { kind: 'structure', id: 'infirmary', tx: 30, ty: 10 },
  { kind: 'structure', id: 'wellspring', tx: 35, ty: 10 },
  { kind: 'structure', id: 'watchtower', tx: 40, ty: 10 },
  { kind: 'structure', id: 'vault', tx: 45, ty: 10 },
  { kind: 'structure', id: 'bulwark', tx: 20, ty: 23 },
  { kind: 'structure', id: 'training', tx: 39, ty: 23 },
  { kind: 'structure', id: 'meditation', tx: 45, ty: 23 },
  { kind: 'structure', id: 'noticeboard', tx: 23, ty: 14 },
];

/** Labels for stations that are not restorations. */
export const SANCTUARY_LABELS: Readonly<Record<string, string>> = {
  training: 'Training Yard',
  meditation: 'Meditation Stone',
  noticeboard: 'Notice Board',
};

export const SANCTUARY_NPCS: readonly SanctuarySpot[] = [
  { kind: 'npc', id: 'archivist', tx: 19, ty: 18 },
  { kind: 'npc', id: 'smith', tx: 32, ty: 13 },
  { kind: 'npc', id: 'gardener', tx: 46, ty: 18 },
  { kind: 'npc', id: 'warden', tx: 26, ty: 23 },
  { kind: 'npc', id: 'lamplighter', tx: 37, ty: 18 },
];

export interface SanctuaryDecorSpot {
  prop: string;
  tx: number;
  ty: number;
  size: number;
  /** Rugs render on the floor layer, under actors. */
  layer?: 'ground';
}

/** Non-interactive furniture and clutter that makes the hall lived-in. */
export const SANCTUARY_DECOR: readonly SanctuaryDecorSpot[] = [
  { prop: 'furn_table', tx: 27, ty: 13, size: 62 },
  { prop: 'furn_chair', tx: 25, ty: 13, size: 42 },
  { prop: 'furn_chair', tx: 29, ty: 13, size: 42 },
  { prop: 'furn_shelf', tx: 13, ty: 13, size: 62 },
  { prop: 'furn_shelf', tx: 51, ty: 13, size: 62 },
  { prop: 'furn_crate', tx: 14, ty: 21, size: 44 },
  { prop: 'furn_crate', tx: 15, ty: 22, size: 40 },
  { prop: 'furn_crate', tx: 50, ty: 21, size: 44 },
  { prop: 'furn_planter', tx: 15, ty: 16, size: 46 },
  { prop: 'furn_planter', tx: 50, ty: 16, size: 46 },
  { prop: 'furn_planter', tx: 35, ty: 14, size: 42 },
  { prop: 'furn_lantern', tx: 22, ty: 17, size: 50 },
  { prop: 'furn_lantern', tx: 42, ty: 17, size: 50 },
  { prop: 'furn_lantern', tx: 29, ty: 21, size: 50 },
  { prop: 'barrel', tx: 49, ty: 22, size: 38 },
  { prop: 'furn_rug', tx: 32, ty: 17, size: 152, layer: 'ground' },
  { prop: 'furn_rug', tx: 26, ty: 20, size: 74, layer: 'ground' },
  { prop: 'furn_rug', tx: 38, ty: 20, size: 74, layer: 'ground' },
  { prop: 'furn_dais', tx: 32, ty: 17, size: 236, layer: 'ground' },
  { prop: 'furn_column', tx: 18, ty: 15, size: 78 },
  { prop: 'furn_column', tx: 46, ty: 15, size: 78 },
  { prop: 'furn_column', tx: 18, ty: 19, size: 78 },
  { prop: 'furn_column', tx: 46, ty: 19, size: 78 },
  { prop: 'furn_banner', tx: 17, ty: 9, size: 72 },
  { prop: 'furn_banner', tx: 48, ty: 9, size: 72 },
  { prop: 'furn_banner', tx: 17, ty: 23, size: 70 },
  { prop: 'furn_banner', tx: 48, ty: 23, size: 70 },
  { prop: 'furn_bench', tx: 22, ty: 20, size: 62 },
  { prop: 'furn_bench', tx: 42, ty: 20, size: 62 },
  { prop: 'furn_planter', tx: 28, ty: 21, size: 40 },
  { prop: 'furn_planter', tx: 36, ty: 21, size: 40 },
];

export const SANCTUARY_GATE: SanctuarySpot = { kind: 'gate', id: 'gate', tx: 32, ty: 23 };
export const SANCTUARY_SPAWN = { tx: 32, ty: 17 };

const WIDTH = 58;
const HEIGHT = 30;
const LEFT = 5;
const TOP = 4;
const RIGHT = 52;
const BOTTOM = 27;

export function spotToPixels(spot: { tx: number; ty: number }): { x: number; y: number } {
  return { x: (spot.tx + 0.5) * TILE_SIZE, y: (spot.ty + 0.5) * TILE_SIZE };
}

/** A single hand-built hall: no enemies, no hazards, just the rebuilt place. */
export function buildSanctuaryFloor(): FloorMap {
  const grid = new TileGrid(WIDTH, HEIGHT);
  for (let ty = TOP; ty <= BOTTOM; ty++)
    for (let tx = LEFT; tx <= RIGHT; tx++) grid.set(tx, ty, Tile.Floor);
  for (let ty = TOP - 1; ty <= BOTTOM + 1; ty++)
    for (let tx = LEFT - 1; tx <= RIGHT + 1; tx++)
      if (tx < LEFT || tx > RIGHT || ty < TOP || ty > BOTTOM) grid.set(tx, ty, Tile.Wall);

  // Six pillars frame the nave without sitting on any station or doorway.
  for (const [tx, ty] of [
    [16, 12],
    [48, 12],
    [16, 20],
    [48, 20],
    [24, 18],
    [40, 18],
  ])
    grid.set(tx, ty, Tile.Wall);

  // A worn carpet of glyphs runs from the gate to the hearth row.
  for (let tx = 12; tx <= 46; tx += 2) {
    grid.deco[grid.index(tx, 17)] = Deco.Glyph;
    grid.deco[grid.index(tx, 18)] = Deco.Glyph;
  }
  for (let ty = 12; ty <= 22; ty += 2) grid.deco[grid.index(32, ty)] = Deco.Glyph;

  // Scattered age: rubble and moss away from the carpet, deterministic.
  let seed = 0x51a7;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 180; i++) {
    const tx = LEFT + 1 + Math.floor(rand() * (RIGHT - LEFT - 1));
    const ty = TOP + 1 + Math.floor(rand() * (BOTTOM - TOP - 1));
    if (grid.get(tx, ty) !== Tile.Floor) continue;
    if (Math.abs(ty - 18) <= 1 || tx === 32) continue;
    grid.deco[grid.index(tx, ty)] = rand() < 0.5 ? Deco.Rubble : Deco.Moss;
  }

  // A quiet ring of glyphs around the gate.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const tx = Math.round(SANCTUARY_GATE.tx + Math.cos(a) * 5);
    const ty = Math.round(SANCTUARY_GATE.ty + Math.sin(a) * 3);
    if (grid.get(tx, ty) === Tile.Floor) grid.deco[grid.index(tx, ty)] = Deco.Glyph;
  }

  const room: Room = {
    id: 0,
    cellX: 0,
    cellY: 0,
    x: LEFT,
    y: TOP,
    w: RIGHT - LEFT + 1,
    h: BOTTOM - TOP + 1,
    kind: 'start',
    shape: 'rect',
    doors: [],
    distance: 0,
  };
  return {
    seed: 0x5a17,
    depth: 0,
    grid,
    rooms: [room],
    startRoom: 0,
    bossRoom: 0,
  };
}
