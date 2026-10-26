import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS } from '../../src/sim/content';
import { generateFloor } from '../../src/sim/dungeon';
import { TILE_SIZE, type TileGrid } from '../../src/sim/tiles';

const RADIUS = 11;
const STEP = 8;

function bodyFree(grid: TileGrid, x: number, y: number): boolean {
  const x0 = Math.floor((x - RADIUS) / TILE_SIZE);
  const x1 = Math.floor((x + RADIUS - 0.001) / TILE_SIZE);
  const y0 = Math.floor((y - RADIUS) / TILE_SIZE);
  const y1 = Math.floor((y + RADIUS - 0.001) / TILE_SIZE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) if (grid.isSolid(tx, ty)) return false;
  return true;
}

describe('player clearance', () => {
  it('finds rooms the player body cannot reach', () => {
    const failures: string[] = [];
    for (const plan of FLOOR_PLANS) {
      if (plan.bossOnly || plan.finale) continue;
      for (const seed of [1, 2, 3, 42, 1337, 98765]) {
        const floor = generateFloor(seed, plan.depth, {
          roomCount: plan.roomCount,
          layout: plan.layout,
        });
        const { grid } = floor;
        const w = grid.width * TILE_SIZE;
        const h = grid.height * TILE_SIZE;
        const cols = Math.ceil(w / STEP);
        const rows = Math.ceil(h / STEP);
        const free = new Uint8Array(cols * rows);
        for (let gy = 0; gy < rows; gy++)
          for (let gx = 0; gx < cols; gx++)
            if (bodyFree(grid, gx * STEP + STEP / 2, gy * STEP + STEP / 2))
              free[gy * cols + gx] = 1;
        const start = floor.rooms[floor.startRoom];
        const sx = Math.floor(((start.x + start.w / 2) * TILE_SIZE) / STEP);
        const sy = Math.floor(((start.y + start.h / 2) * TILE_SIZE) / STEP);
        const seen = new Uint8Array(cols * rows);
        const stack: number[] = [];
        const key = (x: number, y: number) => y * cols + x;
        if (free[key(sx, sy)]) {
          seen[key(sx, sy)] = 1;
          stack.push(key(sx, sy));
        }
        while (stack.length) {
          const k = stack.pop()!;
          const gx = k % cols;
          const gy = Math.floor(k / cols);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const nk = key(nx, ny);
            if (!free[nk] || seen[nk]) continue;
            seen[nk] = 1;
            stack.push(nk);
          }
        }
        for (const room of floor.rooms) {
          const rx = Math.floor(((room.x + room.w / 2) * TILE_SIZE) / STEP);
          const ry = Math.floor(((room.y + room.h / 2) * TILE_SIZE) / STEP);
          let reachable = false;
          for (let oy = -6; oy <= 6 && !reachable; oy++)
            for (let ox = -6; ox <= 6 && !reachable; ox++) {
              const x = rx + ox;
              const y = ry + oy;
              if (x >= 0 && y >= 0 && x < cols && y < rows && seen[key(x, y)]) reachable = true;
            }
          if (!reachable)
            failures.push(
              `${plan.biome} d${plan.depth} seed ${seed} room ${room.id} ${room.kind} ${room.shape} @${room.x},${room.y} ${room.w}x${room.h}`
            );
        }
      }
    }
    if (failures.length > 0) console.log('CLEARANCE FAILURES', failures.slice(0, 20));
    expect(failures).toHaveLength(0);
  });
});
