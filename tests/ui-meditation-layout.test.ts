import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');
const app = readFileSync(join(__dirname, '../src/app/App.ts'), 'utf8');
function body(start: string, end: string): string {
  const from = screens.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThanOrEqual(0);
  const to = screens.indexOf(end, from + start.length);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return screens.slice(from, to);
}
const meditation = body('export function meditationScreen(', 'export function questLogScreen(');
describe('the Meditation Stone matches the other place screens', () => {
  it('uses the place-screen layout with the station art', () => {
    expect(meditation).toContain("class: 'screen place-screen'");
    expect(meditation).toContain("class: 'place-art'");
    expect(meditation).toContain('sprites/props/station_meditation.png');
    expect(meditation).toContain("class: 'place-body'");
  });
  it('shows the echo balance', () => {
    expect(meditation).toContain('${meta.echoes} echoes');
  });
  it('says why a boon cannot be bought', () => {
    expect(meditation).toContain('MEDITATION_COST - meta.echoes');
    expect(meditation).toContain("class: 'place-note'");
  });
  it('keeps the stable action keys the focus restore relies on', () => {
    expect(meditation).toContain('buy.dataset.action = `boon:${option.id}`');
  });
  it('shares one cost constant between the screen and the purchase', () => {
    expect(screens).toContain('export const MEDITATION_COST = 20');
    expect(app).toContain('MEDITATION_COST');
    expect(app).not.toMatch(/meta\.echoes < 20\)/);
  });
});
