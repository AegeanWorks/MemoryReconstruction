import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { difficultyButtonClass } from '../src/ui/Screens';

const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');

function settingsBody(): string {
  const start = screens.indexOf('export function settingsScreen(');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = screens.indexOf('\nexport function ', start + 10);
  expect(end).toBeGreaterThan(start);
  return screens.slice(start, end);
}

describe('difficulty selection', () => {
  it('marks only the chosen difficulty as the primary button', () => {
    expect(difficultyButtonClass('normal', 'normal')).toBe('btn small primary');
    expect(difficultyButtonClass('normal', 'story')).toBe('btn small');
    expect(difficultyButtonClass('normal', 'nightmare')).toBe('btn small');
    expect(difficultyButtonClass('nightmare', 'nightmare')).toBe('btn small primary');
  });

  it('moves the highlight in place, because the screen is built once', () => {
    const body = settingsBody();
    expect(body).toContain('const difficultyButtons');
    expect(body).toContain('const syncDifficulty = (): void => {');
    expect(body).toContain('btn.className = difficultyButtonClass(current.difficulty, value)');
    // The click handler must sync the highlight as well as report the change.
    const click = body.slice(body.indexOf('const b = button('), body.indexOf('difficultyButtons.push'));
    const syncAt = click.indexOf('syncDifficulty();');
    const changeAt = click.indexOf('onChange({ ...current })');
    expect(syncAt).toBeGreaterThanOrEqual(0);
    expect(syncAt).toBeLessThan(changeAt);
  });

  it('exposes the selected option to assistive technology', () => {
    const body = settingsBody();
    expect(body).toContain("b.setAttribute('aria-pressed'");
    expect(body).toContain("btn.setAttribute('aria-pressed'");
  });
});
