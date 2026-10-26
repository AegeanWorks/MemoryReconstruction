import { describe, expect, it } from 'vitest';
import { SaveStore, defaultMeta, recordRun, type KeyValueStore } from '../src/save/SaveStore';
import { createRun, restoreRun } from '../src/sim/run';

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

  it('defaults engagement fields on snapshots saved before they existed', () => {
    const raw = JSON.parse(JSON.stringify(createRun(7, []))) as Record<string, unknown>;
    const player = raw.player as Record<string, unknown>;
    const stats = raw.stats as Record<string, unknown>;
    delete player.resonance;
    delete player.resonanceTime;
    delete player.dashGrazes;
    delete player.weapon;
    delete player.bombs;
    delete player.traps;
    delete stats.grazes;
    delete stats.bestResonance;
    delete stats.surges;
    delete stats.floorsRestored;
    const restored = restoreRun(raw);
    expect(restored?.player.resonance).toBe(0);
    expect(restored?.player.dashGrazes).toEqual([]);
    expect(restored?.stats.bestResonance).toBe(0);
    expect(restored?.stats.floorsRestored).toBe(0);
    expect(restored?.player.weapon).toBe('sword');
    expect(restored?.player.bombs).toBe(0);
    expect(restored?.player.traps).toBe(0);
  });

  it('defaults sanctuary fields on meta saved before the hub existed', () => {
    const storage = memoryStorage();
    const store = new SaveStore(storage);
    storage.data.set(
      'memory-reconstruction.meta.v1',
      JSON.stringify({
        version: 1,
        fragments: ['fragment_001'],
        runs: 3,
        victories: 1,
        bestDepth: 2,
        settings: { masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.8, screenShake: true },
      })
    );
    const meta = store.loadMeta();
    expect(meta.fragments).toEqual(['fragment_001']);
    expect(meta.runs).toBe(3);
    expect(meta.echoes).toBe(0);
    expect(meta.restorations).toEqual({});
    expect(meta.checkpoint).toBe(0);
    expect(meta.kills).toBe(0);
    expect(meta.bossKills).toBe(0);
    expect(meta.startingWeapon).toBe('sword');
    expect(meta.boon).toBeNull();
    expect(meta.vault).toEqual([]);
    expect(meta.quests).toEqual({ accepted: [], claimed: [] });
  });

  it('banks echoes and unlocks a checkpoint when a run ends', () => {
    const run = createRun(1, []);
    run.depth = 4;
    run.player.shards = 100;
    run.stats.floorsRestored = 1;
    const meta = recordRun(defaultMeta(), run, false);
    expect(meta.echoes).toBe(55);
    expect(meta.checkpoint).toBe(3);
    const won = recordRun(defaultMeta(), run, true);
    expect(won.echoes).toBe(115);
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
