import { describe, expect, it } from 'vitest';
import {
  CAIRN_COST,
  CAIRN_MAX,
  CAIRN_SHARDS,
  RESTORATIONS,
  TOTAL_RESTORATION_LEVELS,
  aspectDef,
  attuneRelic,
  cairnCost,
  cairnOfferings,
  checkpointDepths,
  checkpointForDepth,
  chooseAspect,
  clearOfferings,
  createExpedition,
  echoesEarned,
  nextRestorationCost,
  purchaseOffering,
  purchaseRestoration,
  reforgeCost,
  reforgeRelic,
  relicRank,
  restorationLevel,
  restoredLevels,
  sectionNumber,
  type SanctuaryProgress,
} from '../src/sim/hub';
import { applyChoice, createRun, restoreRun } from '../src/sim/run';

function progress(overrides: Partial<SanctuaryProgress> = {}): SanctuaryProgress {
  return { echoes: 0, restorations: {}, checkpoint: 0, ...overrides };
}

describe('Sanctuary hub', () => {
  it('offers every third section plus the last as a checkpoint', () => {
    expect(checkpointDepths()).toEqual([0, 3, 6, 9, 12, 15]);
    expect(checkpointForDepth(0)).toBe(0);
    expect(checkpointForDepth(2)).toBe(0);
    expect(checkpointForDepth(3)).toBe(3);
    expect(checkpointForDepth(5)).toBe(3);
    expect(checkpointForDepth(8)).toBe(6);
    expect(checkpointForDepth(9)).toBe(9);
    expect(checkpointForDepth(10)).toBe(9);
    expect(checkpointForDepth(11)).toBe(9);
    expect(checkpointForDepth(12)).toBe(12);
    expect(checkpointForDepth(13)).toBe(12);
    expect(checkpointForDepth(14)).toBe(12);
    expect(checkpointForDepth(15)).toBe(15);
    expect(sectionNumber(0)).toBe(1);
    expect(sectionNumber(9)).toBe(10);
    expect(sectionNumber(11)).toBe(12);
    expect(sectionNumber(13)).toBe(14);
    expect(sectionNumber(15)).toBe(16);
  });

  it('banks half the remaining shards plus clear and victory bonuses', () => {
    const run = createRun(1, []);
    run.player.shards = 100;
    expect(echoesEarned(run, false)).toBe(50);
    run.stats.floorsRestored = 2;
    expect(echoesEarned(run, false)).toBe(60);
    expect(echoesEarned(run, true)).toBe(120);
  });

  it('buys restoration levels only when affordable and not maxed', () => {
    const hearth = RESTORATIONS.find((r) => r.id === 'hearth')!;
    const poor = progress({ echoes: hearth.cost - 1 });
    expect(purchaseRestoration(poor, 'hearth')).toBeUndefined();

    const paid = progress({ echoes: hearth.cost });
    const once = purchaseRestoration(paid, 'hearth')!;
    expect(once.echoes).toBe(0);
    expect(restorationLevel(once, 'hearth')).toBe(1);

    let maxed = progress({ echoes: 500 });
    for (let i = 0; i < hearth.maxLevel; i++) maxed = purchaseRestoration(maxed, 'hearth')!;
    expect(restorationLevel(maxed, 'hearth')).toBe(hearth.maxLevel);
    expect(nextRestorationCost(maxed, 'hearth')).toBeUndefined();
    expect(purchaseRestoration(maxed, 'hearth')).toBeUndefined();
    expect(() => purchaseRestoration(maxed, 'nope')).not.toThrow();
  });

  it('counts restored levels across structures', () => {
    const p = progress({ restorations: { hearth: 2, armory: 1 } });
    expect(restoredLevels(p)).toBe(3);
    expect(TOTAL_RESTORATION_LEVELS).toBeGreaterThan(3);
  });

  it('builds an expedition with restorations, vestige upgrades and full health', () => {
    const run = createExpedition(99, [], 3, progress({ restorations: { hearth: 2, armory: 1 } }));
    expect(run.depth).toBe(3);
    expect(run.player.level).toBe(7);
    expect(run.player.upgrades.vitality).toBeGreaterThanOrEqual(2);
    expect(run.player.upgrades.edge).toBeGreaterThanOrEqual(1);
    const stacks = Object.values(run.player.upgrades).reduce((sum, n) => sum + n, 0);
    expect(stacks).toBe(3 + 3 * 2);
    expect(run.player.health).toBe(run.player.stats.maxHealth);
    expect(run.player.potions).toBe(run.player.stats.maxPotions);
    expect(run.player.shards).toBe(0);
    expect(run.pendingChoices).toEqual([]);
  });

  it('starts a fresh run unchanged when no restoration or skip applies', () => {
    const run = createExpedition(7, ['fragment_001'], 0, progress());
    expect(run.depth).toBe(0);
    expect(run.player.level).toBe(1);
    expect(run.player.upgrades).toEqual({});
    expect(run.knownFragments).toEqual(['fragment_001']);
  });

  it('is deterministic for the same seed and progress', () => {
    const a = createExpedition(123, [], 6, progress({ restorations: { hearth: 1 } }));
    const b = createExpedition(123, [], 6, progress({ restorations: { hearth: 1 } }));
    expect(a.player.upgrades).toEqual(b.player.upgrades);
    expect(a.player.stats).toEqual(b.player.stats);
  });

  it('applies the trained weapon and a meditation boon', () => {
    const run = createExpedition(4, [], 0, progress({ startingWeapon: 'spear', boon: 'edge' }));
    expect(run.player.weapon).toBe('spear');
    expect(run.player.upgrades.edge).toBeGreaterThanOrEqual(1);
    const plain = createExpedition(4, [], 0, progress());
    expect(plain.player.weapon).toBe('sword');
    expect(plain.player.upgrades.edge).toBeUndefined();
  });

  it('clamps a checkpoint beyond the last section', () => {
    const run = createExpedition(1, [], 99, progress());
    expect(run.depth).toBe(15);
  });
});

describe('Reliquary and Cairn', () => {
  it('attunes only relics already in the vault, and can clear the choice', () => {
    expect(attuneRelic(progress(), 'echo_dagger')).toBeUndefined();
    const owned = progress({ vault: ['echo_dagger', 'sun_core'] });
    const attuned = attuneRelic(owned, 'sun_core')!;
    expect(attuned.attunedRelic).toBe('sun_core');
    expect(attuneRelic(owned, 'not_a_relic')).toBeUndefined();
    expect(attuneRelic(attuned, null)!.attunedRelic).toBeNull();
  });

  it('equips the attuned relic first so its slot is not taken by another', () => {
    const withAttune = createExpedition(
      11,
      [],
      0,
      progress({ vault: ['sun_core', 'echo_dagger'], attunedRelic: 'sun_core' })
    );
    expect(withAttune.player.equipment.trinket?.defId).toBe('sun_core');
    expect(withAttune.player.equipment.weapon?.defId).toBe('echo_dagger');

    const plain = createExpedition(11, [], 0, progress({ vault: ['sun_core', 'echo_dagger'] }));
    expect(plain.player.equipment.weapon?.defId).toBe('echo_dagger');
    expect(plain.player.equipment.trinket?.defId).toBe('sun_core');
  });

  it('banks cairn offerings up to the cap and only when affordable', () => {
    const poor = progress({ echoes: CAIRN_COST - 1 });
    expect(purchaseOffering(poor)).toBeUndefined();

    let paid = progress({ echoes: CAIRN_COST * (CAIRN_MAX + 2) });
    for (let i = 0; i < CAIRN_MAX; i++) paid = purchaseOffering(paid)!;
    expect(cairnOfferings(paid)).toBe(CAIRN_MAX);
    expect(cairnCost(paid)).toBeUndefined();
    expect(purchaseOffering(paid)).toBeUndefined();
    expect(paid.echoes).toBe(CAIRN_COST * 2);
  });

  it('starts the expedition with the banked shards and spends the offerings', () => {
    const banked = progress({ offerings: 2 });
    const run = createExpedition(5, [], 0, banked);
    expect(run.player.shards).toBe(2 * CAIRN_SHARDS);
    const spent = clearOfferings(banked);
    expect(cairnOfferings(spent)).toBe(0);
    expect(createExpedition(5, [], 0, spent).player.shards).toBe(0);
  });
});

describe('Aspect Shrine', () => {
  it('only accepts known aspects', () => {
    expect(chooseAspect(progress(), 'ember')?.aspect).toBe('ember');
    expect(chooseAspect(progress(), 'nope')).toBeUndefined();
    expect(aspectDef('nope').id).toBe('none');
  });

  it('applies the chosen aspect to a new expedition', () => {
    const base = createExpedition(3, [], 0, progress());
    const ember = createExpedition(3, [], 0, progress({ aspect: 'ember' }));
    const tide = createExpedition(3, [], 0, progress({ aspect: 'tide' }));
    const stone = createExpedition(3, [], 0, progress({ aspect: 'stone' }));
    expect(ember.player.stats.meleeDamage).toBeGreaterThan(base.player.stats.meleeDamage);
    expect(tide.player.stats.maxMana).toBeGreaterThan(base.player.stats.maxMana);
    expect(stone.player.stats.maxHealth).toBeGreaterThan(base.player.stats.maxHealth);
    expect(stone.player.stats.damageReduction).toBeGreaterThan(base.player.stats.damageReduction);
    // Health is filled to the aspect-adjusted maximum, not the base one.
    expect(stone.player.health).toBe(stone.player.stats.maxHealth);
  });
});

describe('The Reforge', () => {
  it('only reforges owned relics, up to three ranks, and charges echoes', () => {
    expect(reforgeCost(progress(), 'echo_dagger')).toBeUndefined();
    const owned = progress({ vault: ['echo_dagger'], echoes: 500 });
    expect(reforgeCost(owned, 'echo_dagger')).toBe(30);
    const rank1 = reforgeRelic(owned, 'echo_dagger')!;
    expect(relicRank(rank1, 'echo_dagger')).toBe(1);
    expect(rank1.echoes).toBe(470);
    expect(reforgeCost(rank1, 'echo_dagger')).toBe(60);
    const rank2 = reforgeRelic(rank1, 'echo_dagger')!;
    const rank3 = reforgeRelic(rank2, 'echo_dagger')!;
    expect(relicRank(rank3, 'echo_dagger')).toBe(3);
    expect(reforgeCost(rank3, 'echo_dagger')).toBeUndefined();
    expect(reforgeRelic(rank3, 'echo_dagger')).toBeUndefined();
  });

  it('refuses when the echo price is not met', () => {
    const poor = progress({ vault: ['echo_dagger'], echoes: 10 });
    expect(reforgeRelic(poor, 'echo_dagger')).toBeUndefined();
  });

  it('carries the rank into the expedition and scales the relic mods', () => {
    const run = createExpedition(
      7,
      [],
      0,
      progress({ vault: ['echo_dagger'], relicRanks: { echo_dagger: 2 } })
    );
    const weapon = run.player.equipment.weapon!;
    expect(weapon.defId).toBe('echo_dagger');
    expect(weapon.rank).toBe(2);
    expect(run.player.stats.meleeDamage).toBeGreaterThan(
      createExpedition(7, [], 0, progress({ vault: ['echo_dagger'] })).player.stats.meleeDamage
    );
  });
});

describe('aspect persistence', () => {
  it('keeps the aspect after a level-up recomputes stats', () => {
    const run = createExpedition(1, [], 0, progress({ aspect: 'stone' }));
    const withAspect = run.player.stats.maxHealth;
    run.pendingChoices.push({ source: 'level', options: ['vitality'] });
    applyChoice(run, 'vitality');
    expect(run.player.stats.maxHealth).toBe(withAspect + 20);
    expect(run.player.stats.damageReduction).toBeGreaterThan(0);
  });

  it('keeps the aspect when a saved run is restored', () => {
    const run = createExpedition(2, [], 0, progress({ aspect: 'ember' }));
    const before = { ...run.player.stats };
    const restored = restoreRun(JSON.parse(JSON.stringify(run)))!;
    expect(restored.player.stats.meleeDamage).toBe(before.meleeDamage);
    expect(restored.player.stats.critChance).toBeCloseTo(before.critChance);
    expect(restored.player.aspect).toBe('ember');
  });

  it('defaults restored runs without an aspect to unmarked', () => {
    const run = createExpedition(3, [], 0, progress());
    delete (run.player as { aspect?: string }).aspect;
    const restored = restoreRun(JSON.parse(JSON.stringify(run)))!;
    expect(restored.player.aspect).toBe('none');
  });
});
