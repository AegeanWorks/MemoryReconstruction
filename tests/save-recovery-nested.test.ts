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

describe('nested meta field recovery', () => {
  it('keeps a valid daily streak when lastKey is corrupt', () => {
    const storage = new MemoryStore();
    storage.data.set(
      META_KEY,
      JSON.stringify({
        version: 1,
        fragments: ['fragment_001'],
        runs: 2,
        victories: 1,
        bestDepth: 2,
        echoes: 42,
        daily: { best: {}, streak: 4, bestStreak: 6, lastKey: 42 },
      })
    );
    const meta = new SaveStore(storage).loadMeta();
    expect(meta.fragments).toEqual(['fragment_001']);
    expect(meta.echoes).toBe(42);
    expect(meta.daily.streak).toBe(4);
    expect(meta.daily.bestStreak).toBe(6);
    expect(meta.daily.lastKey).toBe('');
  });

  it('keeps accepted quest ids when claimed is corrupt', () => {
    const storage = new MemoryStore();
    storage.data.set(
      META_KEY,
      JSON.stringify({
        version: 1,
        fragments: ['fragment_001'],
        runs: 1,
        victories: 0,
        bestDepth: 0,
        quests: { accepted: ['quest_archive_first'], claimed: 'bad', acceptedAt: {} },
      })
    );
    const meta = new SaveStore(storage).loadMeta();
    expect(meta.fragments).toEqual(['fragment_001']);
    expect(meta.quests.accepted).toEqual(['quest_archive_first']);
    expect(meta.quests.claimed).toEqual([]);
  });
});
