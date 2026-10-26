import { describe, expect, it } from 'vitest';
import {
  RESTORATIONS,
  TOTAL_RESTORATION_LEVELS,
  checkpointDepths,
  checkpointForDepth,
  createExpedition,
  echoesEarned,
  nextRestorationCost,
  purchaseRestoration,
  restorationLevel,
  restoredLevels,
  sectionNumber,
  type SanctuaryProgress,
} from '../src/sim/hub';
import { createRun } from '../src/sim/run';

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
