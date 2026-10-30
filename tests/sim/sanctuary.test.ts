import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import {
  buildBuildingFloor,
  buildingById,
  INTERIOR_EXIT,
  INTERIOR_RESIDENT,
  INTERIOR_SPAWN,
  SANCTUARY_BUILDINGS,
  SANCTUARY_STATIONS,
  spotToPixels,
} from '../../src/sim/sanctuary';
import { Tile, TILE_SIZE } from '../../src/sim/tiles';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function room(buildingId: string): World {
  return new World(createRun(9, []), { sanctuary: true, building: buildingId });
}

function pixel(spot: { tx: number; ty: number }): { x: number; y: number } {
  return { x: (spot.tx + 0.5) * TILE_SIZE, y: (spot.ty + 0.5) * TILE_SIZE };
}

describe('sanctuary rooms', () => {
  it('describes five residents with a facade, a role and furniture', () => {
    expect(SANCTUARY_BUILDINGS).toHaveLength(5);
    for (const building of SANCTUARY_BUILDINGS) {
      expect(building.facade.startsWith('building_'), building.id).toBe(true);
      expect(building.role.length).toBeGreaterThan(0);
      expect(building.decor.length).toBeGreaterThan(3);
    }
    expect(new Set(SANCTUARY_BUILDINGS.map((b) => b.id)).size).toBe(SANCTUARY_BUILDINGS.length);
  });

  it('gives every interior a distinct palette and a card prop', () => {
    const themes = SANCTUARY_BUILDINGS.map((b) => b.theme);
    expect(new Set(themes).size).toBe(themes.length);
    for (const building of SANCTUARY_BUILDINGS) {
      expect(building.cardProp.length).toBeGreaterThan(0);
      expect(
        new World(createRun(1, []), { sanctuary: true, building: building.id }).plan.biome
      ).toBe(building.theme);
    }
  });

  it('exposes exactly eight stable station ids for the hub UI', () => {
    expect(SANCTUARY_STATIONS).toHaveLength(8);
    expect(SANCTUARY_STATIONS.map((s) => s.id)).toEqual([
      'restoration',
      'training',
      'meditation',
      'noticeboard',
      'reliquary',
      'cairn',
      'aspect',
      'reforge',
    ]);
  });

  it('builds the same sealed, walkable room for every resident', () => {
    for (const building of SANCTUARY_BUILDINGS) {
      const floor = buildBuildingFloor(building);
      const grid = floor.grid;
      expect(floor.rooms).toHaveLength(1);
      const room = floor.rooms[0];
      // Interior is walkable, the ring around it is solid.
      for (let ty = room.y; ty < room.y + room.h; ty++)
        for (let tx = room.x; tx < room.x + room.w; tx++)
          expect(grid.get(tx, ty), `${building.id} ${tx},${ty}`).toBe(Tile.Floor);
      for (let tx = room.x - 1; tx <= room.x + room.w; tx++) {
        expect(grid.get(tx, room.y - 1)).toBe(Tile.Wall);
        expect(grid.get(tx, room.y + room.h)).toBe(Tile.Wall);
      }
      for (let ty = room.y - 1; ty <= room.y + room.h; ty++) {
        expect(grid.get(room.x - 1, ty)).toBe(Tile.Wall);
        expect(grid.get(room.x + room.w, ty)).toBe(Tile.Wall);
      }
      expect(grid.get(INTERIOR_SPAWN.tx, INTERIOR_SPAWN.ty)).toBe(Tile.Floor);
      expect(grid.get(INTERIOR_EXIT.tx, INTERIOR_EXIT.ty)).toBe(Tile.Floor);
      expect(grid.get(INTERIOR_RESIDENT.tx, INTERIOR_RESIDENT.ty)).toBe(Tile.Floor);
    }
  });

  it('spawns the walker at the entrance of the requested room', () => {
    for (const building of SANCTUARY_BUILDINGS) {
      const w = room(building.id);
      expect(w.mode).toBe('sanctuary');
      expect(w.activeBuilding).toBe(building.id);
      const spawn = pixel(INTERIOR_SPAWN);
      expect(w.player.x).toBeCloseTo(spawn.x);
      expect(w.player.y).toBeCloseTo(spawn.y);
      expect(w.grid.isSolidAtPixel(w.player.x, w.player.y)).toBe(false);
    }
  });

  it('places exactly one resident and one way out in each room', () => {
    for (const building of SANCTUARY_BUILDINGS) {
      const w = room(building.id);
      const npcs = w.interactables.filter((i) => i.kind === 'npc');
      const doors = w.interactables.filter((i) => i.kind === 'door');
      expect(npcs).toHaveLength(1);
      expect(doors).toHaveLength(1);
      expect(npcs[0].npcId).toBe(building.id);
      expect(doors[0].interior).toBe(true);
      const resident = pixel(INTERIOR_RESIDENT);
      expect(npcs[0].x).toBeCloseTo(resident.x);
      expect(npcs[0].y).toBeCloseTo(resident.y);
      expect(w.decor.length).toBe(building.decor.length);
    }
  });

  it('keeps spawn, exit, resident and furniture on separate tiles', () => {
    for (const building of SANCTUARY_BUILDINGS) {
      const taken = new Map<string, string>();
      const claim = (tx: number, ty: number, who: string): void => {
        const key = `${Math.floor(tx)},${Math.floor(ty)}`;
        expect(taken.has(key), `${building.id}: ${who} collides with ${taken.get(key)}`).toBe(
          false
        );
        taken.set(key, who);
      };
      claim(INTERIOR_SPAWN.tx, INTERIOR_SPAWN.ty, 'spawn');
      claim(INTERIOR_EXIT.tx, INTERIOR_EXIT.ty, 'exit');
      claim(INTERIOR_RESIDENT.tx, INTERIOR_RESIDENT.ty, 'resident');
      for (const d of building.decor) claim(d.tx, d.ty, d.prop);
    }
  });

  it('emits the resident when talked to and a building exit at the door', () => {
    const w = room('gardener');
    const npc = w.interactables.find((i) => i.kind === 'npc')!;
    w.player.x = npc.x;
    w.player.y = npc.y;
    const talk = w.step({ ...NO_INPUT, interact: true }, DT);
    const spoke = talk.find((e) => e.type === 'sanctuary');
    expect(spoke && spoke.type === 'sanctuary' ? spoke.id : '').toBe('gardener');

    const door = w.interactables.find((i) => i.kind === 'door')!;
    w.player.x = door.x;
    w.player.y = door.y;
    const leave = w.step({ ...NO_INPUT, interact: true }, DT);
    const exited = leave.find((e) => e.type === 'buildingExit');
    expect(exited && exited.type === 'buildingExit' ? exited.id : '').toBe('gardener');
  });

  it('refuses an unknown building instead of building an empty room', () => {
    expect(() => new World(createRun(1, []), { sanctuary: true })).toThrow();
    expect(() => new World(createRun(1, []), { sanctuary: true, building: 'nowhere' })).toThrow();
    expect(buildingById('nowhere')).toBeUndefined();
    expect(buildingById('smith')?.name).toBe('The Forge');
  });

  it('leaves dungeon worlds with no active building', () => {
    const w = new World(createRun(3, []));
    expect(w.mode).toBe('dungeon');
    expect(w.activeBuilding).toBeUndefined();
  });

  it('converts tile spots to tile centres', () => {
    const p = spotToPixels({ tx: 2, ty: 3 });
    expect(p).toEqual({ x: 2.5 * TILE_SIZE, y: 3.5 * TILE_SIZE });
  });
});
