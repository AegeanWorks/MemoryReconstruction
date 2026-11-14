import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextOnboardingStep, ONBOARDING_STEPS } from '../../src/sim/run';

const hud = readFileSync(join(__dirname, '../../src/ui/Hud.ts'), 'utf8');
const css = readFileSync(join(__dirname, '../../src/ui/ui.css'), 'utf8');

/** Every checklist bit, plus a few partial combinations. */
const BITS = [0, 1, 2, 4, 8, 16, 32, 63];

describe('field manual follows the device', () => {
  it('keeps the keyboard and mouse wording for pointer devices', () => {
    expect(nextOnboardingStep(0)).toBe('Strike with LMB');
    expect(nextOnboardingStep(0, false)).toBe('Strike with LMB');
    expect(nextOnboardingStep(1)).toBe('Fire a bolt with RMB');
    expect(nextOnboardingStep(3)).toBe('Dash through danger with Space');
    expect(nextOnboardingStep(7)).toBe('Drink a flask with Q');
    expect(nextOnboardingStep(15)).toBe('Equip a relic with I');
    expect(nextOnboardingStep(31)).toBe('Clear a hostile room');
  });

  it('names an on-screen control on touch screens', () => {
    expect(nextOnboardingStep(0, true)).toBe('Strike with the right stick');
    expect(nextOnboardingStep(1, true)).toBe('Fire a bolt with the Bolt button');
    expect(nextOnboardingStep(3, true)).toBe('Dash through danger with the Dash button');
    expect(nextOnboardingStep(7, true)).toBe('Drink a flask with the Flask button');
    expect(nextOnboardingStep(15, true)).toBe('Equip a relic from the Relics button');
    expect(nextOnboardingStep(31, true)).toBe('Clear a hostile room');
  });

  it('never mentions a key or mouse button the device does not have', () => {
    for (const bit of BITS) {
      const label = nextOnboardingStep(bit, true) ?? '';
      for (const key of ['LMB', 'RMB', 'Space', ' Q', ' I']) expect(label).not.toContain(key);
    }
  });

  it('shows the same step index in both modes, and both finish together', () => {
    for (const bit of BITS) {
      const touch = nextOnboardingStep(bit, true);
      const pointer = nextOnboardingStep(bit);
      expect(touch === undefined).toBe(pointer === undefined);
    }
    expect(nextOnboardingStep(63, true)).toBeUndefined();
    expect(nextOnboardingStep(63, false)).toBeUndefined();
  });

  it('has exactly one touch label per step', () => {
    for (const [, pointerLabel, touchLabel] of ONBOARDING_STEPS) {
      expect(pointerLabel.length).toBeGreaterThan(0);
      expect(touchLabel.length).toBeGreaterThan(0);
    }
    expect(ONBOARDING_STEPS).toHaveLength(6);
  });

  it('reads the coarse-pointer media query in the HUD and passes it through', () => {
    expect(hud).toContain("matchMedia('(pointer: coarse)').matches");
    expect(hud).toContain('nextOnboardingStep(world.run.stats.onboarding, this.touch)');
  });

  it('re-shows the manual above the move stick, where the generic hint is hidden', () => {
    const start = css.indexOf('@media (pointer: coarse) {');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = css.slice(start, css.indexOf('@media (pointer: coarse) and (max-width: 560px)'));
    expect(block).toContain('.hint {\n    display: none;');
    expect(block).toContain('.hint.checklist {\n    display: block;');
    expect(block).toContain('left: calc(12px + var(--safe-left))');
    expect(block).toContain(
      'bottom: calc(var(--touch-bottom, 16px) + 122px + var(--safe-bottom))'
    );
    expect(block).toContain('max-width: min(260px, 34vw)');
  });
});
