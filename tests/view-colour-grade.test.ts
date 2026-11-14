import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BIOME_ART, gradeTint } from '../src/view/palette';

const renderer = readFileSync(join(__dirname, '../src/view/Renderer.ts'), 'utf8');

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe('per-biome colour grade', () => {
  it('derives a near-white multiply tint for every biome', () => {
    for (const biome of Object.keys(BIOME_ART) as Array<keyof typeof BIOME_ART>) {
      const [r, g, b] = channels(gradeTint(biome));
      expect(Math.min(r, g, b), biome).toBeGreaterThanOrEqual(200);
      expect(Math.max(r, g, b), biome).toBeLessThanOrEqual(255);
    }
  });

  it('keeps biome identity: warm ruins lean red, cold abyss leans blue', () => {
    const [rr, , rb] = channels(gradeTint('ruins'));
    expect(rr).toBeGreaterThan(rb);
    const [cr, , cb] = channels(gradeTint('abyss'));
    expect(cb).toBeGreaterThan(cr);
  });

  // A full-screen multiply layer cost about 11-15ms a frame under software rendering (measured by
  // toggling it), so the grade is a tint on the camera container: no extra pass, and the vignette and
  // hurt flash, which sit outside the camera, stay ungraded.
  it('grades the world with a tint on the camera container, not a full-screen layer', () => {
    expect(renderer).toContain('this.camera.tint = gradeTint(biome)');
    expect(renderer).not.toContain("blendMode = 'multiply'");
    expect(renderer).not.toContain('private readonly grade');
  });
});
