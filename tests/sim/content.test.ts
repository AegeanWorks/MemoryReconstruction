import { describe, expect, it } from 'vitest';
import {
  CORE_MEMORIES,
  FLOOR_PLANS,
  MEMORY_FRAGMENTS,
  allEnemyIds,
  arenaBossFor,
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
      for (const id of [...plan.roster, plan.boss]) {
        const sprite = enemyDef(id).sprite;
        // The mirror copy wears the player's own sheet, cut at runtime.
        if (sprite === 'mirror') continue;
        expect(keys).toContain(sprite);
      }
  });

  it('makes bosses tougher than their data record', () => {
    expect(enemyDef('guardian', true).maxHealth).toBeGreaterThan(enemyDef('guardian').maxHealth);
  });

  it('grows the expedition to nineteen sections including echo trials and colosseum', () => {
    expect(FLOOR_PLANS).toHaveLength(19);
    expect(FLOOR_PLANS[18].finale).toBe(true);
    expect(FLOOR_PLANS[14].roomCount).toBeGreaterThan(FLOOR_PLANS[0].roomCount);
    expect(new Set(FLOOR_PLANS.map((plan) => plan.biome)).size).toBeGreaterThanOrEqual(14);
    expect(FLOOR_PLANS[4].biome).toBe('ash');
    expect(FLOOR_PLANS[6].biome).toBe('foundry');
    expect(FLOOR_PLANS[9].biome).toBe('frost');
    expect(FLOOR_PLANS[11].biome).toBe('mire');
    expect(FLOOR_PLANS[13].biome).toBe('hive');
    expect(FLOOR_PLANS[14].biome).toBe('catacomb');
    expect(FLOOR_PLANS[16].boss).toBe('dread_champion');
    expect(FLOOR_PLANS[17].boss).toBe('ruin_warlord');
    expect(FLOOR_PLANS.filter((plan) => plan.bossOnly)).toHaveLength(3);
    expect(FLOOR_PLANS.filter((plan) => plan.bossOnly).map((plan) => plan.boss)).toEqual([
      'choir_hierophant',
      'hollow_behemoth',
      'mirror_self',
    ]);
  });

  it('defines melee attacking bosses and teleporting phase stalkers', () => {
    expect(enemyDef('dread_champion', true).archetype).toBe('boss');
    expect(enemyDef('ruin_warlord', true).archetype).toBe('boss');
    expect(enemyDef('phase_stalker').archetype).toBe('teleporter');
    expect(enemyDef('void_stalker').archetype).toBe('teleporter');
  });

  it('adds a mirror trial where the player fights their own copy', () => {
    const trial = FLOOR_PLANS.find((plan) => plan.boss === 'mirror_self')!;
    expect(trial.bossOnly).toBe(true);
    expect(trial.trialName).toContain('Mirror');
    expect(trial.roster).toEqual([]);
    expect(enemyDef('mirror_self', true).archetype).toBe('boss');
    expect(enemyDef('mirror_self', true).sprite).toBe('mirror');
    expect(enemyDef('lost_self').behavior).toBe('duelist');
    expect(enemyDef('lost_self').archetype).toBe('duelist');
  });

  it('keeps the mirror out of mid-floor arenas', () => {
    for (let depth = 0; depth < FLOOR_PLANS.length; depth++) {
      const boss = arenaBossFor(depth);
      expect(boss).not.toBe('mirror_self');
      expect(boss).not.toBe('keeper');
      expect(boss).not.toBe(FLOOR_PLANS[depth].boss);
    }
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

describe('expanded bestiary', () => {
  const newIds = [
    'ash_herald',
    'cinder_hound',
    'frost_oracle',
    'rime_duelist',
    'bloom_sentinel',
    'petal_stalker',
    'grave_warden',
    'void_herald',
    'hive_slinger',
    'mire_lurker',
  ];

  it('adds ten new enemies with non-boss archetypes', () => {
    expect(allEnemyIds().length).toBeGreaterThanOrEqual(52);
    for (const id of newIds) {
      expect(allEnemyIds()).toContain(id);
      expect(enemyDef(id).archetype).not.toBe('boss');
    }
    expect(enemyDef('ash_herald').behavior).toBe('storm_caller');
    expect(enemyDef('frost_oracle').behavior).toBe('sweeper');
    expect(enemyDef('void_herald').behavior).toBe('wall_warden');
    expect(enemyDef('bloom_sentinel').behavior).toBe('pillar_warden');
  });

  it('places the new enemies in later sections', () => {
    const rosters = FLOOR_PLANS.flatMap((plan) => plan.roster);
    for (const id of newIds) expect(rosters).toContain(id);
  });
});
