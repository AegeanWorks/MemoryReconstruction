import { describe, expect, it } from 'vitest';
import {
  CORE_MEMORIES,
  FLOOR_PLANS,
  MEMORY_FRAGMENTS,
  biomeInfo,
  enemyDef,
  fragmentsForFloor,
} from '../../src/sim/content';
import spriteAtlas from '../../src/data/sprite_atlas.json';

describe('content', () => {
  it('resolves every roster and boss in the floor plan', () => {
    for (const plan of FLOOR_PLANS) {
      expect(biomeInfo(plan.biome).name.length).toBeGreaterThan(0);
      for (const id of plan.roster) expect(enemyDef(id).archetype).not.toBe('boss');
      expect(enemyDef(plan.boss, true).archetype).toBe('boss');
    }
  });

  it('maps every enemy to a sprite in the atlas', () => {
    const keys = Object.keys(spriteAtlas.enemies); // aikit:allow-secret
    for (const plan of FLOOR_PLANS)
      for (const id of [...plan.roster, plan.boss]) expect(keys).toContain(enemyDef(id).sprite);
  });

  it('makes bosses tougher than their data record', () => {
    expect(enemyDef('guardian', true).maxHealth).toBeGreaterThan(enemyDef('guardian').maxHealth);
  });

  it('grows the expedition to sixteen sections including echo trials', () => {
    expect(FLOOR_PLANS).toHaveLength(16);
    expect(FLOOR_PLANS[15].finale).toBe(true);
    expect(FLOOR_PLANS[14].roomCount).toBeGreaterThan(FLOOR_PLANS[0].roomCount);
    expect(new Set(FLOOR_PLANS.map((plan) => plan.biome)).size).toBeGreaterThanOrEqual(14);
    expect(FLOOR_PLANS[4].biome).toBe('ash');
    expect(FLOOR_PLANS[6].biome).toBe('foundry');
    expect(FLOOR_PLANS[9].biome).toBe('frost');
    expect(FLOOR_PLANS[11].biome).toBe('mire');
    expect(FLOOR_PLANS[13].biome).toBe('hive');
    expect(FLOOR_PLANS[14].biome).toBe('catacomb');
    expect(FLOOR_PLANS.filter((plan) => plan.bossOnly)).toHaveLength(2);
    expect(FLOOR_PLANS.filter((plan) => plan.bossOnly).map((plan) => plan.boss)).toEqual([
      'choir_hierophant',
      'hollow_behemoth',
    ]);
  });

  it('uses more than one map layout', () => {
    expect(new Set(FLOOR_PLANS.map((plan) => plan.layout)).size).toBeGreaterThanOrEqual(6);
  });

  it('only references fragments that exist', () => {
    const ids = new Set(MEMORY_FRAGMENTS.map((f) => f.id));
    for (const core of CORE_MEMORIES) for (const f of core.fragments) expect(ids.has(f)).toBe(true);
  });

  it('offers a floor its own biome fragments first and skips owned ones', () => {
    const first = fragmentsForFloor('ruins', new Set());
    expect(MEMORY_FRAGMENTS.find((f) => f.id === first[0])?.biome).toBe('ruins');
    const owned = new Set(first.slice(0, 1));
    expect(fragmentsForFloor('ruins', owned)).not.toContain(first[0]);
  });

  it('rejects unknown ids with a clear error', () => {
    expect(() => enemyDef('nope')).toThrow(/Unknown enemy id 'nope'/);
  });
});
