import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('the Notice Board and the in-game quest UI', () => {
  it('builds a real board with accept, track and visit actions', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('export function noticeBoardScreen');
    expect(screens).toContain("'The Notice Board'");
    expect(screens).toContain('notice-note');
    expect(screens).toContain('onAccept');
    expect(screens).toContain('onVisit');
    expect(screens).toContain('Open the quest log');
    expect(screens).toContain('questChapterLabel');
  });

  it('opens the journal in-game with J and from a touch button', () => {
    const input = read('../src/input/Input.ts');
    expect(input).toContain("'quests'");
    expect(input).toContain("e.code === 'KeyJ'");
    const app = read('../src/app/App.ts');
    expect(app).toContain('showQuestOverlay');
    expect(app).toContain('showNoticeBoard');
    expect(app).toContain("action === 'quests'");
    const touch = read('../src/ui/TouchControls.ts');
    expect(touch).toContain("'Quests'");
    expect(touch).toContain("menu('quests')");
  });

  it('shows bonus tiers in the journal and styles the board notes', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('questBonus');
    expect(screens).toContain('quest-bonus');
    expect(screens).toContain('Bonus +');
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.quest-bonus {');
    expect(css).toContain('.notice-note {');
    expect(css).toContain('.notice-pin {');
    expect(css).toContain('.notice-actions {');
  });
});
