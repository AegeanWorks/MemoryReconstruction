import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultMeta } from '../src/save/SaveStore';
import {
  NPCS,
  NPC_STORIES,
  QUESTS,
  QUEST_EPILOGUES,
  epilogueForNpc,
  nextQuestForNpc,
  questsForNpcList,
} from '../src/sim/quests';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('quest chapters', () => {
  it('gives every resident three chapters', () => {
    expect(QUESTS).toHaveLength(18);
    for (const npcId of Object.keys(NPCS)) {
      expect(questsForNpcList(npcId), npcId).toHaveLength(3);
    }
  });

  it('walks the chapters in order and stops once all are claimed', () => {
    const chapters = questsForNpcList('archivist');
    expect(nextQuestForNpc('archivist', [])?.id).toBe(chapters[0].id);
    expect(nextQuestForNpc('archivist', [chapters[0].id])?.id).toBe(chapters[1].id);
    expect(nextQuestForNpc('archivist', [chapters[0].id, chapters[1].id])?.id).toBe(
      chapters[2].id
    );
    expect(
      nextQuestForNpc('archivist', [chapters[0].id, chapters[1].id, chapters[2].id])
    ).toBeUndefined();
  });

  it('has one closing line per chapter and shows the latest claimed', () => {
    for (const quest of QUESTS) expect(QUEST_EPILOGUES[quest.id], quest.id).toBeTruthy();
    const chapters = questsForNpcList('smith');
    expect(epilogueForNpc('smith', [chapters[0].id])).toBe(QUEST_EPILOGUES[chapters[0].id]);
    expect(epilogueForNpc('smith', [chapters[0].id, chapters[1].id])).toBe(
      QUEST_EPILOGUES[chapters[1].id]
    );
    expect(epilogueForNpc('smith', [])).toBeUndefined();
  });

  it('adds a late story for every resident that mentions the new road', () => {
    for (const npcId of Object.keys(NPCS)) {
      expect(
        NPC_STORIES[npcId].some((story) => (story.minDepth ?? 0) >= 21),
        `${npcId} has no late story`
      ).toBe(true);
    }
  });
});

describe('quest tracking', () => {
  it('starts untracked in a fresh save', () => {
    expect(defaultMeta().trackedQuest).toBeNull();
  });

  it('wires Track/Untrack into the log and the HUD line', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('trackedQuest');
    expect(screens).toContain("'Track'");
    expect(screens).toContain("'Untrack'");
    expect(screens).toContain('quest-actions');
    const app = read('../src/app/App.ts');
    expect(app).toContain('questTrackerText');
    expect(app).toContain('hud.setTracker');
    const hud = read('../src/ui/Hud.ts');
    expect(hud).toContain('hud-tracker');
    expect(hud).toContain('setTracker');
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.hud-tracker {');
    expect(css).toContain('.quest-card.tracked {');
  });
});
