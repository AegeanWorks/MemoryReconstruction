import { describe, expect, it } from 'vitest';
import { createRun, restoreRun } from '../src/sim/run';
import { FINAL_DEPTH } from '../src/sim/content';
import { SaveStore, defaultMeta, type KeyValueStore } from '../src/save/SaveStore';

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

/** Small deterministic PRNG so a failure is reproducible from the seed alone. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const WEIRD: unknown[] = [
  undefined,
  null,
  true,
  false,
  0,
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  -0.5,
  1e300,
  '',
  'x',
  [],
  {},
  [null],
  { nested: { deep: [1, 2, { x: null }] } },
];

/** Applies random damage to a deep copy of `base`: delete, replace, or corrupt a leaf. */
function mutate(base: unknown, random: () => number, depth = 0): unknown {
  if (random() < 0.06 || depth > 5)
    return structuredClone(WEIRD[Math.floor(random() * WEIRD.length)]);
  if (Array.isArray(base)) {
    const out = base.map((v) =>
      random() < 0.25 ? mutate(v, random, depth + 1) : structuredClone(v)
    );
    if (random() < 0.15) out.splice(Math.floor(random() * (out.length + 1)), 1);
    if (random() < 0.1) out.push(mutate(undefined, random, depth + 1));
    return out;
  }
  if (base && typeof base === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(base as Record<string, unknown>)) {
      if (random() < 0.08) continue; // drop the field
      out[key] = random() < 0.22 ? mutate(value, random, depth + 1) : structuredClone(value);
    }
    return out;
  }
  return structuredClone(base);
}

/** Invariants the game relies on after any successful load. */
function assertUsableRun(run: ReturnType<typeof restoreRun>, seed: number): void {
  if (!run) return;
  const p = run.player;
  expect(Number.isFinite(p.health), `seed ${seed}: health`).toBe(true);
  expect(p.health, `seed ${seed}: health >= 0`).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(p.mana), `seed ${seed}: mana`).toBe(true);
  expect(Number.isFinite(p.dashCharges), `seed ${seed}: dashCharges`).toBe(true);
  expect(Number.isFinite(run.depth), `seed ${seed}: depth`).toBe(true);
  expect(Number.isInteger(run.depth), `seed ${seed}: integer depth`).toBe(true);
  expect(run.depth, `seed ${seed}: depth in range`).toBeGreaterThanOrEqual(0);
  expect(run.depth, `seed ${seed}: depth in range`).toBeLessThanOrEqual(FINAL_DEPTH);
  expect(Array.isArray(p.inventory), `seed ${seed}: inventory`).toBe(true);
  expect(Array.isArray(run.pendingChoices), `seed ${seed}: pendingChoices`).toBe(true);
  expect(Array.isArray(run.fragmentsFound), `seed ${seed}: fragmentsFound`).toBe(true);
  expect(Array.isArray(run.knownFragments), `seed ${seed}: knownFragments`).toBe(true);
  for (const item of p.inventory) expect(typeof item.defId, `seed ${seed}: defId`).toBe('string');
  for (const choice of run.pendingChoices)
    expect(Array.isArray(choice.options), `seed ${seed}: choice options`).toBe(true);
}

describe('depth is kept to a real section', () => {
  const withDepth = (depth: unknown): ReturnType<typeof restoreRun> => {
    const run = JSON.parse(JSON.stringify(createRun(1, [], 'normal'))) as Record<string, unknown>;
    run.depth = depth;
    return restoreRun(run);
  };

  it('clamps absurd, fractional and negative depths', () => {
    expect(withDepth(1e300)!.depth).toBe(FINAL_DEPTH);
    expect(withDepth(Number.MAX_SAFE_INTEGER)!.depth).toBe(FINAL_DEPTH);
    expect(withDepth(3.7)!.depth).toBe(3);
    expect(withDepth(-5)!.depth).toBe(0);
    expect(withDepth(0)!.depth).toBe(0);
    expect(withDepth(FINAL_DEPTH)!.depth).toBe(FINAL_DEPTH);
  });

  it('rejects a snapshot whose depth is not a number at all', () => {
    // The version guard has always treated a non-numeric depth as unusable data.
    expect(withDepth(null)).toBeUndefined();
    expect(withDepth('7')).toBeUndefined();
    expect(withDepth({})).toBeUndefined();
  });
});

describe('save loader survives corrupted snapshots', () => {
  it('restores or rejects 3000 mutated runs without throwing', () => {
    const source = createRun(123456, [], 'normal');
    source.player.inventory = [{ uid: 7, defId: 'rusted_edge', rank: 0 }];
    source.pendingChoices = [{ source: 'level', options: ['vitality', 'brutality', 'swiftness'] }];
    for (let seed = 1; seed <= 3000; seed++) {
      const random = rng(seed);
      // localStorage hands back parsed JSON, so NaN/Infinity/undefined cannot reach the
      // loader; round-trip the mutated object to test the boundary the game actually has.
      const mutated = mutate(JSON.parse(JSON.stringify(source)), random);
      const damaged = mutated === undefined ? undefined : JSON.parse(JSON.stringify(mutated));
      let run: ReturnType<typeof restoreRun>;
      expect(() => {
        run = restoreRun(damaged);
      }, `seed ${seed} threw`).not.toThrow();
      assertUsableRun(run, seed);
    }
  });

  it('restores or rejects 3000 mutated metas without throwing', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const random = rng(seed * 7919);
      const mutated = mutate(JSON.parse(JSON.stringify(defaultMeta())), random);
      const damaged = mutated === undefined ? undefined : JSON.parse(JSON.stringify(mutated));
      const store = new MemoryStore();
      if (damaged !== undefined)
        store.setItem('memory-reconstruction.meta.v1', JSON.stringify(damaged));
      let meta: ReturnType<SaveStore['loadMeta']>;
      expect(() => {
        meta = new SaveStore(store).loadMeta();
      }, `seed ${seed} threw`).not.toThrow();
      expect(meta!.echoes, `seed ${seed}: echoes`).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(meta!.echoes), `seed ${seed}: echoes finite`).toBe(true);
      expect(Array.isArray(meta!.fragments), `seed ${seed}: fragments`).toBe(true);
      expect(Array.isArray(meta!.feats), `seed ${seed}: feats`).toBe(true);
      expect(meta!.settings, `seed ${seed}: settings`).toBeTruthy();
    }
  });
});
