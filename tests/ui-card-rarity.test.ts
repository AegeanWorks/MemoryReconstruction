import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('upgrade choice card rarity polish', () => {
  it('gives rare and epic number badges distinct tier styling', () => {
    expect(css).toContain('.card.rare .num');
    expect(css).toContain('.card.epic .num');
  });

  it('defines custom luminous header flares for rare and epic cards', () => {
    expect(css).toContain('.card.rare::before');
    expect(css).toContain('.card.epic::before');
  });

  it('gives epic cards an animated celestial emblem pulse', () => {
    expect(css).toContain('@keyframes epicEmblemPulse');
    expect(css).toMatch(/\.card\.epic\s+\.card-emblem\s*\{[^}]*animation:[^}]*epicEmblemPulse/);
  });
});
