import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CORE_MEMORIES,
  MEMORY_FRAGMENTS,
  fragmentHabitat,
  memoriesProgress,
} from '../src/sim/content';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('memory fragment habitats and progress', () => {
  it('names the biome a fragment is found in', () => {
    const ruins = MEMORY_FRAGMENTS.filter((fragment) => fragment.biome === 'ruins');
    expect(ruins.length).toBeGreaterThan(0);
    expect(fragmentHabitat(ruins[0].id)).toBe('Forgotten Ruins');
    const storm = MEMORY_FRAGMENTS.find((fragment) => fragment.biome === 'storm')!;
    expect(fragmentHabitat(storm.id)).toBe('Howling Spire');
  });

  it('gives every fragment a readable location and no unknown id a guess', () => {
    for (const fragment of MEMORY_FRAGMENTS) {
      const habitat = fragmentHabitat(fragment.id);
      expect(habitat, fragment.id).toBeTruthy();
      expect(habitat, fragment.id).not.toContain('undefined');
    }
    expect(fragmentHabitat('not_a_fragment')).toBeUndefined();
  });

  it('counts fragments and restored memories against the real totals', () => {
    const empty = memoriesProgress([]);
    expect(empty.fragments).toBe(0);
    expect(empty.totalFragments).toBe(MEMORY_FRAGMENTS.length);
    expect(empty.cores).toBe(0);
    expect(empty.totalCores).toBe(CORE_MEMORIES.length);

    const firstCore = CORE_MEMORIES[0];
    const missingOne = firstCore.fragments.slice(0, firstCore.fragments.length - 1);
    const partial = memoriesProgress(missingOne);
    expect(partial.fragments).toBe(missingOne.length);
    expect(partial.cores).toBe(0);

    const wholeCore = memoriesProgress(firstCore.fragments);
    expect(wholeCore.cores).toBe(1);

    const everything = memoriesProgress(MEMORY_FRAGMENTS.map((fragment) => fragment.id));
    expect(everything.fragments).toBe(everything.totalFragments);
    expect(everything.cores).toBe(everything.totalCores);
    expect(everything.complete).toBe(true);
  });

  it('ignores phantom fragment ids', () => {
    const progress = memoriesProgress(['fragment_001', 'not_a_fragment']);
    expect(progress.fragments).toBe(1);
    expect(progress.cores).toBe(0);
    expect(progress.complete).toBe(false);
  });

  it('wires the location hint and the progress line into the memories tab', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('fragmentHabitat');
    expect(screens).toContain('memoriesProgress');
    expect(screens).toContain('frag-location');
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.frag-location {');
  });
});
