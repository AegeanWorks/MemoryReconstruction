import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allEnemyIds, bestiaryDetail, enemyHabitats, guardianIds } from '../src/sim/content';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('bestiary habitats and detail', () => {
  it('names every section a species appears in, in depth order', () => {
    const echoes = enemyHabitats('memory_echo');
    expect(echoes.length).toBeGreaterThan(1);
    expect(echoes[0].section).toBe(1);
    expect(echoes.map((habitat) => habitat.section)).toEqual(
      [...echoes.map((habitat) => habitat.section)].sort((a, b) => a - b)
    );
    expect(echoes.every((habitat) => habitat.biome.length > 0)).toBe(true);
    expect(echoes.every((habitat) => habitat.section >= 1)).toBe(true);
  });

  it('marks guardians with their own final section', () => {
    const warden = enemyHabitats('reliquary_warden');
    expect(warden).toHaveLength(1);
    expect(warden[0].guardian).toBe(true);
    expect(warden[0].section).toBe(22);
    expect(warden[0].title).toBe('The Gilded Reliquary');
    for (const id of guardianIds()) expect(enemyHabitats(id).length).toBeGreaterThan(0);
  });

  it('returns nothing for an id the floor plans do not use', () => {
    expect(enemyHabitats('not_a_real_enemy')).toEqual([]);
    expect(bestiaryDetail('not_a_real_enemy', true, 0)).toBeUndefined();
  });

  it('hides stats for a sealed species and reveals them once recorded', () => {
    const sealed = bestiaryDetail('reliquary_warden', false, 0)!;
    expect(sealed.seen).toBe(false);
    expect(sealed.stats).toBeUndefined();
    expect(sealed.habitats.length).toBe(1);
    const seen = bestiaryDetail('reliquary_warden', true, 3)!;
    expect(seen.seen).toBe(true);
    expect(seen.kills).toBe(3);
    expect(seen.stats?.health).toBeGreaterThan(0);
    expect(seen.stats?.damage).toBeGreaterThan(0);
    expect(seen.stats?.xp).toBeGreaterThan(0);
    expect(seen.description.length).toBeGreaterThan(0);
  });

  it('covers every species with at least one habitat', () => {
    const missing = allEnemyIds().filter((id) => enemyHabitats(id).length === 0);
    expect(missing).toEqual([]);
  });

  it('wires the detail panel and the open action', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('bestiaryDetail');
    expect(screens).toContain('beast-detail');
    expect(screens).toContain('Found in');
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.beast-detail {');
    expect(css).toContain('.beast.open {');
  });
});
