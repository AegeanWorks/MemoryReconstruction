import { describe, expect, it } from 'vitest';
import atlas from '../../src/data/sprite_atlas.json';
import {
  ATTEND_RADIUS,
  RESIDENT_SPEED,
  createResident,
  stepResident,
  type RoutePoint,
} from '../../src/sim/residents';
import {
  INTERIOR_EXIT,
  INTERIOR_RESIDENT,
  INTERIOR_SPAWN,
  SANCTUARY_BUILDINGS,
} from '../../src/sim/sanctuary';
const FAR = { x: 10_000, y: 10_000 };
const route: RoutePoint[] = [
  { x: 100, y: 100, work: 2 },
  { x: 300, y: 100, work: 1 },
];
function run(seconds: number, player = FAR, state = createResident(route)) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) stepResident(state, route, dt, player);
  return state;
}
describe('stepResident', () => {
  it('starts working at the first point of the route', () => {
    const s = createResident(route);
    expect(s).toMatchObject({ x: 100, y: 100, pose: 'work', index: 0 });
  });
  it('works for the station time, then walks toward the next point', () => {
    expect(run(1.9).pose).toBe('work');
    const s = run(2.5);
    expect(s.pose).toBe('walk');
    expect(s.x).toBeGreaterThan(100);
    expect(s.facing).toBe(1);
  });
  it('never moves faster than the resident speed', () => {
    const before = run(2.2);
    const x = before.x;
    stepResident(before, route, 0.5, FAR);
    expect(before.x - x).toBeLessThanOrEqual(RESIDENT_SPEED * 0.5 + 1e-6);
  });
  it('arrives, works there, and loops back along the route facing the way it walks', () => {
    const arrive = 2 + 200 / RESIDENT_SPEED;
    const there = run(arrive + 0.2);
    expect(there).toMatchObject({ x: 300, y: 100, pose: 'work', index: 1 });
    const back = run(arrive + 1.5);
    expect(back.pose).toBe('walk');
    expect(back.facing).toBe(-1);
    expect(back.x).toBeLessThan(300);
  });
  it('stops and turns to the walker inside the attend radius, then resumes', () => {
    const s = run(2.6);
    const x = s.x;
    const walker = { x: s.x - ATTEND_RADIUS / 2, y: s.y };
    stepResident(s, route, 0.5, walker);
    expect(s.pose).toBe('attend');
    expect(s.x).toBe(x);
    expect(s.facing).toBe(-1);
    stepResident(s, route, 0.5, FAR);
    expect(s.pose).toBe('walk');
    expect(s.x).toBeGreaterThan(x);
  });
  it('stays put with a one-point route', () => {
    const one: RoutePoint[] = [{ x: 50, y: 60, work: 3 }];
    const s = createResident(one);
    for (let i = 0; i < 600; i++) stepResident(s, one, 1 / 60, FAR);
    expect(s).toMatchObject({ x: 50, y: 60, pose: 'work' });
  });
});
describe('every resident has a sprite and a route through its own room', () => {
  const props = (atlas as { props: Record<string, string> }).props;
  it('names a resident sprite that exists in the atlas', () => {
    for (const b of SANCTUARY_BUILDINGS) {
      expect(props[b.residentSprite], `${b.id}: ${b.residentSprite}`).toBeDefined();
    }
  });
  it('gives each resident a sprite of its own', () => {
    const sprites = SANCTUARY_BUILDINGS.map((b) => b.residentSprite);
    expect(new Set(sprites).size).toBe(sprites.length);
  });
  it('starts every route at the resident post, so the spawn position is unchanged', () => {
    for (const b of SANCTUARY_BUILDINGS) {
      expect(b.route[0], b.id).toMatchObject({ tx: INTERIOR_RESIDENT.tx, ty: INTERIOR_RESIDENT.ty });
      expect(b.route.length, `${b.id} only stands still`).toBeGreaterThanOrEqual(3);
    }
  });
  it('keeps every stop inside the room and off furniture, the spawn mat and the exit', () => {
    for (const b of SANCTUARY_BUILDINGS) {
      const blocked = new Set(b.decor.map((d) => `${d.tx},${d.ty}`));
      blocked.add(`${INTERIOR_SPAWN.tx},${INTERIOR_SPAWN.ty}`);
      blocked.add(`${INTERIOR_EXIT.tx},${INTERIOR_EXIT.ty}`);
      for (const stop of b.route) {
        expect(stop.tx, b.id).toBeGreaterThanOrEqual(3);
        expect(stop.tx, b.id).toBeLessThanOrEqual(21);
        expect(stop.ty, b.id).toBeGreaterThanOrEqual(3);
        expect(stop.ty, b.id).toBeLessThanOrEqual(13);
        expect(blocked.has(`${stop.tx},${stop.ty}`), `${b.id} stop ${stop.tx},${stop.ty}`).toBe(
          false
        );
        expect(stop.work, b.id).toBeGreaterThan(0);
      }
    }
  });
});
