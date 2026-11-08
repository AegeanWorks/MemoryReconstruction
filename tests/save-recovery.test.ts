import { describe, expect, it } from 'vitest';
import { SaveStore, type KeyValueStore } from '../src/save/SaveStore';

const META_KEY = 'memory-reconstruction.meta.v1';

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

describe('meta field-wise recovery', () => {
  it('keeps valid career fields when one settings value is corrupt', () => {
    const storage = new MemoryStore();
    storage.data.set(
      META_KEY,
      JSON.stringify({
        version: 1,
        fragments: ['fragment_001', 'fragment_002'],
        runs: 4,
        victories: 2,
        bestDepth: 3,
        echoes: 42,
        kills: 77,
        settings: { masterVolume: 2 },
      })
    );
    const meta = new SaveStore(storage).loadMeta();
    expect(meta.fragments).toEqual(['fragment_001', 'fragment_002']);
    expect(meta.runs).toBe(4);
    expect(meta.victories).toBe(2);
    expect(meta.bestDepth).toBe(3);
    expect(meta.echoes).toBe(42);
    expect(meta.kills).toBe(77);
    expect(meta.settings.masterVolume).toBe(0.8);
  });

  it('salvages valid settings fields beside the invalid one', () => {
    const storage = new MemoryStore();
    storage.data.set(
      META_KEY,
      JSON.stringify({
        version: 1,
        fragments: ['fragment_001'],
        runs: 1,
        victories: 0,
        bestDepth: 0,
        settings: { masterVolume: 0.25, musicVolume: 2, sfxVolume: 0.4 },
      })
    );
    const meta = new SaveStore(storage).loadMeta();
    expect(meta.fragments).toEqual(['fragment_001']);
    expect(meta.settings.masterVolume).toBe(0.25);
    expect(meta.settings.musicVolume).toBe(0.5);
    expect(meta.settings.sfxVolume).toBe(0.4);
  });
});
