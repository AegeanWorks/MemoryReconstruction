import { describe, expect, it } from 'vitest';
import { ATMOSPHERE, atmosphereFor, type AtmosphereLayer } from '../src/view/atmosphere';
import { BIOME_ART } from '../src/view/palette';

const TEXTURES = new Set(['spark', 'flake', 'petal', 'smoke', 'bubble']);
const MOTIONS = new Set(['rise', 'fall', 'drift', 'wander']);
const BLENDS = new Set(['add', 'normal']);

function expectRange(
  layer: AtmosphereLayer,
  key: 'size' | 'speed' | 'drift' | 'swayRate' | 'spin' | 'alpha' | 'life',
  label: string
): void {
  const [low, high] = layer[key];
  expect(Number.isFinite(low), `${label} low`).toBe(true);
  expect(Number.isFinite(high), `${label} high`).toBe(true);
  expect(low, `${label} order`).toBeLessThanOrEqual(high);
}

describe('biome atmosphere', () => {
  it('defines exactly one profile for every biome', () => {
    expect(Object.keys(ATMOSPHERE).sort()).toEqual(Object.keys(BIOME_ART).sort());
  });

  it('keeps every layer inside the presentation budget', () => {
    for (const [biome, profile] of Object.entries(ATMOSPHERE)) {
      const total = profile.layers.reduce((sum, layer) => sum + layer.count, 0);
      expect(total, `${biome} mote count`).toBeGreaterThanOrEqual(32);
      expect(total, `${biome} mote count`).toBeLessThanOrEqual(48);
      expect(profile.layers.length, `${biome} layer count`).toBeGreaterThan(0);

      for (const layer of profile.layers) {
        const label = `${biome}/${layer.texture}`;
        expect(TEXTURES.has(layer.texture), `${label} texture`).toBe(true);
        expect(MOTIONS.has(layer.motion), `${label} motion`).toBe(true);
        expect(BLENDS.has(layer.blend), `${label} blend`).toBe(true);
        expect(layer.count, `${label} count`).toBeGreaterThan(0);
        expect(layer.colors.length, `${label} colours`).toBeGreaterThan(0);
        for (const color of layer.colors) {
          expect(Number.isInteger(color), `${label} colour`).toBe(true);
          expect(color, `${label} colour`).toBeGreaterThanOrEqual(0);
          expect(color, `${label} colour`).toBeLessThanOrEqual(0xffffff);
        }
        for (const key of ['size', 'speed', 'drift', 'swayRate', 'spin', 'alpha', 'life'] as const)
          expectRange(layer, key, `${label} ${key}`);
        expect(layer.alpha[0], `${label} alpha`).toBeGreaterThanOrEqual(0);
        expect(layer.alpha[1], `${label} alpha`).toBeLessThanOrEqual(1);
        expect(layer.life[0], `${label} life`).toBeGreaterThan(0);
        expect(layer.sway, `${label} sway`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives the signature biomes their own motion', () => {
    expect(atmosphereFor('frost').layers[0].motion).toBe('fall');
    expect(atmosphereFor('ash').layers[0].motion).toBe('rise');
    expect(atmosphereFor('abyss').layers[0].texture).toBe('bubble');
    expect(atmosphereFor('bloom').layers[0].texture).toBe('petal');
    expect(atmosphereFor('mire').layers.some((layer) => layer.pulse)).toBe(true);
  });
});
