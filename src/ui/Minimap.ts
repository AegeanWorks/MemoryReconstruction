/**
 * Room map drawn on a canvas: visited rooms filled, rooms seen through an
 * open doorway outlined, special rooms marked once known.
 */
import type { Room } from '../sim/dungeon';
import { TILE_SIZE } from '../sim/tiles';
import type { World } from '../sim/world';

const KIND_COLOR: Record<Room['kind'], string> = {
  start: '#8fd7ff',
  combat: '#9a8fb8',
  treasure: '#ffd98a',
  shrine: '#6fe7ff',
  boss: '#ff4d5e',
  arena: '#ff9a5e',
  library: '#b8a4ff',
};

/** Rooms worth showing: visited ones and their direct neighbours. */
function knownRooms(world: World): Set<number> {
  const known = new Set<number>();
  world.floor.rooms.forEach((room, id) => {
    if (!world.visited[id]) return;
    known.add(id);
    for (const door of room.doors) known.add(door.leadsTo);
  });
  return known;
}

export function drawMap(canvas: HTMLCanvasElement, world: World, time: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const known = knownRooms(world);
  const rooms = world.floor.rooms.filter((r) => known.has(r.id));
  if (rooms.length === 0) return;

  // Fit the known rooms' bounding box, with padding.
  const minX = Math.min(...rooms.map((r) => r.x)) - 1;
  const minY = Math.min(...rooms.map((r) => r.y)) - 1;
  const maxX = Math.max(...rooms.map((r) => r.x + r.w)) + 1;
  const maxY = Math.max(...rooms.map((r) => r.y + r.h)) + 1;
  const scale = Math.min(w / (maxX - minX), h / (maxY - minY), 24);
  const ox = (w - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (h - (maxY - minY) * scale) / 2 - minY * scale;
  const rect = (x: number, y: number, rw: number, rh: number): [number, number, number, number] => [
    ox + x * scale,
    oy + y * scale,
    rw * scale,
    rh * scale,
  ];

  // Corridors between known rooms.
  ctx.strokeStyle = 'rgba(200, 190, 230, 0.35)';
  ctx.lineWidth = Math.max(2, scale * 1.5);
  for (const room of rooms) {
    for (const door of room.doors) {
      if (!known.has(door.leadsTo) || door.leadsTo < room.id) continue;
      const other = world.floor.rooms[door.leadsTo];
      ctx.beginPath();
      ctx.moveTo(ox + (room.x + room.w / 2) * scale, oy + (room.y + room.h / 2) * scale);
      ctx.lineTo(ox + (other.x + other.w / 2) * scale, oy + (other.y + other.h / 2) * scale);
      ctx.stroke();
    }
  }

  const current = world.currentRoom();
  for (const room of rooms) {
    const visited = world.visited[room.id];
    const state = world.rooms[room.id];
    const [x, y, rw, rh] = rect(room.x, room.y, room.w, room.h);
    ctx.fillStyle = visited
      ? state.phase === 'active'
        ? 'rgba(255, 77, 94, 0.55)'
        : 'rgba(120, 110, 160, 0.55)'
      : 'rgba(40, 36, 60, 0.6)';
    ctx.fillRect(x, y, rw, rh);
    ctx.lineWidth = room.id === current?.id ? 2 : 1;
    ctx.strokeStyle =
      room.id === current?.id
        ? '#ffffff'
        : room.kind === 'combat' || room.kind === 'start'
          ? 'rgba(220,210,255,0.5)'
          : KIND_COLOR[room.kind];
    ctx.strokeRect(x + 0.5, y + 0.5, rw - 1, rh - 1);
    if (room.kind !== 'combat' && room.kind !== 'start') {
      ctx.fillStyle = KIND_COLOR[room.kind];
      ctx.beginPath();
      ctx.arc(x + rw / 2, y + rh / 2, Math.max(3, scale * 1.6), 0, Math.PI * 2);
      ctx.fill();
    }
    // A cleared combat room gets a tick, so progress is readable at a glance.
    if (room.kind === 'combat' && state.phase === 'cleared' && visited) {
      ctx.strokeStyle = 'rgba(157, 243, 255, 0.85)';
      ctx.lineWidth = 1.5;
      const cx = x + rw - Math.max(5, scale);
      const cy = y + Math.max(5, scale);
      const s = Math.max(3, scale * 0.9);
      ctx.beginPath();
      ctx.moveTo(cx - s, cy);
      ctx.lineTo(cx - s * 0.2, cy + s * 0.7);
      ctx.lineTo(cx + s, cy - s * 0.7);
      ctx.stroke();
    }
    // Iron enemy spawn gates: render a crimson barred hatch mark on the room perimeter
    if (room.gates && room.gates.length > 0 && visited) {
      // A room that still owes waves blinks its gates, so the player knows the
      // fight is not over and where the next wave will come from. Once the room
      // is cleared the hatch dims to a spent reminder.
      const state = world.rooms[room.id];
      const reinforcing = state?.phase === 'active' && state.wavesLeft > 0;
      const spent = state?.phase === 'cleared';
      const glow = reinforcing ? 0.55 + 0.45 * Math.sin(time * 6) : spent ? 0.32 : 0.95;
      ctx.strokeStyle = `rgba(255, 106, 74, ${glow.toFixed(2)})`;
      ctx.lineWidth = Math.max(1.8, scale * 0.4);
      for (const gate of room.gates) {
        if (gate.direction === 'north' || gate.direction === 'south') {
          const gy = gate.direction === 'north' ? y : y + rh;
          const gx = ox + (room.x + room.w / 2) * scale;
          const hw = Math.max(3, scale * 1.1);
          ctx.beginPath();
          ctx.moveTo(gx - hw, gy);
          ctx.lineTo(gx + hw, gy);
          ctx.stroke();
          for (const dx of [-hw * 0.5, 0, hw * 0.5]) {
            ctx.beginPath();
            ctx.moveTo(gx + dx, gy - (gate.direction === 'north' ? 2 : -2));
            ctx.lineTo(gx + dx, gy + (gate.direction === 'north' ? 2 : -2));
            ctx.stroke();
          }
        } else {
          const gx = gate.direction === 'west' ? x : x + rw;
          const gy = oy + (room.y + room.h / 2) * scale;
          const hh = Math.max(3, scale * 1.1);
          ctx.beginPath();
          ctx.moveTo(gx, gy - hh);
          ctx.lineTo(gx, gy + hh);
          ctx.stroke();
          for (const dy of [-hh * 0.5, 0, hh * 0.5]) {
            ctx.beginPath();
            ctx.moveTo(gx - (gate.direction === 'west' ? 2 : -2), gy + dy);
            ctx.lineTo(gx + (gate.direction === 'west' ? 2 : -2), gy + dy);
            ctx.stroke();
          }
        }
      }
    }
  }

  // Unclaimed objectives pulse so a missed chest, well, archive or merchant is easy to find again.
  const pulse = 0.55 + 0.45 * Math.sin(time * 4);
  for (const item of world.interactables) {
    if (
      item.used ||
      (item.kind !== 'chest' &&
        item.kind !== 'shrine' &&
        item.kind !== 'archive' &&
        item.kind !== 'merchant' &&
        item.kind !== 'fountain' &&
        item.kind !== 'lever')
    )
      continue;
    const room = world.floor.rooms.find(
      (r) =>
        item.x >= r.x * TILE_SIZE &&
        item.x <= (r.x + r.w) * TILE_SIZE &&
        item.y >= r.y * TILE_SIZE &&
        item.y <= (r.y + r.h) * TILE_SIZE
    );
    if (room && !known.has(room.id)) continue;
    const ix = ox + (item.x / TILE_SIZE) * scale;
    const iy = oy + (item.y / TILE_SIZE) * scale;
    const color =
      item.kind === 'chest'
        ? `rgba(255, 217, 138, ${pulse})`
        : item.kind === 'shrine'
          ? `rgba(111, 231, 255, ${pulse})`
          : item.kind === 'archive'
            ? `rgba(184, 164, 255, ${pulse})`
            : item.kind === 'lever'
              ? `rgba(255, 176, 74, ${pulse})`
              : item.kind === 'merchant'
                ? 'rgba(255, 208, 96, 0.9)'
                : 'rgba(143, 215, 255, 0.75)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ix, iy, Math.max(4, scale * 2) + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();

    // Inner icon symbol for lore archives, levers and shops
    ctx.fillStyle = color;
    if (item.kind === 'archive') {
      ctx.beginPath();
      ctx.moveTo(ix, iy - 2.5);
      ctx.lineTo(ix + 2.5, iy);
      ctx.lineTo(ix, iy + 2.5);
      ctx.lineTo(ix - 2.5, iy);
      ctx.fill();
    } else if (item.kind === 'lever') {
      ctx.beginPath();
      ctx.moveTo(ix - 2, iy + 2);
      ctx.lineTo(ix + 2, iy - 2);
      ctx.stroke();
    } else if (item.kind === 'merchant') {
      ctx.beginPath();
      ctx.arc(ix, iy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Exit portal once open.
  const portal = world.interactables.find((i) => i.kind === 'portal');
  if (portal) {
    ctx.fillStyle = `rgba(111, 231, 255, ${0.6 + 0.4 * Math.sin(time * 5)})`;
    ctx.beginPath();
    ctx.arc(
      ox + (portal.x / TILE_SIZE) * scale,
      oy + (portal.y / TILE_SIZE) * scale,
      Math.max(4, scale * 2.4),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  const p = world.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(
    ox + (p.x / TILE_SIZE) * scale,
    oy + (p.y / TILE_SIZE) * scale,
    Math.max(2.5, scale * 1.2),
    0,
    Math.PI * 2
  );
  ctx.fill();
}
