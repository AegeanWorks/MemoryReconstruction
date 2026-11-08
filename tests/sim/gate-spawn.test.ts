import { describe, expect, it } from 'vitest';
import { generateFloor } from '../../src/sim/dungeon';
import { floorPlan } from '../../src/sim/content';
import { TILE_SIZE } from '../../src/sim/tiles';

function reachableTiles(floor: ReturnType<typeof generateFloor>, sx: number, sy: number): Set<number> {
  const seen = new Set<number>();
  const queue: Array<[number, number]> = [[sx, sy]];
  const key = (x: number, y: number) => y * floor.grid.width + x;
  seen.add(key(sx, sy));
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= floor.grid.width || ny >= floor.grid.height) continue;
      if (!floor.grid.isWalkable(nx, ny)) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

describe('new-layout enemy gates', () => {
  it('spawns every gate inside a reachable part of its room at depths 7 and 14', () => {
    const bad: string[] = [];
    for (const depth of [7, 14]) {
      const plan = floorPlan(depth);
      for (let seed = 1; seed <= 60; seed++) {
        const floor = generateFloor(seed, depth, {
          roomCount: plan.roomCount,
          finale: plan.finale,
          layout: plan.layout,
          bossOnly: plan.bossOnly,
        });
        for (const room of floor.rooms) {
          if (!room.gates?.length) continue;
          const cx = Math.floor((room.x + room.w / 2));
          const cy = Math.floor((room.y + room.h / 2));
          const reachable = reachableTiles(floor, cx, cy);
          for (const gate of room.gates) {
            const gx = Math.floor(gate.spawnX / TILE_SIZE);
            const gy = Math.floor(gate.spawnY / TILE_SIZE);
            const inside = gx >= room.x && gx < room.x + room.w && gy >= room.y && gy < room.y + room.h;
            if (!inside) bad.push(`depth ${depth} seed ${seed} room ${room.id}: gate spawn ${gx},${gy} outside room`);
            if (!floor.grid.isWalkable(gx, gy)) bad.push(`depth ${depth} seed ${seed} room ${room.id}: gate spawn ${gx},${gy} not walkable`);
            if (!reachable.has(gy * floor.grid.width + gx)) bad.push(`depth ${depth} seed ${seed} room ${room.id}: gate spawn ${gx},${gy} unreachable`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
