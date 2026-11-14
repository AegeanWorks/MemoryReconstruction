import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');
const overlay = readFileSync(join(__dirname, '../src/ui/TouchControls.ts'), 'utf8');
const app = readFileSync(join(__dirname, '../src/app/App.ts'), 'utf8');

function ruleBody(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

describe('touch utility rail', () => {
  it('offers the relic bag, map and pause menu beside the sticks', () => {
    expect(overlay).toContain("class: 'touch-utility'");
    for (const label of ['Relics', 'Map', 'Menu']) expect(overlay).toContain(`'${label}'`);
    expect(overlay).toContain("menu('inventory')");
    expect(overlay).toContain("menu('map')");
    expect(overlay).toContain("menu('pause')");
  });

  it('drops a held stick or latch before a panel opens', () => {
    const reset = overlay.indexOf('touch.reset();');
    const open = overlay.indexOf('onMenu(action);');
    expect(reset).toBeGreaterThanOrEqual(0);
    expect(open).toBeGreaterThan(reset);
  });

  it('is part of the coarse-pointer overlay, so fine pointers never see it', () => {
    expect(overlay).toContain('utility, move, aim, buttons');
    expect(ruleBody('.touch-controls')).toContain('display: none');
  });

  it('places the rail top-left with touch-sized buttons', () => {
    const rail = ruleBody('.touch-utility');
    expect(rail).toContain('position: absolute');
    expect(rail).toContain('left: calc(12px + var(--safe-left))');
    expect(rail).toContain('top: calc(12px + var(--safe-top))');
    const util = ruleBody('.touch-btn.util');
    expect(util).toContain('width: 44px');
    expect(util).toContain('height: 44px');
  });

  it('drops below the left-aligned floor and objective pills in portrait', () => {
    const start = css.indexOf('@media (pointer: coarse) and (max-width: 560px)');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('.touch-btn {', start)));
    expect(block).toContain('.touch-utility {');
    expect(block).toContain('top: calc(68px + var(--safe-top))');
  });

  it('wires the rail to the app menu handler', () => {
    expect(app).toContain('createTouchControls(');
    expect(app).toContain('(action) => this.onMenu(action)');
  });
});
