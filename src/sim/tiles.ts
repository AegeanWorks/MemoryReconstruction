/**
 * Tile grid: the static collision and render layout of one dungeon floor.
 */

/** World pixels per tile edge. */
export const TILE_SIZE = 32;

export enum Tile {
  /** Outside the dungeon; solid and drawn as darkness. */
  Void = 0,
  Floor = 1,
  Wall = 2,
  /** A doorway tile; solid while its room is locked. */
  Door = 3,
}

/** Non-colliding floor decoration drawn on top of the floor tile. */
export enum Deco {
  None = 0,
  Rubble = 1,
  Crack = 2,
  Moss = 3,
  Glyph = 4,
}

export class TileGrid {
  readonly tiles: Uint8Array;
  readonly deco: Uint8Array;
  /** Door tiles currently closed, keyed by tile index. */
  private readonly lockedDoors = new Set<number>();

  constructor(
    readonly width: number,
    readonly height: number
  ) {
    this.tiles = new Uint8Array(width * height);
    this.deco = new Uint8Array(width * height);
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  index(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  get(tx: number, ty: number): Tile {
    if (!this.inBounds(tx, ty)) return Tile.Void;
    return this.tiles[this.index(tx, ty)] as Tile;
  }

  set(tx: number, ty: number, tile: Tile): void {
    if (this.inBounds(tx, ty)) this.tiles[this.index(tx, ty)] = tile;
  }

  isSolid(tx: number, ty: number): boolean {
    const tile = this.get(tx, ty);
    if (tile === Tile.Floor) return false;
    if (tile === Tile.Door) return this.lockedDoors.has(this.index(tx, ty));
    return true;
  }

  /** True for tiles an actor can ever stand on (floor or doorway). */
  isWalkable(tx: number, ty: number): boolean {
    const tile = this.get(tx, ty);
    return tile === Tile.Floor || tile === Tile.Door;
  }

  setDoorLocked(tx: number, ty: number, locked: boolean): void {
    const i = this.index(tx, ty);
    if (locked) this.lockedDoors.add(i);
    else this.lockedDoors.delete(i);
  }

  isDoorLocked(tx: number, ty: number): boolean {
    return this.lockedDoors.has(this.index(tx, ty));
  }

  isSolidAtPixel(px: number, py: number): boolean {
    return this.isSolid(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE));
  }
}
