import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('the hub advertises relic requests and the checkpoint bank', () => {
  it('renders a wanted-relic badge on each resident card', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('requestForNpc');
    expect(screens).toContain('relicRequestStatus');
    expect(screens).toContain('building-badges');
    expect(screens).toContain('Relic given');
    expect(screens).toContain('Wants ');
  });

  it('styles the badges without crowding the quest badge', () => {
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.building-badges {');
    expect(css).toMatch(/\.building-badges \.quest-badge \{[^}]*margin-top:\s*0/);
    expect(css).toContain('.quest-badge.relic {');
  });

  it('shows how much the checkpoint bank keeps while the bag is open', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('bankSummary');
    expect(screens).toContain('Checkpoint bank');
    expect(screens).toContain('at risk');
  });
});
