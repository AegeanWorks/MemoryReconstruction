import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../src/input/Input';

type Pad = {
  connected: boolean;
  buttons: Array<{ pressed: boolean }>;
  axes: number[];
};

function makePad(): Pad {
  return {
    connected: true,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    axes: [0, 0, 0, 0],
  };
}

function harness(screenOpen: () => boolean): {
  input: Input;
  pad: Pad;
  menu: string[];
  release: () => void;
} {
  const listeners = new Map<string, (event: unknown) => void>();
  const target = {
    addEventListener: (kind: string, handler: (event: unknown) => void): void => {
      listeners.set(`target:${kind}`, handler);
    },
  } as unknown as HTMLElement;
  const fakeWindow = {
    addEventListener: (kind: string, handler: (event: unknown) => void): void => {
      listeners.set(kind, handler);
    },
  };
  const fakeDocument = {
    querySelector: (selector: string): Element | null =>
      screenOpen() && selector === '.screen' ? ({} as Element) : null,
  };
  const pad = makePad();
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('navigator', { getGamepads: () => [pad] });
  const menu: string[] = [];
  const input = new Input(target, (action) => menu.push(action));
  return {
    input,
    pad,
    menu,
    release: () => {
      for (const button of pad.buttons) button.pressed = false;
    },
  };
}

const idle = (): { x: number; y: number } => ({ x: 0, y: 0 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gamepad menu gate', () => {
  it('does not latch gameplay buttons pressed while a screen is open', () => {
    let open = true;
    const { input, pad, release } = harness(() => open);

    // A (dash), X (potion), Y (interact), LB (art), L3/R3 (bomb/trap), D-pad right (weapon).
    for (const i of [0, 2, 3, 4, 10, 11, 15]) pad.buttons[i].pressed = true;
    input.pollGamepad();

    open = false;
    release();
    input.pollGamepad();
    const frame = input.frame(0, 0, idle);
    expect(frame.dash).toBe(false);
    expect(frame.potion).toBe(false);
    expect(frame.interact).toBe(false);
    expect(frame.art).toBe(false);
    expect(frame.bomb).toBe(false);
    expect(frame.trap).toBe(false);
    expect(frame.weapon).toBe(-1);
  });

  it('still routes menu buttons while a screen is open', () => {
    const { input, pad, menu } = harness(() => true);
    pad.buttons[9].pressed = true; // Start
    input.pollGamepad();
    pad.buttons[9].pressed = false;
    pad.buttons[8].pressed = true; // Back
    input.pollGamepad();
    pad.buttons[8].pressed = false;
    pad.buttons[1].pressed = true; // B
    input.pollGamepad();
    expect(menu).toEqual(['pause', 'map', 'confirm']);
  });

  it('latches a gameplay button pressed after the screen closes', () => {
    let open = true;
    const { input, pad, release } = harness(() => open);
    pad.buttons[0].pressed = true;
    input.pollGamepad();
    open = false;
    release();
    input.pollGamepad();
    expect(input.frame(0, 0, idle).dash).toBe(false);

    pad.buttons[0].pressed = true;
    input.pollGamepad();
    expect(input.frame(0, 0, idle).dash).toBe(true);
  });
});
