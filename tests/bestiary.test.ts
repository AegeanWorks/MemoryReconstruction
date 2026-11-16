import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allEnemyIds, bestiaryEntries, guardianIds } from '../src/sim/content';
import { defaultMeta } from '../src/save/SaveStore';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('bestiary codex', () => {
  it('lists every enemy exactly once, regular before guardians', () => {
    const entries = bestiaryEntries([]);
    expect(entries).toHaveLength(allEnemyIds().length);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    const firstGuardian = entries.findIndex((entry) => entry.isBoss);
    expect(firstGuardian).toBeGreaterThan(0);
    expect(entries.slice(firstGuardian).every((entry) => entry.isBoss)).toBe(true);
    expect(entries.slice(0, firstGuardian).every((entry) => !entry.isBoss)).toBe(true);
  });

  it('marks only recorded species as seen and reveals their field notes', () => {
    const entries = bestiaryEntries(['memory_echo', 'reliquary_warden']);
    const echo = entries.find((entry) => entry.id === 'memory_echo')!;
    const warden = entries.find((entry) => entry.id === 'reliquary_warden')!;
    expect(echo.seen).toBe(true);
    expect(echo.description.length).toBeGreaterThan(0);
    expect(warden.seen).toBe(true);
    expect(warden.isBoss).toBe(true);
    expect(entries.filter((entry) => entry.seen)).toHaveLength(2);
    expect(entries.find((entry) => entry.id === 'gutter_runner')!.seen).toBe(false);
  });

  it('knows the guardians from the floor plans, including the new ones', () => {
    const guardians = guardianIds();
    for (const id of [
      'keeper',
      'first_memory',
      'reliquary_warden',
      'salt_orchard_hydra',
      'mirror_self',
    ]) {
      expect(guardians, id).toContain(id);
    }
    expect(guardians).not.toContain('memory_echo');
  });

  it('starts with an empty record and ignores phantom ids in the list', () => {
    expect(defaultMeta().bestiary).toEqual([]);
    const entries = bestiaryEntries(['not_a_real_enemy']);
    expect(entries.every((entry) => !entry.seen)).toBe(true);
  });

  it('wires the codex tab and the first-kill record', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('bestiaryEntries');
    expect(screens).toContain("'Bestiary'");
    expect(screens).toContain('bestiary-panel');
    expect(screens).toContain("class: `beast");
    const app = read('../src/app/App.ts');
    expect(app).toContain('bestiary');
    expect(app).toContain('Bestiary ·');
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.codex-tabs {');
    expect(css).toContain('.bestiary-panel {');
    expect(css).toContain('.beast.locked {');
  });
});
