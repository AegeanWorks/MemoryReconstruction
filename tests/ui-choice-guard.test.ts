import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { choiceArmed, deliberateClick } from '../src/ui/choiceGuard';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('level-up cards cannot be taken by a swing click', () => {
  it('is not armed during the first half-second of the screen', () => {
    for (const t of [0, 160, 319, 500])
      expect(choiceArmed(1000 + t, 1000, 0), `${t}ms`).toBe(false);
  });

  it('is not armed when the pointer has not moved since the screen opened', () => {
    // The player was clicking the same spot to attack; the card under the
    // cursor must not take the level just because an attack click landed.
    expect(choiceArmed(1700, 1000, 0)).toBe(false);
    expect(choiceArmed(2400, 1000, 3)).toBe(false);
  });

  it('arms once the pointer travels to a card deliberately', () => {
    expect(choiceArmed(1600, 1000, 24)).toBe(true);
  });

  it('eventually accepts a stationary click, so a resting cursor still works', () => {
    expect(choiceArmed(2600, 1000, 0)).toBe(true);
  });

  it('ignores double and triple click details', () => {
    expect(deliberateClick(1)).toBe(true);
    // Programmatic clicks (gamepad confirm, keyboard) report 0.
    expect(deliberateClick(0)).toBe(true);
    expect(deliberateClick(2)).toBe(false);
    expect(deliberateClick(3)).toBe(false);
  });
});

describe('the choice screen uses the guard', () => {
  it('wires pointer travel, the arming rule and the double-click rule', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('choiceArmed');
    expect(screens).toContain('deliberateClick');
    expect(screens).toContain('pointerTravel');
  });
});
