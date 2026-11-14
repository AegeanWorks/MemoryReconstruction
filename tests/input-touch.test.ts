import { describe, expect, it } from 'vitest';
import { stickVector, TouchState } from '../src/input/touch';

describe('stickVector', () => {
  it('is zero inside the dead zone', () => {
    expect(stickVector(3, 2, 60)).toEqual({ x: 0, y: 0 });
  });

  it('scales with how far the thumb is pushed and clamps to length one', () => {
    const half = stickVector(30, 0, 60);
    expect(half.x).toBeCloseTo(0.5, 5);
    expect(half.y).toBeCloseTo(0, 5);
    const far = stickVector(300, 400, 60);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1, 5);
    expect(far.x / far.y).toBeCloseTo(0.75, 5);
  });
});

describe('TouchState', () => {
  it('moves with the left stick and stops when it is released', () => {
    const touch = new TouchState();
    touch.setMove(60, 0, 60);
    expect(touch.move.x).toBeCloseTo(1, 5);
    touch.clearMove();
    expect(touch.move).toEqual({ x: 0, y: 0 });
  });

  it('aims and holds attack while the right stick is pushed, and lets go with it', () => {
    const touch = new TouchState();
    expect(touch.attackHeld).toBe(false);
    touch.setAim(0, -60, 60);
    expect(touch.aim?.y).toBeCloseTo(-1, 5);
    expect(touch.attackHeld).toBe(true);
    touch.clearAim();
    expect(touch.aim).toBeUndefined();
    expect(touch.attackHeld).toBe(false);
  });

  it('keeps the last aim direction out of the dead zone, so a tiny drift does not drop attack', () => {
    const touch = new TouchState();
    touch.setAim(60, 0, 60);
    touch.setAim(2, 1, 60);
    expect(touch.attackHeld).toBe(false);
    expect(touch.aim?.x).toBeCloseTo(1, 5);
  });

  it('latches one-shot taps until they are consumed, exactly once', () => {
    const touch = new TouchState();
    touch.tap('dash');
    touch.tap('potion');
    expect(touch.consume()).toMatchObject({ dash: true, potion: true, interact: false });
    expect(touch.consume()).toMatchObject({ dash: false, potion: false });
  });

  it('holds the bolt button while pressed and latches a quick tap', () => {
    const touch = new TouchState();
    touch.hold('bolt', true);
    expect(touch.boltHeld).toBe(true);
    touch.hold('bolt', false);
    expect(touch.boltHeld).toBe(false);
    expect(touch.consume().bolt).toBe(true);
  });

  it('cycles the stance 0, 1, 2 and back, starting from the current weapon', () => {
    const touch = new TouchState();
    expect(touch.nextWeapon(0)).toBe(1);
    expect(touch.nextWeapon(1)).toBe(2);
    expect(touch.nextWeapon(2)).toBe(0);
    expect(touch.consume().weapon).toBe(0);
    expect(touch.consume().weapon).toBe(-1);
  });

  it('latches bomb and trap taps like the other one-shots', () => {
    const touch = new TouchState();
    touch.tap('bomb');
    touch.tap('trap');
    expect(touch.consume()).toMatchObject({ bomb: true, trap: true, dash: false });
    expect(touch.consume()).toMatchObject({ bomb: false, trap: false });
  });
});
