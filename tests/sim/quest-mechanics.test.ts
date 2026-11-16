import { describe, expect, it } from 'vitest';
import { defaultMeta, recordRun } from '../../src/save/SaveStore';
import { NO_INPUT } from '../../src/sim/entities';
import {
  NPCS,
  QUESTS,
  applyQuestClaim,
  questBonus,
  questBonusReached,
  questBoardEntries,
  questChapterLabel,
  questProgress,
  questRawProgress,
  questSnapshot,
  questsForNpcList,
  type QuestKind,
  type QuestSnapshot,
} from '../../src/sim/quests';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const snap = (over: Partial<QuestSnapshot> = {}): QuestSnapshot => ({
  fragments: 0,
  kills: 0,
  restored: 0,
  depth: 0,
  bosses: 0,
  elites: 0,
  relics: 0,
  trust: 0,
  ...over,
});

const questOfKind = (kind: QuestKind) => QUESTS.find((quest) => quest.kind === kind)!;

describe('quest mechanics', () => {
  it('reads elite, relic and trust objectives from the snapshot', () => {
    const s = snap({ elites: 7, relics: 11, trust: 5 });
    const relicsQuest = { ...questOfKind('fragments'), kind: 'relics' as const };
    for (const [quest, value] of [
      [questOfKind('elites'), 7],
      [relicsQuest, 11],
      [questOfKind('trust'), 5],
    ] as const) {
      expect(questRawProgress(quest, s), quest.kind).toBe(value);
      expect(questProgress(quest, s), quest.kind).toBe(Math.min(value, quest.target));
    }
  });

  it('builds the new fields from the meta-shaped source', () => {
    const s = questSnapshot(
      ['a'],
      3,
      {
        echoes: 0,
        restorations: {},
        checkpoint: 0,
        vault: ['x', 'x', 'y'],
        trust: { archivist: 3, smith: 2 },
        eliteKills: 9,
      },
      4,
      2
    );
    expect(s.elites).toBe(9);
    expect(s.relics).toBe(2);
    expect(s.trust).toBe(5);
    expect(s.depth).toBe(4);
  });

  it('offers a bonus tier 20% past the target, capped where the game ends', () => {
    const kills = questOfKind('kills');
    const bonus = questBonus(kills)!;
    expect(bonus.target).toBe(Math.ceil(kills.target * 1.2));
    expect(bonus.echoes).toBe(Math.round(kills.rewardEchoes * 0.4));
    expect(questBonusReached(kills, snap({ kills: bonus.target }))).toBe(true);
    expect(questBonusReached(kills, snap({ kills: bonus.target - 1 }))).toBe(false);

    const depth = QUESTS.find((quest) => quest.id === 'keepers_gate')!;
    expect(questBonus(depth)!.target).toBe(24); // capped at FINAL_DEPTH
    const garden = QUESTS.find((quest) => quest.id === 'whole_garden')!;
    expect(questBonus(garden)!.target).toBe(12); // capped at total restorations
  });

  it('labels chapters in order', () => {
    expect(questChapterLabel(QUESTS.find((quest) => quest.id === 'names')!)).toBe(
      'Chapter 1 of 3'
    );
    expect(questChapterLabel(QUESTS.find((quest) => quest.id === 'index_complete')!)).toBe(
      'Chapter 3 of 3'
    );
  });

  it('posts one notice per resident and follows acceptance', () => {
    const meta = defaultMeta();
    const s = snap();
    const entries = questBoardEntries(meta, s);
    expect(entries).toHaveLength(Object.keys(NPCS).length);
    const smith = entries.find((entry) => entry.npcId === 'smith')!;
    expect(smith.accepted).toBe(false);
    const claimed = { ...meta, quests: { ...meta.quests, claimed: questsForNpcList('smith').map((q) => q.id) } };
    expect(
      questBoardEntries(claimed, s).some((entry) => entry.npcId === 'smith')
    ).toBe(false);
    const accepted = {
      ...meta,
      quests: { ...meta.quests, accepted: [smith.quest.id] },
    };
    const after = questBoardEntries(accepted, snap({ kills: smith.quest.target })).find(
      (entry) => entry.npcId === 'smith'
    )!;
    expect(after.accepted).toBe(true);
    expect(after.ready).toBe(true);
  });

  it('pays the bonus into the claim', () => {
    const meta = defaultMeta();
    const quest = questOfKind('kills');
    const before = meta.echoes;
    const settled = applyQuestClaim(meta, 'smith', quest, Date.now(), 40);
    expect(settled.bonus).toBe(40);
    expect(settled.echoes).toBeGreaterThanOrEqual(before + quest.rewardEchoes + 40);
  });

  it('counts elite kills and carries them into the meta', () => {
    const run = createRun(5, []);
    const world = new World(run);
    const enemy = world.spawnEnemy('memory_echo', 100, 100, 0);
    enemy.state = 'chase';
    enemy.elite = true;
    world.damageEnemy(enemy, 99999, 'melee', false, 0);
    expect(run.stats.eliteKills).toBe(1);
    expect(recordRun(defaultMeta(), run, false).eliteKills).toBe(1);
  });
});
