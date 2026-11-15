import { describe, expect, it } from 'vitest';
import { createRun } from '../src/sim/run';
import {
  SAVE_FORMAT,
  SLOT_COUNT,
  SaveStore,
  defaultMeta,
  type KeyValueStore,
} from '../src/save/SaveStore';
const LEGACY_META = 'memory-reconstruction.meta.v1'; // aikit:allow-secret -- localStorage key name, not a credential
const LEGACY_RUN = 'memory-reconstruction.run.v1';
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
const clock = (iso: string) => () => new Date(iso);
const withEchoes = (echoes: number) => ({ ...defaultMeta(), echoes });
describe('save slots', () => {
  it('offers three slots and starts on slot 1', () => {
    const store = new SaveStore(new MemoryStore());
    expect(SLOT_COUNT).toBe(3);
    expect(store.activeSlot).toBe(1);
    expect(store.listSlots().map((s) => s.slot)).toEqual([1, 2, 3]);
    expect(store.listSlots().every((s) => s.empty)).toBe(true);
  });
  it('keeps each slot separate, meta and expedition alike', () => {
    const store = new SaveStore(new MemoryStore());
    store.saveMeta(withEchoes(10));
    store.saveRun(createRun(7, []));
    store.selectSlot(2);
    expect(store.loadMeta().echoes).toBe(0);
    expect(store.hasRun()).toBe(false);
    store.saveMeta(withEchoes(99));
    store.selectSlot(1);
    expect(store.loadMeta().echoes).toBe(10);
    expect(store.loadRun()?.seed).toBe(7);
  });
  it('remembers the chosen slot across a reload', () => {
    const storage = new MemoryStore();
    new SaveStore(storage).selectSlot(3);
    expect(new SaveStore(storage).activeSlot).toBe(3);
  });
  it('summarises each slot for the Saves screen', () => {
    const store = new SaveStore(new MemoryStore(), clock('2026-11-15T10:00:00Z'));
    store.selectSlot(2);
    store.saveMeta({ ...withEchoes(42), runs: 5, bestDepth: 3, restorations: { hearth: 2, armory: 1 } });
    store.saveRun(createRun(1, []));
    const two = store.listSlots()[1];
    expect(two).toMatchObject({
      slot: 2,
      empty: false,
      active: true,
      echoes: 42,
      runs: 5,
      bestDepth: 3,
      restorations: 3,
      hasRun: true,
      savedAt: '2026-11-15T10:00:00.000Z',
    });
    expect(store.listSlots()[0]).toMatchObject({ slot: 1, empty: true, active: false });
  });
  it('shares settings across slots, so accessibility follows the player', () => {
    const store = new SaveStore(new MemoryStore());
    const meta = defaultMeta();
    store.saveMeta({ ...meta, settings: { ...meta.settings, screenShake: false } });
    store.selectSlot(2);
    expect(store.loadMeta().settings.screenShake).toBe(false);
  });
  it('deletes one slot and leaves the others', () => {
    const store = new SaveStore(new MemoryStore());
    store.saveMeta(withEchoes(5));
    store.saveRun(createRun(3, []));
    store.selectSlot(2);
    store.saveMeta(withEchoes(6));
    store.deleteSlot(1);
    expect(store.listSlots()[0].empty).toBe(true);
    expect(store.listSlots()[1].empty).toBe(false);
    store.selectSlot(1);
    expect(store.loadMeta()).toEqual(defaultMeta());
    expect(store.hasRun()).toBe(false);
  });
  it('ignores a slot number outside 1..3', () => {
    const store = new SaveStore(new MemoryStore());
    store.selectSlot(0);
    store.selectSlot(4);
    store.selectSlot(1.5);
    expect(store.activeSlot).toBe(1);
  });
});
describe('migration of the single save from before slots', () => {
  it('moves the old save into slot 1 and keeps the old keys as a backup', () => {
    const storage = new MemoryStore();
    storage.setItem(LEGACY_META, JSON.stringify(withEchoes(77)));
    storage.setItem(LEGACY_RUN, JSON.stringify(createRun(11, [])));
    const store = new SaveStore(storage);
    expect(store.activeSlot).toBe(1);
    expect(store.loadMeta().echoes).toBe(77);
    expect(store.loadRun()?.seed).toBe(11);
    expect(storage.getItem(LEGACY_META)).not.toBeNull();
    expect(storage.getItem(LEGACY_RUN)).not.toBeNull();
  });
  it('does not overwrite slot 1 again once slots exist', () => {
    const storage = new MemoryStore();
    storage.setItem(LEGACY_META, JSON.stringify(withEchoes(1)));
    const first = new SaveStore(storage);
    first.saveMeta(withEchoes(500));
    expect(new SaveStore(storage).loadMeta().echoes).toBe(500);
  });
  it('repeats the move if it was cut off before the slot index was written', () => {
    const storage = new MemoryStore();
    storage.setItem(LEGACY_META, JSON.stringify(withEchoes(9)));
    // Simulates a crash after the copy but before the index: no index key exists.
    expect(new SaveStore(storage).loadMeta().echoes).toBe(9);
    for (const key of [...storage.data.keys()]) if (key.includes('slots')) storage.removeItem(key);
    expect(new SaveStore(storage).loadMeta().echoes).toBe(9);
  });
  it('keeps field-wise recovery for a damaged old save', () => {
    const storage = new MemoryStore();
    storage.setItem(LEGACY_META, JSON.stringify({ ...withEchoes(33), fragments: 'broken' }));
    const meta = new SaveStore(storage).loadMeta();
    expect(meta.echoes).toBe(33);
    expect(meta.fragments).toEqual([]);
  });
});
describe('export and import', () => {
  it('round-trips a slot through a file', () => {
    const store = new SaveStore(new MemoryStore());
    store.saveMeta(withEchoes(123));
    store.saveRun(createRun(42, []));
    const file = store.exportSlot(1)!;
    expect(JSON.parse(file).format).toBe(SAVE_FORMAT);
    const other = new SaveStore(new MemoryStore());
    expect(other.importSlot(3, file)).toEqual({ ok: true });
    other.selectSlot(3);
    expect(other.loadMeta().echoes).toBe(123);
    expect(other.loadRun()?.seed).toBe(42);
  });
  it('exports nothing for an empty slot', () => {
    expect(new SaveStore(new MemoryStore()).exportSlot(2)).toBeUndefined();
  });
  it('imports a save that has no expedition in progress, and clears the old one', () => {
    const source = new SaveStore(new MemoryStore());
    source.saveMeta(withEchoes(8));
    const target = new SaveStore(new MemoryStore());
    target.saveRun(createRun(5, []));
    expect(target.importSlot(1, source.exportSlot(1)!)).toEqual({ ok: true });
    expect(target.hasRun()).toBe(false);
    expect(target.loadMeta().echoes).toBe(8);
  });
  it('refuses files that are not saves, and says why, without touching the slot', () => {
    const store = new SaveStore(new MemoryStore());
    store.saveMeta(withEchoes(50));
    const bad = [
      ['not json', 'not a save file'],
      [JSON.stringify({ hello: 1 }), 'not a Memory Reconstruction save'],
      [JSON.stringify({ format: SAVE_FORMAT, version: 99, meta: defaultMeta(), run: null }), 'newer version'],
      [JSON.stringify({ format: SAVE_FORMAT, version: 1, meta: { ...defaultMeta(), echoes: -5 }, run: null }), 'damaged'],
      [JSON.stringify({ format: SAVE_FORMAT, version: 1, meta: defaultMeta(), run: { version: 0 } }), 'damaged'],
    ];
    for (const [text, reason] of bad) {
      const result = store.importSlot(1, text);
      expect(result.ok, text).toBe(false);
      if (!result.ok) expect(result.reason, text).toContain(reason);
    }
    expect(store.loadMeta().echoes).toBe(50);
  });
});
describe('save feedback', () => {
  it('reports every write, and a failed one, to a listener', () => {
    const seen: boolean[] = [];
    const store = new SaveStore(new MemoryStore());
    store.onWrite = (ok) => seen.push(ok);
    store.saveMeta(defaultMeta());
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    const broken = new SaveStore(full);
    broken.onWrite = (ok) => seen.push(ok);
    broken.saveMeta(defaultMeta());
    expect(seen).toEqual([true, false]);
  });
});
