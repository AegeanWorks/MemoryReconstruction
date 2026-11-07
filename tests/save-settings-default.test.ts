import { describe, expect, it } from 'vitest';
import { SaveStore, defaultMeta, type KeyValueStore } from '../src/save/SaveStore';

function memoryStorage(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('meta settings compatibility', () => {
  it('keeps career progress when the settings block is missing', () => {
    const storage = memoryStorage();
    const store = new SaveStore(storage);
    const meta = {
      ...defaultMeta(),
      fragments: ['fragment_001', 'fragment_002'],
      runs: 7,
      victories: 2,
      bestDepth: 5,
      echoes: 123,
    };
    const raw = JSON.parse(JSON.stringify(meta)) as Record<string, unknown>;
    delete raw.settings;
    storage.data.set('memory-reconstruction.meta.v1', JSON.stringify(raw));

    const loaded = store.loadMeta();
    expect(loaded.fragments).toEqual(['fragment_001', 'fragment_002']);
    expect(loaded.runs).toBe(7);
    expect(loaded.victories).toBe(2);
    expect(loaded.bestDepth).toBe(5);
    expect(loaded.echoes).toBe(123);
    expect(loaded.settings).toEqual(defaultMeta().settings);
  });
});
