/**
 * Flow field toward the player: a breadth-first distance map over walkable
 * tiles. Enemies without a clear line to the player step to the neighbouring
 * tile with the smallest distance, which routes them around pillars instead
 * of pushing into them forever.
 */
import { TILE_SIZE, type TileGrid } from './tiles';

const UNREACHED = 0xffff;
/** Search radius in tiles; rooms are smaller, so this always covers the fight. */
const MAX_DISTANCE = 40;

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

export class FlowField {
  private readonly distance: Uint16Array;
  private readonly queue: Int32Array;

  constructor(private readonly grid: TileGrid) {
    this.distance = new Uint16Array(grid.width * grid.height).fill(UNREACHED);
    this.queue = new Int32Array(grid.width * grid.height);
  }

  /** Recomputes distances outward from the pixel position (the player). */
  update(px: number, py: number): void {
    const g = this.grid;
    this.distance.fill(UNREACHED);
    const sx = Math.floor(px / TILE_SIZE);
    const sy = Math.floor(py / TILE_SIZE);
    if (!g.inBounds(sx, sy)) return;
    let head = 0;
    let tail = 0;
    const start = g.index(sx, sy);
    this.distance[start] = 0;
    this.queue[tail++] = start;
    while (head < tail) {
      const current = this.queue[head++];
      const d = this.distance[current];
      if (d >= MAX_DISTANCE) continue;
      const cx = current % g.width;
      const cy = (current - cx) / g.width;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (g.isSolid(nx, ny)) continue;
        // No diagonal steps through wall corners.
        if (dx !== 0 && dy !== 0 && (g.isSolid(cx + dx, cy) || g.isSolid(cx, cy + dy))) continue;
        const next = g.index(nx, ny);
        if (this.distance[next] !== UNREACHED) continue;
        this.distance[next] = d + 1;
        this.queue[tail++] = next;
      }
    }
  }

  /** Unit direction toward the player along the field, or undefined when unreachable. */
  direction(x: number, y: number): { x: number; y: number } | undefined {
    const g = this.grid;
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (!g.inBounds(tx, ty)) return undefined;
    let best = this.distance[g.index(tx, ty)];
    let bestX = 0;
    let bestY = 0;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!g.inBounds(nx, ny) || g.isSolid(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (g.isSolid(tx + dx, ty) || g.isSolid(tx, ty + dy))) continue;
      const d = this.distance[g.index(nx, ny)];
      if (d < best) {
        best = d;
        bestX = (nx + 0.5) * TILE_SIZE - x;
        bestY = (ny + 0.5) * TILE_SIZE - y;
      }
    }
    const len = Math.hypot(bestX, bestY);
    if (len < 1e-6) return undefined;
    return { x: bestX / len, y: bestY / len };
  }
}
