import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SANCTUARY_BUILDINGS } from '../src/sim/sanctuary';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('sanctuary residents speak in full', () => {
  it('keeps every building description to one short sentence so it fits whole', () => {
    for (const building of SANCTUARY_BUILDINGS) {
      expect(building.blurb.length, building.id).toBeLessThanOrEqual(96);
      expect(building.blurb.endsWith('.'), building.id).toBe(true);
    }
  });

  it('no longer clips a description behind an ellipsis', () => {
    const css = read('../src/ui/ui.css');
    expect(css).not.toContain('-webkit-line-clamp');
    expect(css).not.toContain('-webkit-box-orient');
    const start = css.indexOf('.building-blurb {');
    const blurb = css.slice(start, start + 320);
    expect(blurb).not.toContain('overflow: hidden');
  });

  it('keeps the description visible on short screens', () => {
    const css = read('../src/ui/ui.css');
    const compactStart = css.indexOf('@media (max-height: 820px)');
    expect(compactStart).toBeGreaterThanOrEqual(0);
    const compact = css.slice(compactStart, compactStart + 4000);
    expect(compact).not.toContain('.building-blurb');
  });
});

describe('a resident’s page offers more than a task', () => {
  it('stacks trust and tribute on their own rows', () => {
    const css = read('../src/ui/ui.css');
    const titlesStart = css.indexOf('.dialogue-titles {');
    const titles = css.slice(titlesStart, titlesStart + 400);
    expect(titles).toMatch(/display:\s*flex/);
    expect(titles).toMatch(/flex-direction:\s*column/);
    expect(titles).toMatch(/gap:\s*\d+px/);
    const actionsStart = css.indexOf('.dialogue-actions {');
    const actions = css.slice(actionsStart, actionsStart + 300);
    expect(actions).toMatch(/display:\s*flex/);
    expect(actions).toMatch(/flex-direction:\s*column/);
  });

  it('wires a relic request and a road hint into the dialogue', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('wantedRelic');
    expect(screens).toContain('onGiveRelic');
    expect(screens).toContain('Ask about the road');
    expect(screens).toContain('dialogue-hint');
    const app = read('../src/app/App.ts');
    expect(app).toContain('applyRelicRequest');
    expect(app).toContain('onGiveRelic');
    expect(app).toContain('ROAD_HINTS');
  });
});
