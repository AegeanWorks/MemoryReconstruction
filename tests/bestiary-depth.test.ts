import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  allEnemyIds,
  bestiaryEntries,
  bestiaryProgress,
  filterBestiary,
  guardianIds,
} from '../src/sim/content';
import { defaultMeta } from '../src/save/SaveStore';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('bestiary depth', () => {
  it('carries the lifetime kill count into every entry', () => {
    const entries = bestiaryEntries(['memory_echo'], { memory_echo: 7, gutter_runner: 0 });
    expect(entries.find((entry) => entry.id === 'memory_echo')!.kills).toBe(7);
    expect(entries.find((entry) => entry.id === 'gutter_runner')!.kills).toBe(0);
    expect(entries.every((entry) => entry.kills >= 0)).toBe(true);
    expect(bestiaryEntries([]).every((entry) => entry.kills === 0)).toBe(true);
  });

  it('reports recorded, total and completion', () => {
    expect(bestiaryProgress([])).toEqual({
      recorded: 0,
      total: allEnemyIds().length,
      complete: false,
    });
    const partial = bestiaryProgress(['memory_echo', 'not_real']);
    expect(partial.recorded).toBe(1);
    expect(partial.complete).toBe(false);
    const full = bestiaryProgress(allEnemyIds());
    expect(full.complete).toBe(true);
    expect(full.recorded).toBe(full.total);
  });

  it('filters the codex by record state and rank', () => {
    const entries = bestiaryEntries(['memory_echo', 'reliquary_warden']);
    expect(filterBestiary(entries, 'all')).toHaveLength(entries.length);
    expect(filterBestiary(entries, 'seen').map((entry) => entry.id).sort()).toEqual([
      'memory_echo',
      'reliquary_warden',
    ]);
    const sealed = filterBestiary(entries, 'sealed');
    expect(sealed.every((entry) => !entry.seen)).toBe(true);
    expect(sealed).toHaveLength(entries.length - 2);
    const guardians = filterBestiary(entries, 'guardians');
    expect(guardians.every((entry) => entry.isBoss)).toBe(true);
    expect(guardians).toHaveLength(guardianIds().length);
    expect(filterBestiary(entries, 'guardians').every((entry) => entry.isBoss)).toBe(true);
  });

  it('defaults the counters and the one-time codex reward for old saves', () => {
    const meta = defaultMeta();
    expect(meta.bestiaryKills).toEqual({});
    expect(meta.codexReward).toBe(false);
  });

  it('wires kill counting, the codex reward and the filter bar', () => {
    const app = read('../src/app/App.ts');
    expect(app).toContain('bestiaryKills');
    expect(app).toContain('codexReward');
    expect(app).toContain('bestiaryProgress');
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('filterBestiary');
    for (const label of ['All', 'Recorded', 'Sealed', 'Guardians']) {
      expect(screens).toContain(`'${label}'`);
    }
    expect(screens).toContain('Defeated');
    expect(screens).toContain('beast-kills');
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.beast-grid {');
    expect(css).toContain('.beast-kills {');
    expect(css).toContain('.codex-complete {');
  });
});
