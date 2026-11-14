import { afterEach, describe, expect, it } from 'vitest';
import { SaveStore, defaultMeta, defaultSettings, type KeyValueStore } from '../src/save/SaveStore';

const META_KEY = 'memory-reconstruction.meta.v1'; // aikit:allow-secret -- localStorage key name, not a credential

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const realMatchMedia = (globalThis as { matchMedia?: unknown }).matchMedia;

function stubMatchMedia(reduceMotion: boolean): void {
  (globalThis as { matchMedia?: unknown }).matchMedia = (query: string) => ({
    matches: reduceMotion && query === '(prefers-reduced-motion: reduce)',
    media: query,
  });
}

afterEach(() => {
  if (realMatchMedia === undefined) delete (globalThis as { matchMedia?: unknown }).matchMedia;
  else (globalThis as { matchMedia?: unknown }).matchMedia = realMatchMedia;
});

describe('first-run settings follow the OS motion preference', () => {
  it('keeps shake and flash on when motion is fine', () => {
    stubMatchMedia(false);
    const settings = defaultSettings();
    expect(settings.screenShake).toBe(true);
    expect(settings.screenFlash).toBe(true);
  });

  it('starts with shake and flash off when the OS asks for reduced motion', () => {
    stubMatchMedia(true);
    const settings = defaultSettings();
    expect(settings.screenShake).toBe(false);
    expect(settings.screenFlash).toBe(false);
    // Everything else keeps its normal default.
    expect(settings.damageNumbers).toBe(true);
    expect(settings.autoPause).toBe(true);
    expect(settings.masterVolume).toBe(0.8);
  });

  it('applies the same defaults to a brand-new save', () => {
    stubMatchMedia(true);
    expect(defaultMeta().settings).toEqual(defaultSettings());
  });

  it('never overrides a stored choice', () => {
    stubMatchMedia(true);
    const storage = new MemoryStore();
    const stored = {
      ...defaultMeta(),
      settings: { ...defaultSettings(), screenShake: true, screenFlash: true },
    };
    storage.data.set(META_KEY, JSON.stringify(stored));
    const loaded = new SaveStore(storage).loadMeta();
    expect(loaded.settings.screenShake).toBe(true);
    expect(loaded.settings.screenFlash).toBe(true);
  });

  it('fills a missing settings field from the reduced-motion default, not the schema', () => {
    stubMatchMedia(true);
    const storage = new MemoryStore();
    const partial = JSON.parse(JSON.stringify(defaultMeta())) as Record<string, unknown>;
    delete (partial.settings as Record<string, unknown>).screenShake;
    delete (partial.settings as Record<string, unknown>).screenFlash;
    storage.data.set(META_KEY, JSON.stringify(partial));
    const loaded = new SaveStore(storage).loadMeta();
    expect(loaded.settings.screenShake).toBe(false);
    expect(loaded.settings.screenFlash).toBe(false);
  });

  it('falls back safely when matchMedia is absent, as in tests and old browsers', () => {
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
    const settings = defaultSettings();
    expect(settings.screenShake).toBe(true);
    expect(settings.screenFlash).toBe(true);
  });
});
