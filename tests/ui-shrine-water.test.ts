import { describe, expect, it } from 'vitest';
import { hasWaterEffect } from '../src/view/propFx';

/**
 * The shrine got its own gabled sprite in commit 1334604, but the fountain's
 * water pool was left behind. Water belongs to fountains and the wellspring;
 * the wayside shrine burns a memory flame instead.
 */
describe('interactable water effects', () => {
  it('keeps water on fountains and wellsprings, not on shrines', () => {
    expect(hasWaterEffect('fountain')).toBe(true);
    expect(hasWaterEffect('structure', 'wellspring')).toBe(true);
    expect(hasWaterEffect('shrine')).toBe(false);
    expect(hasWaterEffect('chest')).toBe(false);
  });
});
