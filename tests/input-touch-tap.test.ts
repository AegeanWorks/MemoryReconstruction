import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../src/input/Input';

type Handler = (event: unknown) => void;

function harness(): { input: Input; fire: (kind: string, event: object) => void } {
  const listeners = new Map<string, Handler>();
  const target = {
    addEventListener: (kind: string, handler: Handler): void => {
      listeners.set(kind, handler);
    },
  } as unknown as HTMLElement;
  vi.stubGlobal('window', { addEventListener: (): void => {} });
  vi.stubGlobal('document', { querySelector: (): null => null });
  vi.stubGlobal('navigator', { getGamepads: () => [] });
  const input = new Input(target, () => {});
  return { input, fire: (kind, event) => listeners.get(kind)?.(event) };
}

const toWorld = (x: number, y: number) => ({ x, y });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('touch taps do not become mouse clicks', () => {
  it('ignores the compatibility mousedown that follows a touch pointerdown', () => {
    const { input, fire } = harness();
    fire('pointerdown', { pointerType: 'touch' });
    fire('mousedown', { button: 0 });
    expect(input.frame(0, 0, toWorld).attack).toBe(false);
  });

  it('still honours a real mouse click', () => {
    const { input, fire } = harness();
    fire('pointerdown', { pointerType: 'mouse' });
    fire('mousedown', { button: 0 });
    expect(input.frame(0, 0, toWorld).attack).toBe(true);
  });

  it('works with no pointer event at all, as before', () => {
    const { input, fire } = harness();
    fire('mousedown', { button: 0 });
    expect(input.frame(0, 0, toWorld).attack).toBe(true);
  });
});
