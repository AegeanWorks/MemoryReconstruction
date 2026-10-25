import { describe, expect, it } from 'vitest';
import { SaveStore, defaultMeta, recordRun, type KeyValueStore } from '../src/save/SaveStore';
import { createRun } from '../src/sim/run';

function memoryStorage(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('SaveStore', () => {
  it('returns defaults when nothing is saved', () => {
    const store = new SaveStore(memoryStorage());
    expect(store.loadMeta()).toEqual(defaultMeta());
    expect(store.hasRun()).toBe(false);
  });

  it('round-trips meta and runs', () => {
    const store = new SaveStore(memoryStorage());
    const meta = { ...defaultMeta(), fragments: ['fragment_001'], runs: 2 };
    store.saveMeta(meta);
    expect(store.loadMeta()).toEqual(meta);
    const run = createRun(42, []);
    run.depth = 3;
    store.saveRun(run);
    expect(store.loadRun()?.depth).toBe(3);
    store.clearRun();
    expect(store.hasRun()).toBe(false);
  });

  it('falls back to defaults on corrupt or old-format data', () => {
    const storage = memoryStorage();
    const store = new SaveStore(storage);
    storage.data.set('memory-reconstruction.meta.v1', '{not json');
    expect(store.loadMeta()).toEqual(defaultMeta());
    storage.data.set(
      'memory-reconstruction.meta.v1',
      JSON.stringify({ version: 1, fragments: 'x' })
    );
    expect(store.loadMeta()).toEqual(defaultMeta());
    storage.data.set('memory-reconstruction.run.v1', JSON.stringify({ version: 0 }));
    expect(store.loadRun()).toBeUndefined();
  });

  it('keeps working when storage throws (private mode, quota)', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const store = new SaveStore(broken);
    expect(store.loadMeta()).toEqual(defaultMeta());
    expect(store.saveMeta(defaultMeta())).toBe(false);
    expect(() => store.clearRun()).not.toThrow();
  });

  it('merges a run into meta progress', () => {
    const run = createRun(1, []);
    run.depth = 2;
    run.fragmentsFound = ['fragment_001', 'fragment_002'];
    const meta = recordRun(
      { ...defaultMeta(), fragments: ['fragment_001'], bestDepth: 1 },
      run,
      false
    );
    expect(meta.fragments.sort()).toEqual(['fragment_001', 'fragment_002']);
    expect(meta.runs).toBe(1);
    expect(meta.bestDepth).toBe(3);
    expect(recordRun(meta, run, true).victories).toBe(1);
  });
});
