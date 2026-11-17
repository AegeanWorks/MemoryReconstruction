import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { arrangement, beatSeconds, isBattleMode } from '../src/audio/arrangement';
import { musicBiomes } from '../src/audio/music';
import type { BiomeId } from '../src/sim/content';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');
const biomes = musicBiomes() as BiomeId[];

describe('procedural arrangement', () => {
  it('covers every biome in both modes', () => {
    expect(biomes.length).toBe(16);
    for (const biome of biomes) {
      expect(arrangement(biome, 'ambient'), biome).toBeDefined();
      expect(arrangement(biome, 'battle'), biome).toBeDefined();
    }
  });

  it('makes battle a different piece, not a louder pad', () => {
    for (const biome of biomes) {
      const calm = arrangement(biome, 'ambient');
      const fight = arrangement(biome, 'battle');
      // Calm has no rhythm at all; battle always does.
      expect(calm.hits, biome).toHaveLength(0);
      expect(calm.drive, biome).toBe(0);
      expect(fight.hits.length, biome).toBeGreaterThan(0);
      expect(fight.drive, biome).toBeGreaterThan(0.25);
      // Battle is faster and carries a bass figure the calm piece lacks.
      expect(fight.tempo, biome).toBeGreaterThan(calm.tempo);
      expect(fight.bass.some((degree) => degree >= 0), biome).toBe(true);
      expect(calm.bass.every((degree) => degree < 0), biome).toBe(true);
    }
  });

  it('gives each biome its own battle figure', () => {
    const signatures = new Set(
      biomes.map((biome) => {
        const spec = arrangement(biome, 'battle');
        return `${spec.tempo}|${spec.bass.join(',')}|${spec.hits.join(',')}`;
      })
    );
    expect(signatures.size).toBe(biomes.length);
  });

  it('keeps tempos inside a musical range', () => {
    for (const biome of biomes) {
      for (const mode of ['ambient', 'battle'] as const) {
        const spec = arrangement(biome, mode);
        expect(spec.tempo, `${biome} ${mode}`).toBeGreaterThanOrEqual(40);
        expect(spec.tempo, `${biome} ${mode}`).toBeLessThanOrEqual(160);
        expect(beatSeconds(spec)).toBeGreaterThan(0.3);
        expect(beatSeconds(spec)).toBeLessThan(1.5);
      }
    }
  });

  it('writes percussion inside the four-beat bar', () => {
    for (const biome of biomes) {
      for (const hit of arrangement(biome, 'battle').hits) {
        expect(hit).toBeGreaterThanOrEqual(0);
        expect(hit).toBeLessThan(4);
      }
    }
  });

  it('maps the tense flag to battle', () => {
    expect(isBattleMode(true)).toBe('battle');
    expect(isBattleMode(false)).toBe('ambient');
  });

  it('is what the sound layer actually plays', () => {
    const sound = read('../src/audio/Sound.ts');
    expect(sound).toContain("from './arrangement'");
    expect(sound).toContain('arrangement(biome, isBattleMode(tense))');
    expect(sound).toContain('startRhythm');
    expect(sound).toContain('rhythmHit');
  });
});
