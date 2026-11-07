import { describe, expect, it } from 'vitest';
import { generateFloor } from '../../src/sim/dungeon';

function terraceFloor(seed: number, depth: number) {
  return generateFloor(seed, depth, { roomCount: depth === 10 ? 11 : 13, layout: 'terrace' });
}

describe('terrace layout integrity', () => {
  it('never stacks two rooms on one cell', () => {
    for (const seed of [1, 7, 99, 20261107]) {
      for (const depth of [10, 19]) {
        const floor = terraceFloor(seed, depth);
        const keys = floor.rooms.map((room) => `${room.cellX},${room.cellY}`);
        expect(new Set(keys).size, `seed ${seed} depth ${depth}`).toBe(keys.length);
        expect(floor.rooms.length, `seed ${seed} depth ${depth}`).toBe(14);
      }
    }
  });

  it('keeps every terrace room reachable from the start', () => {
    for (const seed of [1, 7, 99, 20261107]) {
      const floor = terraceFloor(seed, 10);
      const reachable = new Set<number>([floor.startRoom]);
      const queue = [floor.startRoom];
      while (queue.length > 0) {
        const id = queue.shift()!;
        for (const door of floor.rooms[id].doors) {
          if (reachable.has(door.leadsTo)) continue;
          reachable.add(door.leadsTo);
          queue.push(door.leadsTo);
        }
      }
      expect(reachable.size, `seed ${seed}`).toBe(floor.rooms.length);
    }
  });
});
