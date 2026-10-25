import { describe, expect, it } from 'vitest';
import { generateFloor, roomAt, roomCentrePx, type FloorMap } from '../../src/sim/dungeon';
import { Tile, TILE_SIZE } from '../../src/sim/tiles';

/** Tiles reachable on foot from the start room centre, with every door open. */
function reachable(floor: FloorMap): Set<number> {
  const { grid } = floor;
  const start = roomCentrePx(floor.rooms[floor.startRoom]);
  const sx = Math.floor(start.x / TILE_SIZE);
  const sy = Math.floor(start.y / TILE_SIZE);
  const seen = new Set([grid.index(sx, sy)]);
  const stack = [[sx, sy]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const i = grid.index(nx, ny);
      if (!grid.isWalkable(nx, ny) || seen.has(i)) continue;
      seen.add(i);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

const SEEDS = [1, 2, 3, 42, 1337, 98765, 4242424];

describe('dungeon generation', () => {
  it('is deterministic for a seed', () => {
    const a = generateFloor(77, 0, { roomCount: 8 });
    const b = generateFloor(77, 0, { roomCount: 8 });
    expect(a.grid.tiles.join('')).toBe(b.grid.tiles.join(''));
    expect(a.rooms.map((r) => r.kind)).toEqual(b.rooms.map((r) => r.kind));
  });

  it('differs between seeds', () => {
    const a = generateFloor(1, 0, { roomCount: 8 });
    const b = generateFloor(2, 0, { roomCount: 8 });
    expect(a.grid.tiles.join('')).not.toBe(b.grid.tiles.join(''));
  });

  it.each(SEEDS)('connects every walkable tile to the start (seed %i)', (seed) => {
    const floor = generateFloor(seed, 2, { roomCount: 9 });
    const seen = reachable(floor);
    let walkable = 0;
    for (let y = 0; y < floor.grid.height; y++)
      for (let x = 0; x < floor.grid.width; x++) if (floor.grid.isWalkable(x, y)) walkable++;
    expect(seen.size).toBe(walkable);
  });

  it.each(SEEDS)('has one start, one boss, one treasure room (seed %i)', (seed) => {
    const floor = generateFloor(seed, 0, { roomCount: 8 });
    const count = (kind: string): number => floor.rooms.filter((r) => r.kind === kind).length;
    expect(floor.rooms).toHaveLength(8);
    expect(count('start')).toBe(1);
    expect(count('boss')).toBe(1);
    expect(count('treasure')).toBe(1);
    expect(floor.rooms[floor.bossRoom].kind).toBe('boss');
    const maxDistance = Math.max(...floor.rooms.map((r) => r.distance));
    expect(floor.rooms[floor.bossRoom].distance).toBe(maxDistance);
  });

  it('encloses every walkable tile with walls (no walkable tile touches void)', () => {
    const leaks: string[] = [];
    for (const seed of SEEDS) {
      const { grid } = generateFloor(seed, 1, { roomCount: 10 });
      for (let y = 0; y < grid.height; y++)
        for (let x = 0; x < grid.width; x++) {
          if (!grid.isWalkable(x, y)) continue;
          const open =
            grid.get(x + 1, y) === Tile.Void ||
            grid.get(x - 1, y) === Tile.Void ||
            grid.get(x, y + 1) === Tile.Void ||
            grid.get(x, y - 1) === Tile.Void;
          if (open) leaks.push(`${seed}:${x},${y}`);
        }
    }
    expect(leaks).toEqual([]);
  });

  it('gives each doorway three door tiles that sit on the room wall line', () => {
    const floor = generateFloor(5, 0, { roomCount: 8 });
    for (const room of floor.rooms) {
      expect(room.doors.length).toBeGreaterThan(0);
      for (const door of room.doors) {
        expect(door.tiles).toHaveLength(3);
        for (const t of door.tiles) expect(floor.grid.get(t.x, t.y)).toBe(Tile.Door);
      }
    }
  });

  it('builds the finale as a straight line ending in the boss arena', () => {
    const floor = generateFloor(9, 5, { roomCount: 5, finale: true });
    expect(floor.rooms).toHaveLength(5);
    expect(floor.rooms[floor.bossRoom].distance).toBe(4);
    expect(floor.rooms.filter((r) => r.kind === 'treasure')).toHaveLength(0);
  });

  it('locates the room under a pixel', () => {
    const floor = generateFloor(3, 0, { roomCount: 7 });
    const boss = floor.rooms[floor.bossRoom];
    const c = roomCentrePx(boss);
    expect(roomAt(floor, c.x, c.y)?.id).toBe(boss.id);
    expect(roomAt(floor, 0, 0)).toBeUndefined();
  });
});
