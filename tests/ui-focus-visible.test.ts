import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');
const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('keyboard focus visibility', () => {
  it('gives every button, card and gear row an explicit focus ring', () => {
    expect(css).toMatch(
      /\.btn:focus-visible,\s*\.card:focus-visible,\s*\.gear-row\.clickable:focus-visible \{[^}]*outline: 2px solid var\(--cyan\)/s
    );
  });

  it('gives the sliders and checkboxes the same ring instead of the near-black UA one', () => {
    expect(css).toMatch(
      /\.setting input\[type='range'\]:focus-visible,\s*\.setting input\[type='checkbox'\]:focus-visible \{[^}]*outline: 2px solid var\(--cyan\)[^}]*outline-offset: 3px/s
    );
  });

  it('starts a screen on its first control, inputs included, so Settings begins at the sliders', () => {
    expect(screens).toContain("el.querySelector<HTMLElement>('button, .card, input')?.focus");
  });
});
