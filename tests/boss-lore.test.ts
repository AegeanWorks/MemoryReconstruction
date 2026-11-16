import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enemyDef } from '../src/sim/content';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('guardian lore', () => {
  it('carries a field-guide line for every enemy and the new guardians', () => {
    expect(enemyDef('memory_echo').description.length).toBeGreaterThan(0);
    expect(enemyDef('reliquary_warden', true).description).toMatch(/gilded/i);
    expect(enemyDef('salt_orchard_hydra', true).description).toMatch(/orchard/i);
  });

  it('shows the guardian line under the boss bar', () => {
    const hud = read('../src/ui/Hud.ts');
    expect(hud).toContain('boss-lore');
    expect(hud).toContain('boss.def.description');
    expect(hud).toContain('syncTracker');
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.boss-lore {');
  });
});
