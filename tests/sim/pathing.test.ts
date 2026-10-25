import { describe, expect, it } from 'vitest';
import { FlowField } from '../../src/sim/pathing';
import { Tile, TileGrid, TILE_SIZE } from '../../src/sim/tiles';

/** 9x9 room with a vertical wall at x = 4 from y = 1 to y = 6; the gap is at the bottom. */
function walledRoom(): TileGrid {
  const grid = new TileGrid(9, 9);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const edge = x === 0 || y === 0 || x === 8 || y === 8;
      grid.set(x, y, edge || (x === 4 && y <= 6) ? Tile.Wall : Tile.Floor);
    }
  return grid;
}

const px = (t: number): number => (t + 0.5) * TILE_SIZE;

describe('FlowField', () => {
  it('points around a wall instead of into it', () => {
    const field = new FlowField(walledRoom());
    field.update(px(6), px(2));
    const dir = field.direction(px(2), px(2))!;
    // The route goes down to the gap first.
    expect(dir.y).toBeGreaterThan(0.5);
  });

  it('points straight at the target in open space', () => {
    const field = new FlowField(walledRoom());
    field.update(px(6), px(7));
    const dir = field.direction(px(6), px(4))!;
    expect(dir.y).toBeGreaterThan(0.9);
  });

  it('returns undefined where the target is unreachable', () => {
    const grid = walledRoom();
    grid.set(4, 7, Tile.Wall);
    const field = new FlowField(grid);
    field.update(px(6), px(2));
    expect(field.direction(px(2), px(2))).toBeUndefined();
  });
});
