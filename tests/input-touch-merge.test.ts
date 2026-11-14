import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../src/input/Input';

function harness(): Input {
  const target = { addEventListener: (): void => {} } as unknown as HTMLElement;
  vi.stubGlobal('window', { addEventListener: (): void => {} });
  vi.stubGlobal('document', { querySelector: (): null => null });
  vi.stubGlobal('navigator', { getGamepads: () => [] });
  return new Input(target, () => {});
}

const toWorld = (x: number, y: number) => ({ x, y });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('touch merged into the input frame', () => {
  it('moves with the left stick', () => {
    const input = harness();
    input.touch.setMove(60, 0, 60);
    const frame = input.frame(100, 100, toWorld);
    expect(frame.moveX).toBeCloseTo(1, 5);
    expect(frame.moveY).toBeCloseTo(0, 5);
  });

  it('aims along the right stick relative to the player and attacks while it is pushed', () => {
    const input = harness();
    input.touch.setAim(0, 60, 60);
    const frame = input.frame(100, 100, toWorld);
    expect(frame.attack).toBe(true);
    expect(frame.aimX).toBeCloseTo(100, 5);
    expect(frame.aimY).toBeCloseTo(200, 5);
  });

  it('keeps mouse and keyboard aim when no touch is down', () => {
    const input = harness();
    const frame = input.frame(100, 100, (x, y) => ({ x: x + 7, y: y + 9 }));
    expect(frame.attack).toBe(false);
    expect(frame.aimX).toBe(7);
    expect(frame.aimY).toBe(9);
  });

  it('delivers touch one-shots exactly once', () => {
    const input = harness();
    input.touch.tap('dash');
    input.touch.nextWeapon(0);
    expect(input.frame(0, 0, toWorld)).toMatchObject({ dash: true, weapon: 1 });
    expect(input.frame(0, 0, toWorld)).toMatchObject({ dash: false, weapon: -1 });
  });

  it('holds bolt while the button is down', () => {
    const input = harness();
    input.touch.hold('bolt', true);
    expect(input.frame(0, 0, toWorld).bolt).toBe(true);
    expect(input.frame(0, 0, toWorld).bolt).toBe(true);
    input.touch.hold('bolt', false);
    expect(input.frame(0, 0, toWorld).bolt).toBe(false);
  });

  it('releaseAll also drops touch state, so opening a menu cannot leave a stuck stick', () => {
    const input = harness();
    input.touch.setMove(60, 0, 60);
    input.touch.setAim(60, 0, 60);
    input.releaseAll();
    const frame = input.frame(0, 0, toWorld);
    expect(frame.moveX).toBe(0);
    expect(frame.attack).toBe(false);
  });

  it('delivers touch bomb and trap taps exactly once', () => {
    const input = harness();
    input.touch.tap('bomb');
    input.touch.tap('trap');
    expect(input.frame(0, 0, toWorld)).toMatchObject({ bomb: true, trap: true });
    expect(input.frame(0, 0, toWorld)).toMatchObject({ bomb: false, trap: false });
  });
});
