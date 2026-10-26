/**
 * Procedural dungeon floors.
 *
 * A floor is a set of rectangular rooms on a coarse cell grid, joined by
 * straight 3-tile corridors. Every room contains its cell's central 5x5 band,
 * so two neighbouring rooms always overlap on the cell centre line and the
 * corridor between them can run straight without touching any other room.
 * Obstacles never sit on a room's centre lines, which keeps every doorway
 * reachable from every other.
 */
import { Rng } from './rng';
import { Deco, Tile, TileGrid, TILE_SIZE } from './tiles';

export const CELL_W = 24;
export const CELL_H = 18;
// The spine layout uses columns 1..6, so the grid needs seven cell columns.
const GRID_W = 7;
const GRID_H = 6;
/** Tiles kept free between a room and its cell edge, so corridors have room to run. */
const CELL_MARGIN = 3;
/** Half-size of the centre band every room must contain. */
const CORE_HALF = 2;

export type RoomKind = 'start' | 'combat' | 'treasure' | 'shrine' | 'boss' | 'arena' | 'library';
export type RoomShape = 'rect' | 'rounded' | 'octagon' | 'cave';
export type Direction = 'north' | 'south' | 'east' | 'west';

export interface Doorway {
  /** Tiles that close while the room is locked. */
  tiles: Array<{ x: number; y: number }>;
  direction: Direction;
  /** Room on the other side. */
  leadsTo: number;
}

export interface Room {
  id: number;
  cellX: number;
  cellY: number;
  /** Interior rectangle in tiles; walls sit one tile outside it. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: RoomKind;
  shape: RoomShape;
  doors: Doorway[];
  /** Steps from the start room through doorways. */
  distance: number;
}

export interface FloorMap {
  seed: number;
  depth: number;
  grid: TileGrid;
  rooms: Room[];
  startRoom: number;
  bossRoom: number;
}

/** Structural feel of a floor: branching maze, ring, spine or dense grid. */
export type MapLayout = 'branch' | 'ring' | 'spine' | 'grid' | 'diamond' | 'cross';

export interface FloorOptions {
  /** Rooms including start and boss; clamped to what the grid can hold. */
  roomCount: number;
  /** Final floor: a single long approach to a large arena. */
  finale?: boolean;
  /** Cell pattern; defaults to the branching maze. */
  layout?: MapLayout;
  /** A single arena holding one boss, used for echo-trial episodes. */
  bossOnly?: boolean;
}

interface Cell {
  x: number;
  y: number;
}

const OFFSETS: Record<Direction, Cell> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

const cellKey = (c: Cell): number => c.y * GRID_W + c.x;

export function generateFloor(seed: number, depth: number, options: FloorOptions): FloorMap {
  const rng = new Rng(seed);
  const layout = options.layout ?? 'branch';
  const cells = options.bossOnly
    ? [{ x: 3, y: 3 }]
    : options.finale
      ? finaleCells()
      : layoutCells(rng, layout, options.roomCount);
  const links = options.bossOnly ? [] : linkCells(rng, cells, layout !== 'spine');

  const distances = cellDistances(cells.length, links);
  const kinds = options.bossOnly
    ? (['boss'] as RoomKind[])
    : assignKinds(rng, distances, links, !!options.finale, depth);
  const rooms = cells.map((cell, id) => placeRoom(rng, cell, id, kinds[id], distances[id]));

  const grid = new TileGrid(GRID_W * CELL_W + 2, GRID_H * CELL_H + 2);
  for (const room of rooms) {
    carveRect(grid, room.x, room.y, room.w, room.h, Tile.Floor);
    carveRoomShape(grid, room, rng);
  }
  for (const [a, b] of links) carveCorridor(grid, rooms[a], rooms[b]);
  addWalls(grid);
  for (const room of rooms) furnish(rng, grid, room);

  const startRoom = 0;
  const bossRoom = options.bossOnly ? 0 : kinds.indexOf('boss');
  decorate(rng, grid);

  return { seed, depth, grid, rooms, startRoom, bossRoom };
}

/**
 * Picks a cell pattern for the section. Every variant is connected, starts at
 * the first cell and leaves a far corner for the boss.
 */
function layoutCells(rng: Rng, layout: MapLayout, target: number): Cell[] {
  if (layout === 'branch') return growCells(rng, target);
  if (layout === 'ring') return ringCells(target);
  if (layout === 'grid') return gridCells(target);
  if (layout === 'diamond') return diamondCells();
  if (layout === 'cross') return crossCells();
  return spineCells(target);
}

/** A diamond of cells: a central hall with four tapering approaches. */
function diamondCells(): Cell[] {
  const cells: Cell[] = [];
  const widths = [1, 3, 5, 3, 1];
  for (let row = 0; row < widths.length; row++) {
    const w = widths[row];
    const startX = 3 - Math.floor(w / 2);
    for (let i = 0; i < w; i++) cells.push({ x: startX + i, y: row + 1 });
  }
  return cells;
}

/** A two-tile-wide cross: four long wings around one intersection. */
function crossCells(): Cell[] {
  const cells: Cell[] = [];
  for (let y = 2; y <= 3; y++) for (let x = 1; x <= 4; x++) cells.push({ x, y });
  for (let x = 2; x <= 3; x++)
    for (let y = 1; y <= 4; y++) if (!(y >= 2 && y <= 3)) cells.push({ x, y });
  return cells;
}

/** Hollow rectangle: a loop the player can circle, with a far opposite corner. */
function ringCells(target: number): Cell[] {
  const size = target <= 8 ? [3, 3] : target <= 10 ? [4, 3] : target <= 12 ? [4, 4] : [5, 4];
  const [w, h] = size;
  const cells: Cell[] = [];
  for (let y = 1; y <= h; y++)
    for (let x = 1; x <= w; x++) {
      const border = x === 1 || y === 1 || x === w || y === h;
      if (border) cells.push({ x, y });
    }
  return cells;
}

/** Dense blocks with many loops: short sightlines and flanking routes. */
function gridCells(target: number): Cell[] {
  const [w, h] = target <= 9 ? [3, 3] : target <= 12 ? [4, 3] : [4, 4];
  const cells: Cell[] = [];
  for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) cells.push({ x, y });
  return cells.slice(0, Math.max(6, Math.min(target, cells.length)));
}

/** One long central run with alternating side rooms: a march, not a maze. */
function spineCells(target: number): Cell[] {
  const cells: Cell[] = [{ x: 2, y: 2 }];
  for (let x = 3; x <= 6; x++) cells.push({ x, y: 2 });
  const branches: Cell[] = [
    { x: 1, y: 2 },
    { x: 2, y: 1 },
    { x: 3, y: 3 },
    { x: 4, y: 1 },
    { x: 5, y: 3 },
    { x: 6, y: 1 },
    { x: 6, y: 3 },
    { x: 1, y: 1 },
    { x: 1, y: 3 },
  ];
  return [...cells, ...branches].slice(0, Math.max(5, Math.min(target, 15)));
}

/** Grows a branching set of cells outward from the grid centre. */
function growCells(rng: Rng, target: number): Cell[] {
  const count = Math.max(3, Math.min(target, GRID_W * GRID_H - 4));
  const cells: Cell[] = [{ x: 2, y: 2 }];
  const taken = new Set([cellKey(cells[0])]);
  const neighbourCount = (c: Cell): number =>
    Object.values(OFFSETS).filter((o) => taken.has(cellKey({ x: c.x + o.x, y: c.y + o.y }))).length;

  // First pass keeps corridors branchy (each new cell touches one existing
  // cell); the relaxed pass guarantees the target count is reached.
  for (const maxNeighbours of [1, 4]) {
    for (let attempt = 0; attempt < 400 && cells.length < count; attempt++) {
      const from = rng.pick(cells);
      const dir = rng.pick(Object.values(OFFSETS));
      const next = { x: from.x + dir.x, y: from.y + dir.y };
      if (next.x < 0 || next.y < 0 || next.x >= GRID_W || next.y >= GRID_H) continue;
      if (taken.has(cellKey(next)) || neighbourCount(next) > maxNeighbours) continue;
      cells.push(next);
      taken.add(cellKey(next));
    }
  }
  return cells;
}

/** Final floor: start, a corridor of three rooms, then the arena. */
function finaleCells(): Cell[] {
  return [
    { x: 2, y: 5 },
    { x: 2, y: 4 },
    { x: 2, y: 3 },
    { x: 2, y: 2 },
    { x: 2, y: 1 },
  ];
}

/** A spanning tree over adjacent cells, plus an occasional loop. */
function linkCells(rng: Rng, cells: Cell[], allowLoops: boolean): Array<[number, number]> {
  const index = new Map(cells.map((c, i) => [cellKey(c), i]));
  const links: Array<[number, number]> = [];
  const linked = new Set<string>();
  const connected = new Set([0]);
  const key = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const adjacent = (i: number): number[] =>
    Object.values(OFFSETS)
      .map((o) => index.get(cellKey({ x: cells[i].x + o.x, y: cells[i].y + o.y })))
      .filter((j): j is number => j !== undefined);

  // Grow outward from cell 0. Cell order is layout-specific (a diamond starts
  // with a diagonal neighbour), so connect each remaining cell to its nearest
  // already-connected cell rather than assuming array order is a path.
  const remaining = new Set<number>();
  for (let i = 1; i < cells.length; i++) remaining.add(i);
  const manhattan = (a: number, b: number): number =>
    Math.abs(cells[a].x - cells[b].x) + Math.abs(cells[a].y - cells[b].y);
  while (remaining.size > 0) {
    const options: Array<{ i: number; j: number; d: number }> = [];
    for (const i of remaining)
      for (const j of connected) options.push({ i, j, d: manhattan(i, j) });
    const nearest = Math.min(...options.map((o) => o.d));
    const pick = rng.pick(options.filter((o) => o.d === nearest));
    links.push([pick.j, pick.i]);
    linked.add(key(pick.i, pick.j));
    connected.add(pick.i);
    remaining.delete(pick.i);
  }
  if (allowLoops) {
    for (let i = 0; i < cells.length; i++) {
      for (const j of adjacent(i)) {
        if (j > i && !linked.has(key(i, j)) && rng.chance(0.2)) {
          links.push([i, j]);
          linked.add(key(i, j));
        }
      }
    }
  }
  return links;
}

function cellCentre(cell: Cell): Cell {
  return {
    x: 1 + cell.x * CELL_W + Math.floor(CELL_W / 2),
    y: 1 + cell.y * CELL_H + Math.floor(CELL_H / 2),
  };
}

/**
 * Span [start, start+size) inside the cell that still covers the centre band.
 * A full span takes the whole cell minus its margins (boss arenas).
 */
function span(
  rng: Rng,
  origin: number,
  cellSize: number,
  centre: number,
  full: boolean
): [number, number] {
  const lo = origin + CELL_MARGIN;
  const hi = origin + cellSize - CELL_MARGIN; // exclusive
  const start = full ? lo : rng.int(lo, centre - CORE_HALF - 1);
  const end = full ? hi : rng.int(centre + CORE_HALF + 2, hi);
  return [start, end - start];
}

function placeRoom(rng: Rng, cell: Cell, id: number, kind: RoomKind, distance: number): Room {
  const centre = cellCentre(cell);
  const full = kind === 'boss' || kind === 'arena';
  const [x, w] = span(rng, 1 + cell.x * CELL_W, CELL_W, centre.x, full);
  const [y, h] = span(rng, 1 + cell.y * CELL_H, CELL_H, centre.y, full);
  const shape: RoomShape =
    kind === 'boss' || kind === 'arena'
      ? 'octagon'
      : rng.pick(['rect', 'rect', 'rounded', 'octagon', 'cave'] as const);
  return { id, cellX: cell.x, cellY: cell.y, x, y, w, h, kind, shape, doors: [], distance };
}

/**
 * Cuts the rectangle into a more interesting footprint. Corners are removed
 * first, so the centre bands (where doors attach) always stay open.
 */
function carveRoomShape(grid: TileGrid, room: Room, rng: Rng): void {
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  const bite = (tx: number, ty: number): void => {
    // Outer walls are rebuilt later by addWalls, so boundary corners may be
    // removed. Only the central cross (where corridors attach) must stay open.
    if (tx < room.x || ty < room.y || tx >= room.x + room.w || ty >= room.y + room.h) return;
    if (Math.abs(tx - cx) < 2.5 || Math.abs(ty - cy) < 2.5) return;
    grid.set(tx, ty, Tile.Void);
  };
  const corners: Array<[number, number, number, number]> = [
    [room.x, room.y, 1, 1],
    [room.x + room.w - 1, room.y, -1, 1],
    [room.x, room.y + room.h - 1, 1, -1],
    [room.x + room.w - 1, room.y + room.h - 1, -1, -1],
  ];
  if (room.shape === 'rounded') {
    for (const [cx, cy, sx, sy] of corners) {
      bite(cx, cy);
      bite(cx + sx, cy);
      bite(cx, cy + sy);
    }
  } else if (room.shape === 'octagon') {
    for (const [cx, cy, sx, sy] of corners) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) bite(cx + sx * i, cy + sy * j);
    }
  } else if (room.shape === 'cave') {
    for (let i = 0; i < 10; i++) {
      const edge = rng.int(0, 3);
      const along = rng.int(2, Math.max(3, (edge % 2 === 0 ? room.w : room.h) - 3));
      const tx = edge < 2 ? room.x + along : edge === 2 ? room.x : room.x + room.w - 1;
      const ty = edge < 2 ? (edge === 0 ? room.y : room.y + room.h - 1) : room.y + along;
      bite(tx, ty);
      if (rng.chance(0.5))
        bite(
          tx + (edge === 2 ? 1 : edge === 3 ? -1 : 0),
          ty + (edge === 0 ? 1 : edge === 1 ? -1 : 0)
        );
    }
  }

  // Corner/edge bites can leave a small floor island. Keep only the floor that
  // is reachable from the room centre; addWalls turns the rest into wall.
  const startX = Math.floor(cx);
  const startY = Math.floor(cy);
  if (!grid.isWalkable(startX, startY)) return;
  const seen = new Set<number>([grid.index(startX, startY)]);
  const stack: Array<[number, number]> = [[startX, startY]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < room.x || ny < room.y || nx >= room.x + room.w || ny >= room.y + room.h) continue;
      const index = grid.index(nx, ny);
      if (!grid.isWalkable(nx, ny) || seen.has(index)) continue;
      seen.add(index);
      stack.push([nx, ny]);
    }
  }
  for (let y = room.y; y < room.y + room.h; y++)
    for (let x = room.x; x < room.x + room.w; x++) {
      if (!grid.isWalkable(x, y)) continue;
      if (!seen.has(grid.index(x, y))) grid.set(x, y, Tile.Void);
    }
}

function carveRect(grid: TileGrid, x: number, y: number, w: number, h: number, tile: Tile): void {
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) grid.set(tx, ty, tile);
}

function carveCorridor(grid: TileGrid, a: Room, b: Room): void {
  const [first, second] = a.cellX < b.cellX || a.cellY < b.cellY ? [a, b] : [b, a];
  const horizontal = first.cellY === second.cellY;
  const centre = cellCentre({ x: first.cellX, y: first.cellY });

  if (horizontal) {
    const startX = first.x + first.w; // first's east wall column
    const endX = second.x - 1; // second's west wall column
    carveRect(grid, startX, centre.y - 1, endX - startX + 1, 3, Tile.Floor);
    first.doors.push(doorway(grid, startX, centre.y, 'east', second.id, true));
    second.doors.push(doorway(grid, endX, centre.y, 'west', first.id, true));
  } else {
    const startY = first.y + first.h;
    const endY = second.y - 1;
    carveRect(grid, centre.x - 1, startY, 3, endY - startY + 1, Tile.Floor);
    first.doors.push(doorway(grid, centre.x, startY, 'south', second.id, false));
    second.doors.push(doorway(grid, centre.x, endY, 'north', first.id, false));
  }
}

function doorway(
  grid: TileGrid,
  x: number,
  y: number,
  direction: Direction,
  leadsTo: number,
  vertical: boolean
): Doorway {
  const tiles = [-1, 0, 1].map((d) => (vertical ? { x, y: y + d } : { x: x + d, y }));
  for (const t of tiles) grid.set(t.x, t.y, Tile.Door);
  return { tiles, direction, leadsTo };
}

/** Every void tile touching a walkable tile (8-neighbourhood) becomes wall. */
function addWalls(grid: TileGrid): void {
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      if (grid.get(tx, ty) !== Tile.Void) continue;
      outer: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (grid.isWalkable(tx + dx, ty + dy)) {
            grid.set(tx, ty, Tile.Wall);
            break outer;
          }
        }
      }
    }
  }
}

/** Breadth-first steps from cell 0 through the links. */
function cellDistances(count: number, links: Array<[number, number]>): number[] {
  const adjacency = Array.from({ length: count }, () => [] as number[]);
  for (const [a, b] of links) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  const distance = new Array<number>(count).fill(-1);
  distance[0] = 0;
  const queue = [0];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency[current]) {
      if (distance[next] !== -1) continue;
      distance[next] = distance[current] + 1;
      queue.push(next);
    }
  }
  return distance;
}

/**
 * Room 0 is the start; the boss takes the farthest room (a dead end when one
 * exists); treasure prefers another dead end; one other room becomes a shrine.
 */
function assignKinds(
  rng: Rng,
  distances: number[],
  links: Array<[number, number]>,
  finale: boolean,
  depth: number
): RoomKind[] {
  const kinds = distances.map((): RoomKind => 'combat');
  const degree = distances.map(() => 0);
  for (const [a, b] of links) {
    degree[a]++;
    degree[b]++;
  }
  kinds[0] = 'start';
  const farthest = Math.max(...distances);
  const bossCandidates = distances
    .map((d, i) => i)
    .filter((i) => i !== 0 && distances[i] === farthest);
  // Never leave a floor without a guardian: if distance ties produce nothing
  // (a one-cell or degenerate layout), fall back to the most remote room.
  let boss = bossCandidates.find((i) => degree[i] === 1) ?? bossCandidates[0];
  if (boss === undefined) {
    boss = distances
      .map((_, i) => i)
      .filter((i) => i !== 0)
      .sort(
        (a, b) => (distances[b] ?? -1) - (distances[a] ?? -1) || degree[a] - degree[b] || b - a
      )[0];
  }
  if (boss !== undefined) kinds[boss] = 'boss';
  if (finale) return kinds;

  const free = (): number[] => kinds.map((k, i) => i).filter((i) => kinds[i] === 'combat');
  const deadEnds = (): number[] => free().filter((i) => degree[i] === 1);
  kinds[deadEnds().length > 0 ? rng.pick(deadEnds()) : rng.pick(free())] = 'treasure';
  if (free().length > 2) kinds[rng.pick(free())] = 'shrine';

  // Mid-floor boss episode: one big arena holding a single echo guardian.
  if (depth >= 2 && free().length >= 3 && rng.chance(0.65)) {
    const pool = deadEnds().length > 0 ? deadEnds() : free();
    kinds[rng.pick(pool)] = 'arena';
  }
  // A safe memory archive: lore instead of a fight.
  if (free().length >= 2 && rng.chance(0.5)) {
    const pool = deadEnds().length > 0 ? deadEnds() : free();
    kinds[rng.pick(pool)] = 'library';
  }
  return kinds;
}

/** Interior obstacles. They avoid the centre cross and the ring next to walls. */
function furnish(rng: Rng, grid: TileGrid, room: Room): void {
  const centre = cellCentre({ x: room.cellX, y: room.cellY });

  // Start rooms and arenas get real architecture: isolated pillars that frame
  // the space without touching doors, the centre line or each other.
  if (room.kind === 'start' || room.kind === 'boss' || room.kind === 'arena') {
    const inset = room.kind === 'start' ? 2 : 4;
    const spots: Array<[number, number]> = [
      [room.x + inset, room.y + inset],
      [room.x + room.w - inset - 1, room.y + inset],
      [room.x + inset, room.y + room.h - inset - 1],
      [room.x + room.w - inset - 1, room.y + room.h - inset - 1],
    ];
    const isolated = (tx: number, ty: number): boolean => {
      if (grid.get(tx, ty) !== Tile.Floor) return false;
      if (Math.abs(tx - centre.x) <= 2 && Math.abs(ty - centre.y) <= 2) return false;
      for (const door of room.doors)
        for (const tile of door.tiles)
          if (Math.abs(tx - tile.x) + Math.abs(ty - tile.y) < 4) return false;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++)
          if ((ox !== 0 || oy !== 0) && grid.get(tx + ox, ty + oy) === Tile.Wall) return false;
      return true;
    };
    let placed = 0;
    const limit = room.kind === 'start' ? 2 : 4;
    for (const [tx, ty] of spots) {
      if (placed >= limit) break;
      if (!isolated(tx, ty)) continue;
      grid.set(tx, ty, Tile.Wall);
      placed++;
    }
    return;
  }
  if (room.w < 10 || room.h < 8) return;
  const blocked = (tx: number, ty: number): boolean =>
    Math.abs(tx - centre.x) <= 1 ||
    Math.abs(ty - centre.y) <= 1 ||
    tx < room.x + 2 ||
    ty < room.y + 2 ||
    tx > room.x + room.w - 3 ||
    ty > room.y + room.h - 3;
  const pillar = (tx: number, ty: number, size: number): void => {
    for (let y = ty; y < ty + size; y++)
      for (let x = tx; x < tx + size; x++) if (blocked(x, y)) return;
    carveRect(grid, tx, ty, size, size, Tile.Wall);
  };

  const layout = rng.pick(['pillars', 'scatter', 'open', 'pillars'] as const);
  if (layout === 'pillars') {
    const ox = Math.max(room.x + 2, centre.x - 5);
    const oy = Math.max(room.y + 2, centre.y - 4);
    pillar(ox, oy, 2);
    pillar(centre.x + 3, oy, 2);
    pillar(ox, centre.y + 2, 2);
    pillar(centre.x + 3, centre.y + 2, 2);
  } else if (layout === 'scatter') {
    for (let i = 0; i < 5; i++) {
      pillar(rng.int(room.x + 2, room.x + room.w - 3), rng.int(room.y + 2, room.y + room.h - 3), 1);
    }
  }
}

function decorate(rng: Rng, grid: TileGrid): void {
  for (let i = 0; i < grid.tiles.length; i++) {
    if ((grid.tiles[i] as Tile) !== Tile.Floor) continue;
    const roll = rng.next();
    if (roll < 0.05) grid.deco[i] = Deco.Crack;
    else if (roll < 0.08) grid.deco[i] = Deco.Rubble;
    else if (roll < 0.12) grid.deco[i] = Deco.Moss;
    else if (roll < 0.125) grid.deco[i] = Deco.Glyph;
  }
}

export function roomCentrePx(room: Room): { x: number; y: number } {
  const centre = cellCentre({ x: room.cellX, y: room.cellY });
  return { x: (centre.x + 0.5) * TILE_SIZE, y: (centre.y + 0.5) * TILE_SIZE };
}

/** The room whose interior contains the pixel, or undefined in corridors. */
export function roomAt(floor: FloorMap, px: number, py: number): Room | undefined {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  return floor.rooms.find((r) => tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h);
}
