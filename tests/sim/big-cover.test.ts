import { describe, expect, it } from 'vitest';
import { generateFloor } from '../../src/sim/dungeon';
import { Tile } from '../../src/sim/tiles';

/** Big multi-wave rooms must offer cover: crossing 200+ tiles of open floor
 *  under 2-4 tracking-volley waves is exposure without counterplay. Small
 *  boxing rings may stay bare; chambers may not. */
describe('big rooms always furnish cover', () => {
  it('no combat, arena or colosseum room of area >= 200 is fully bare', () => {
    const bare: string[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      for (const depth of [0, 2, 5]) {
        const floor = generateFloor(seed, depth, { roomCount: 10 });
      for (const room of floor.rooms) {
        // Compared as a plain string: the colosseum kind postdates some
        // snapshots, and this test must compile against the base union too.
        const kind: string = room.kind;
        if (kind !== 'combat' && kind !== 'arena' && kind !== 'colosseum') continue;
          if (room.w * room.h < 200) continue;
          let walls = 0;
          for (let y = room.y + 1; y < room.y + room.h - 1; y++)
            for (let x = room.x + 1; x < room.x + room.w - 1; x++)
              if (floor.grid.get(x, y) === Tile.Wall) walls++;
          if (walls === 0) bare.push(`seed=${seed} depth=${depth} area=${room.w * room.h}`);
        }
      }
    }
    expect(bare).toEqual([]);
  });
});
