import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('the quest log reads like an RPG journal', () => {
  it('has a header, filter tabs and grouped sections', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain("'Quest Log'");
    expect(screens).toContain('quest-tabs');
    expect(screens).toContain('quest-tab');
    expect(screens).toContain("'All'");
    expect(screens).toContain("'Active'");
    expect(screens).toContain("'Ready'");
    expect(screens).toContain("'Completed'");
    expect(screens).toContain('data-section');
    expect(screens).toContain('quest-section');
  });

  it('shows a giver portrait, a progress bar and reward chips per quest', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('quest-avatar');
    expect(screens).toContain('npc_${quest.npcId}.png');
    expect(screens).toContain('quest-progress');
    expect(screens).toContain('quest-bar');
    expect(screens).toContain('quest-numbers');
    expect(screens).toContain('reward ${quest.rewardEchoes} echoes');
    expect(screens).toContain('Ready to claim');
  });

  it('keeps the daily mark embedded with its own claim action', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('Daily mark');
    expect(screens).toContain('onClaimDaily');
  });

  it('styles the journal, the bars and the hidden section rule', () => {
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.quest-tabs {');
    expect(css).toContain('.quest-card {');
    expect(css).toContain('.quest-section.hidden {');
    expect(css).toMatch(/\.quest-bar > span \{[^}]*background:/);
    expect(css).toContain('.quest-avatar img');
  });
});
