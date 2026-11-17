import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { doorFace, doorHangings, hangingSpots } from '../src/sim/decor';
import { TILE_SIZE, Tile } from '../src/sim/tiles';
import { createRun } from '../src/sim/run';
import { World } from '../src/sim/world';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('doorway hangings', () => {
  it('names the wall face a door sits on', () => {
    expect(doorFace({ tiles: [{ x: 4, y: 2 }], direction: 'north', leadsTo: 1 })).toEqual({
      dx: 0,
      dy: 1,
    });
    expect(doorFace({ tiles: [{ x: 4, y: 2 }], direction: 'south', leadsTo: 1 })).toEqual({
      dx: 0,
      dy: -1,
    });
    expect(doorFace({ tiles: [{ x: 4, y: 2 }], direction: 'east', leadsTo: 1 })).toEqual({
      dx: -1,
      dy: 0,
    });
    expect(doorFace({ tiles: [{ x: 4, y: 2 }], direction: 'west', leadsTo: 1 })).toEqual({
      dx: 1,
      dy: 0,
    });
  });

  it('puts a pair of hangings either side of a horizontal doorway', () => {
    const spots = hangingSpots({
      tiles: [
        { x: 5, y: 3 },
        { x: 6, y: 3 },
        { x: 7, y: 3 },
      ],
      direction: 'north',
      leadsTo: 2,
    });
    expect(spots).toHaveLength(2);
    expect(spots.map((s) => s.x).sort()).toEqual([4, 8]);
    expect(spots.every((s) => s.y === 3)).toBe(true);
    expect(spots[0].flip).not.toBe(spots[1].flip);
  });

  it('puts a pair above and below a vertical doorway', () => {
    const spots = hangingSpots({
      tiles: [
        { x: 9, y: 4 },
        { x: 9, y: 5 },
        { x: 9, y: 6 },
      ],
      direction: 'east',
      leadsTo: 3,
    });
    expect(spots.map((s) => s.y).sort()).toEqual([3, 7]);
    expect(spots.every((s) => s.x === 9)).toBe(true);
  });

  it('never hangs anything for a door with no tiles', () => {
    expect(hangingSpots({ tiles: [], direction: 'north', leadsTo: 1 })).toEqual([]);
  });

  it('converts a room door list into wall-layer decor, only when the roll passes', () => {
    const world = new World(createRun(99, []));
    // A non-start room honours the roll; the start room is always dressed.
    const room = world.floor.rooms.find((r) => r.doors.length > 0 && r.kind !== 'start');
    expect(room).toBeDefined();
    const always = doorHangings(room!, () => true);
    expect(always.length).toBe(room!.doors.length * 2);
    for (const hanging of always) {
      expect(hanging.layer).toBe('wall');
      expect(hanging.x % TILE_SIZE).toBeCloseTo(TILE_SIZE / 2);
      expect(['furn_tapestry', 'furn_banner', 'furn_rug']).toContain(hanging.prop);
    }
    expect(doorHangings(room!, () => false)).toEqual([]);
  });

  it('always dresses the start room so the feature shows from the first step', () => {
    const world = new World(createRun(99, []));
    const start = world.floor.rooms.find((r) => r.kind === 'start' && r.doors.length > 0);
    expect(start).toBeDefined();
    const hangings = doorHangings(start!, () => false);
    expect(hangings.length).toBe(start!.doors.length * 2);
  });

  it('decorates a real floor with hangings without touching collision', () => {
    const world = new World(createRun(1234, []));
    const hangings = world.decor.filter((d) => d.layer === 'wall');
    expect(hangings.length).toBeGreaterThan(0);
    for (const hanging of hangings) {
      const tx = Math.floor(hanging.x / TILE_SIZE);
      const ty = Math.floor(hanging.y / TILE_SIZE);
      // A hanging lives on a wall or door tile, never on open floor.
      const tile = world.grid.get(tx, ty);
      expect(tile === Tile.Wall || tile === Tile.Door, `${tx},${ty} had ${Tile[tile]}`).toBe(true);
    }
  });

  it('renders the wall layer flat under actors and mirrors the right-hand copy', () => {
    const view = read('../src/view/ActorView.ts');
    expect(view).toContain("item.layer === 'wall'");
    expect(view).toContain('item.flip');
  });
});
