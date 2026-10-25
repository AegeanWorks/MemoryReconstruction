import { describe, expect, it } from 'vitest';
import { hasLineOfSight, moveAndCollide, separate } from '../../src/sim/physics';
import { Tile, TileGrid, TILE_SIZE } from '../../src/sim/tiles';
import { Rng, floorSeed } from '../../src/sim/rng';

/** 10x10 floor with a wall column at x = 5. */
function arena(): TileGrid {
  const grid = new TileGrid(10, 10);
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++) {
      const edge = x === 0 || y === 0 || x === 9 || y === 9;
      grid.set(x, y, edge || x === 5 ? Tile.Wall : Tile.Floor);
    }
  return grid;
}

describe('moveAndCollide', () => {
  it('stops flush against a wall', () => {
    const grid = arena();
    const body = { x: 3 * TILE_SIZE, y: 3 * TILE_SIZE, radius: 10 };
    const hit = moveAndCollide(grid, body, 200, 0);
    expect(hit).toBe(true);
    expect(body.x + body.radius).toBeLessThanOrEqual(5 * TILE_SIZE);
    expect(body.x + body.radius).toBeGreaterThan(5 * TILE_SIZE - 1);
  });

  it('never tunnels through a one-tile wall at dash speed', () => {
    const grid = arena();
    const body = { x: 4 * TILE_SIZE, y: 4 * TILE_SIZE, radius: 8 };
    moveAndCollide(grid, body, 1000, 0);
    expect(body.x).toBeLessThan(5 * TILE_SIZE);
  });

  it('slides along a wall when moving diagonally', () => {
    const grid = arena();
    const body = { x: 4.5 * TILE_SIZE, y: 3 * TILE_SIZE, radius: 10 };
    moveAndCollide(grid, body, 40, 40);
    expect(body.y).toBeCloseTo(3 * TILE_SIZE + 40, 5);
  });

  it('slips around a wall corner it clips by a few pixels', () => {
    const grid = arena();
    // A one-tile pillar at (2, 5); the body overlaps its right edge by 2px.
    grid.set(2, 5, Tile.Wall);
    const body = { x: 3 * TILE_SIZE + 8, y: 3 * TILE_SIZE, radius: 10 };
    moveAndCollide(grid, body, 0, 100);
    expect(body.y).toBeGreaterThan(5 * TILE_SIZE);
  });

  it('still stops against a wide wall', () => {
    const grid = arena();
    for (let x = 1; x < 5; x++) grid.set(x, 5, Tile.Wall);
    const body = { x: 2.5 * TILE_SIZE, y: 3 * TILE_SIZE, radius: 10 };
    moveAndCollide(grid, body, 0, 200);
    expect(body.y + body.radius).toBeLessThanOrEqual(5 * TILE_SIZE);
  });

  it('treats a locked door as solid and an open one as floor', () => {
    const grid = arena();
    grid.set(5, 4, Tile.Door);
    grid.setDoorLocked(5, 4, true);
    const body = { x: 4 * TILE_SIZE, y: 4.5 * TILE_SIZE, radius: 8 };
    moveAndCollide(grid, body, 100, 0);
    expect(body.x).toBeLessThan(5 * TILE_SIZE);
    grid.setDoorLocked(5, 4, false);
    moveAndCollide(grid, body, 100, 0);
    expect(body.x).toBeGreaterThan(6 * TILE_SIZE);
  });
});

describe('separate', () => {
  it('pushes overlapping bodies apart', () => {
    const grid = arena();
    const a = { x: 100, y: 100, radius: 10 };
    const b = { x: 105, y: 100, radius: 10 };
    separate(grid, a, b);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(20, 3);
  });
});

describe('hasLineOfSight', () => {
  it('is blocked by walls', () => {
    const grid = arena();
    expect(hasLineOfSight(grid, 64, 64, 64, 250)).toBe(true);
    expect(hasLineOfSight(grid, 64, 64, 250, 64)).toBe(false);
  });
});

describe('Rng', () => {
  it('replays the same sequence from a seed', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    expect([a.next(), a.int(1, 6), a.range(2, 3)]).toEqual([b.next(), b.int(1, 6), b.range(2, 3)]);
  });

  it('keeps int within inclusive bounds', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 500; i++) {
      const v = rng.int(-2, 2);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
    }
  });

  it('derives distinct floor seeds per depth', () => {
    const seeds = new Set([0, 1, 2, 3, 4, 5].map((d) => floorSeed(777, d)));
    expect(seeds.size).toBe(6);
  });
});
