import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, enemyDef } from '../../src/sim/content';
import { equipmentDef } from '../../src/sim/equipment';
import { FEATS } from '../../src/sim/feats';
import { NPCS, QUESTS, dailyBounty } from '../../src/sim/quests';
import { MODIFIER_DEFS } from '../../src/sim/run';

/** Date keys eight days apart from a fixed start, so the pools are exercised deterministically. */
function keys(count: number, from = '2026-01-01'): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10)
  );
}

describe('npc and quest references', () => {
  it('points every quest at a real NPC and gives every NPC at least one quest', () => {
    const npcIds = Object.keys(NPCS);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    for (const quest of QUESTS) {
      expect(npcIds, `${quest.id} npc`).toContain(quest.npcId);
      expect(
        QUESTS.some((entry) => entry.id === quest.id && entry.npcId === quest.npcId),
        `${quest.id} chapter`
      ).toBe(true);
    }
    for (const npcId of npcIds)
      expect(QUESTS.some((quest) => quest.npcId === npcId), `${npcId} quest`).toBe(true);
  });

  it('resolves every quest reward item', () => {
    const rewards = QUESTS.map((q) => q.rewardItem).filter((id): id is string => !!id);
    expect(rewards.length).toBeGreaterThan(0);
    for (const defId of rewards) expect(equipmentDef(defId).id).toBe(defId);
  });

  it('uses sensible quest targets and rewards', () => {
    for (const quest of QUESTS) {
      expect(quest.target, `${quest.id} target`).toBeGreaterThan(0);
      expect(quest.rewardEchoes, `${quest.id} reward`).toBeGreaterThan(0);
      expect(quest.name.length).toBeGreaterThan(0);
      expect(quest.text.length).toBeGreaterThan(0);
    }
  });
});

describe('daily bounty pool', () => {
  const week = keys(8).map((key) => dailyBounty(key));

  it('names eight distinct, real, non-boss enemies', () => {
    expect(new Set(week.map((b) => b.defId)).size).toBe(8);
    for (const bounty of week) {
      const def = enemyDef(bounty.defId);
      expect(def.archetype, `${bounty.defId} archetype`).not.toBe('boss');
      // The board's plural is derived from the data name; a rename must update the pool.
      expect(bounty.name).toBe(`${def.name}s`);
    }
  });

  it('only asks for enemies some floor can actually spawn', () => {
    const spawnable = new Set(FLOOR_PLANS.flatMap((plan) => [...plan.roster, plan.boss]));
    for (const bounty of week)
      expect(spawnable, `${bounty.defId} is not on any floor`).toContain(bounty.defId);
  });

  it('keeps the contract numbers and repeats on the eight-day cycle', () => {
    for (const bounty of week) {
      expect(bounty.target).toBe(12);
      expect(bounty.reward).toBe(250);
    }
    const again = keys(8, '2026-01-09').map((key) => dailyBounty(key));
    expect(again.map((b) => b.defId)).toEqual(week.map((b) => b.defId));
  });

  it('is stable for a given day', () => {
    expect(dailyBounty('2026-03-04')).toEqual(dailyBounty('2026-03-04'));
  });
});

describe('feat and modifier tables', () => {
  it('keeps feat ids unique with readable text', () => {
    expect(new Set(FEATS.map((f) => f.id)).size).toBe(FEATS.length);
    for (const feat of FEATS) {
      expect(feat.name.length).toBeGreaterThan(0);
      expect(feat.text.length).toBeGreaterThan(0);
    }
  });

  it('keeps modifier ids unique', () => {
    expect(new Set(MODIFIER_DEFS.map((m) => m.id)).size).toBe(MODIFIER_DEFS.length);
  });
});
