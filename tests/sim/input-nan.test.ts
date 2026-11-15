import { describe, expect, it } from 'vitest';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

type Frame = Parameters<World['step']>[0];

function frame(over: Partial<Frame> = {}): Frame {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    attack: false,
    bolt: false,
    dash: false,
    potion: false,
    manaPotion: false,
    interact: false,
    weapon: -1,
    bomb: false,
    trap: false,
    art: false,
    ...over,
  };
}

/** Steps a world and reports whether the walker is still a finite, moving body. */
function play(world: World, frames: number, input: Partial<Frame> = {}): void {
  for (let i = 0; i < frames; i++)
    world.step(
      frame({ moveX: 1, aimX: world.player.x + 40, aimY: world.player.y, ...input }),
      1 / 60
    );
}

describe('non-finite device input', () => {
  it('recovers from a NaN aim frame instead of freezing the walker', () => {
    const world = new World(createRun(7, []));
    const p = world.player;
    const start = { x: p.x, y: p.y };
    // A faulty gamepad axis during a swing used to set aim, knockback and then movement to NaN.
    world.step(frame({ aimX: Number.NaN, aimY: Number.NaN, attack: true }), 1 / 60);
    expect(p.swingTime).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(p.knockX)).toBe(true);
    expect(Number.isFinite(p.knockY)).toBe(true);
    expect(Number.isFinite(p.aim)).toBe(true);

    play(world, 10);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(p.x !== start.x || p.y !== start.y, 'walker can still move').toBe(true);
  });

  it('ignores non-finite movement for the frame and keeps walking afterwards', () => {
    const world = new World(createRun(7, []));
    const p = world.player;
    const start = { x: p.x, y: p.y };
    world.step(frame({ moveX: Number.NaN, moveY: Number.POSITIVE_INFINITY }), 1 / 60);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(p.x).toBe(start.x);
    expect(p.y).toBe(start.y);

    play(world, 10);
    expect(p.x !== start.x || p.y !== start.y, 'walker can still move').toBe(true);
  });

  it('keeps a finite aim frame untouched, including the exact aim angle', () => {
    const world = new World(createRun(7, []));
    const p = world.player;
    world.step(frame({ aimX: p.x + 60, aimY: p.y }), 1 / 60);
    expect(p.aim).toBeCloseTo(0, 5);
    world.step(frame({ aimX: p.x, aimY: p.y - 60 }), 1 / 60);
    expect(p.aim).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('does not let an infinite aim frame poison position or aim', () => {
    const world = new World(createRun(7, []));
    const p = world.player;
    world.step(
      frame({ aimX: Number.POSITIVE_INFINITY, aimY: -Number.POSITIVE_INFINITY, attack: true }),
      1 / 60
    );
    expect(Number.isFinite(p.aim)).toBe(true);
    expect(Number.isFinite(p.knockX)).toBe(true);
    play(world, 6);
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });
});
