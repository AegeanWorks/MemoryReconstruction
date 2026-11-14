import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');
const grid = read('../src/ui/InventoryGrid.ts');
const css = read('../src/ui/ui.css');
describe('the paper doll wears what the wanderer wears', () => {
  it('recolours the doll sheet with the same armor look as the game', () => {
    expect(grid).toContain("from '../view/gearLook'");
    expect(grid).toContain('gearLooks(player.equipment)');
    expect(grid).toContain('recolorSheetUrl(');
  });
  it('shows the worn trinket as a glow in its own colour', () => {
    expect(grid).toContain("class: 'doll-orb'");
    expect(grid).toMatch(/doll-orb[\s\S]*looks\.trinket\.color/);
  });
  it('re-colours with the shared pixel rules, not a second copy of them', () => {
    const art = read('../src/ui/dollArt.ts');
    expect(art).toContain('recolorPixels(');
    expect(art).toContain('new Map<string, Promise<string>>()');
  });
  it('stills the orb orbit under reduced motion', () => {
    const tail = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(tail).toMatch(/\.doll-orb\s*\{\s*animation:\s*none/);
  });
});
