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
import { NPCS, QUESTS, questDef, questsForNpc } from '../../src/sim/quests';
import { equipmentDef } from '../../src/sim/equipment';

const DT = 1 / 60;

function room(buildingId: string): World {
  return new World(createRun(9, []), { sanctuary: true, building: buildingId });
}

function pixel(spot: { tx: number; ty: number }): { x: number; y: number } {
  return { x: (spot.tx + 0.5) * TILE_SIZE, y: (spot.ty + 0.5) * TILE_SIZE };
}

describe('sanctuary rooms', () => {
  it('describes six residents with a facade, a role and furniture', () => {
    expect(SANCTUARY_BUILDINGS).toHaveLength(6);
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

  it('builds a sealed room of the shared footprint, laid out tile for tile by its plan', () => {
    for (const building of SANCTUARY_BUILDINGS) {
      const floor = buildBuildingFloor(building);
      const grid = floor.grid;
      expect(floor.rooms).toHaveLength(1);
      const room = floor.rooms[0];
      // Inside, every tile is exactly what the plan says (cycle 90: rooms got their own layouts;
      // this used to require all floor). The ring around it is solid.
      for (let ty = room.y; ty < room.y + room.h; ty++)
        for (let tx = room.x; tx < room.x + room.w; tx++)
          expect(grid.get(tx, ty), `${building.id} ${tx},${ty}`).toBe(
            building.plan[ty - room.y][tx - room.x] === '#' ? Tile.Wall : Tile.Floor
          );
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

  it('houses a hearthkeeper with a quest and a valid reward', () => {
    const hearth = buildingById('hearthkeeper')!;
    expect(hearth.name).toBe('The Hearth');
    expect(NPCS.hearthkeeper.name).toBe('The Hearthkeeper');
    const quest = questsForNpc('hearthkeeper')!;
    expect(questDef(quest.id)).toBe(quest);
    expect(quest.kind).toBe('depth');
    if (quest.rewardItem) expect(equipmentDef(quest.rewardItem).id).toBe(quest.rewardItem);
    for (const npcId of SANCTUARY_BUILDINGS.map((b) => b.id)) {
      expect(NPCS[npcId]?.greeting.length ?? 0).toBeGreaterThan(0);
      expect(questsForNpc(npcId)?.target ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('residents move about their rooms', () => {
  const far = (w: World): void => {
    w.player.x = (INTERIOR_EXIT.tx + 0.5) * TILE_SIZE;
    w.player.y = (INTERIOR_EXIT.ty + 0.5) * TILE_SIZE;
  };
  it('leaves the post to work while the walker keeps away', () => {
    for (const building of SANCTUARY_BUILDINGS) {
      const w = room(building.id);
      far(w);
      const npc = w.interactables.find((i) => i.kind === 'npc')!;
      const start = { x: npc.x, y: npc.y };
      let moved = false;
      for (let i = 0; i < 60 * 20 && !moved; i++) {
        far(w);
        w.step(NO_INPUT, DT);
        moved = Math.hypot(npc.x - start.x, npc.y - start.y) > TILE_SIZE;
      }
      expect(moved, `${building.id} never left the post`).toBe(true);
      expect(['walk', 'work']).toContain(npc.pose);
    }
  });
  it('stops and faces a walker who comes to talk, and can be talked to there', () => {
    const w = room('smith');
    far(w);
    const npc = w.interactables.find((i) => i.kind === 'npc')!;
    for (let i = 0; i < 60 * 8; i++) w.step(NO_INPUT, DT);
    w.player.x = npc.x - 30;
    w.player.y = npc.y;
    w.step(NO_INPUT, DT);
    const held = { x: npc.x, y: npc.y };
    for (let i = 0; i < 60; i++) w.step(NO_INPUT, DT);
    expect(npc.pose).toBe('attend');
    expect(npc.facing).toBe(-1);
    expect(npc.x).toBe(held.x);
    expect(npc.y).toBe(held.y);
    const talk = w.step({ ...NO_INPUT, interact: true }, DT);
    expect(talk.some((e) => e.type === 'sanctuary' && e.id === 'smith')).toBe(true);
  });
});

describe('each room has its own floor plan', () => {
  it('describes every plan as 13 rows of 21 tiles, walls and floor only', () => {
    for (const b of SANCTUARY_BUILDINGS) {
      expect(b.plan, b.id).toHaveLength(13);
      for (const row of b.plan) expect(row, b.id).toMatch(/^[#.]{21}$/);
    }
  });
  it('gives every room a different plan with real architecture in it', () => {
    const plans = SANCTUARY_BUILDINGS.map((b) => b.plan.join('\n'));
    expect(new Set(plans).size).toBe(plans.length);
    for (const b of SANCTUARY_BUILDINGS) {
      const walls = b.plan.join('').split('#').length - 1;
      expect(walls, `${b.id} is still a plain box`).toBeGreaterThanOrEqual(4);
    }
  });
  it('builds the plan into the floor and keeps everything a visitor needs on open floor', () => {
    for (const b of SANCTUARY_BUILDINGS) {
      const grid = buildBuildingFloor(b).grid;
      b.plan.forEach((row, y) =>
        [...row].forEach((c, x) => {
          expect(grid.get(x + 2, y + 2), `${b.id} ${x + 2},${y + 2}`).toBe(
            c === '#' ? Tile.Wall : Tile.Floor
          );
        })
      );
      const open = (tx: number, ty: number, what: string): void =>
        expect(grid.get(tx, ty), `${b.id}: ${what} at ${tx},${ty}`).toBe(Tile.Floor);
      open(INTERIOR_SPAWN.tx, INTERIOR_SPAWN.ty, 'spawn');
      open(INTERIOR_EXIT.tx, INTERIOR_EXIT.ty, 'exit');
      for (let ty = INTERIOR_RESIDENT.ty; ty <= INTERIOR_EXIT.ty; ty++)
        open(INTERIOR_EXIT.tx, ty, 'walk lane');
      for (const d of b.decor) open(d.tx, d.ty, d.prop);
      for (const s of b.route) open(s.tx, s.ty, 'route stop');
    }
  });
  it('lets every resident walk its whole route without crossing a wall', () => {
    for (const b of SANCTUARY_BUILDINGS) {
      const grid = buildBuildingFloor(b).grid;
      b.route.forEach((a, i) => {
        const c = b.route[(i + 1) % b.route.length];
        for (let s = 0; s <= 40; s++) {
          const x = Math.floor(a.tx + 0.5 + ((c.tx - a.tx) * s) / 40);
          const y = Math.floor(a.ty + 0.5 + ((c.ty - a.ty) * s) / 40);
          expect(grid.get(x, y), `${b.id} route ${i} crosses ${x},${y}`).toBe(Tile.Floor);
        }
      });
    }
  });
  it('leaves no sealed pocket: every floor tile is reachable from the spawn', () => {
    for (const b of SANCTUARY_BUILDINGS) {
      const grid = buildBuildingFloor(b).grid;
      const seen = new Set<string>();
      const queue: Array<[number, number]> = [[INTERIOR_SPAWN.tx, INTERIOR_SPAWN.ty]];
      while (queue.length > 0) {
        const [x, y] = queue.pop()!;
        const key = `${x},${y}`;
        if (seen.has(key) || grid.get(x, y) !== Tile.Floor) continue;
        seen.add(key);
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      const floor = b.plan.join('').split('.').length - 1;
      expect(seen.size, `${b.id} has unreachable floor`).toBe(floor);
    }
  });
});
