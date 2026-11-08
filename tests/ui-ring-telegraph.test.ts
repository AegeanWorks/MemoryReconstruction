import { describe, expect, it } from 'vitest';
import { ringTelegraphRadius } from '../src/view/telegraph';

describe('ring telegraph radius', () => {
  it('breathes with normalized windup progress, not raw seconds', () => {
    expect(ringTelegraphRadius(20, 0)).toBe(30);
    expect(ringTelegraphRadius(20, 0.5)).toBe(45);
    expect(ringTelegraphRadius(20, 1)).toBe(60);
  });

  it('clamps progress so a corrupt timer cannot shrink or overgrow the ring', () => {
    expect(ringTelegraphRadius(20, -2)).toBe(30);
    expect(ringTelegraphRadius(20, 2)).toBe(60);
  });
});
