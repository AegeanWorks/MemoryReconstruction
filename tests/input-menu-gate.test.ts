import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../src/input/Input';

function harness(screenOpen: () => boolean): {
  input: Input;
  key: (code: string) => void;
  menu: string[];
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
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('navigator', { getGamepads: () => [] });
  const menu: string[] = [];
  const input = new Input(target, (action) => menu.push(action));
  return {
    input,
    key: (code) => listeners.get('keydown')?.({ code, repeat: false, preventDefault() {} }),
    menu,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('input menu gate', () => {
  it('does not latch gameplay actions while a screen is open', () => {
    let open = true;
    const { input, key } = harness(() => open);
    key('KeyJ');
    key('Space');
    key('KeyK');
    const frame = input.frame(0, 0, () => ({ x: 0, y: 0 }));
    expect(frame.attack).toBe(false);
    expect(frame.dash).toBe(false);
    expect(frame.bolt).toBe(false);

    open = false;
    key('KeyJ');
    expect(input.frame(0, 0, () => ({ x: 0, y: 0 })).attack).toBe(true);
  });

  it('still routes menu keys while a screen is open', () => {
    const { key, menu } = harness(() => true);
    key('Escape');
    key('Tab');
    key('Enter');
    key('KeyI');
    expect(menu).toEqual(['pause', 'map', 'confirm', 'inventory']);
  });
});
