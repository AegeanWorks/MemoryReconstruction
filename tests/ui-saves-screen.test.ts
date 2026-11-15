import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_BYTES,
  exportFileName,
  savedAtText,
  slotHeadline,
} from '../src/ui/SavesScreen';
const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');
const summary = {
  slot: 2,
  empty: false,
  active: true,
  savedAt: '2026-11-15T10:00:00.000Z',
  echoes: 42,
  runs: 5,
  bestDepth: 3,
  restorations: 4,
  fragments: 7,
  hasRun: true,
};
describe('Saves screen text', () => {
  it('names the export file after the slot and the day', () => {
    expect(exportFileName(2, new Date('2026-11-15T10:00:00Z'))).toBe(
      'memory-reconstruction-slot2-2026-11-15.json'
    );
  });
  it('says when a slot was last saved, and admits when it does not know', () => {
    expect(savedAtText('2026-11-15T10:00:00.000Z')).toMatch(/2026/);
    expect(savedAtText('')).toBe('Saved before save slots existed');
  });
  it('sums a slot up in one line, and calls an empty slot empty', () => {
    expect(slotHeadline(summary)).toBe('42 echoes · 4 restorations · 5 expeditions · section 3');
    expect(slotHeadline({ ...summary, empty: true })).toBe('Empty slot');
  });
  it('refuses import files over a megabyte before reading them', () => {
    expect(MAX_IMPORT_BYTES).toBe(1_000_000);
    expect(read('../src/ui/SavesScreen.ts')).toContain('file.size > MAX_IMPORT_BYTES');
  });
});
describe('Saves wiring', () => {
  const app = read('../src/app/App.ts');
  const screens = read('../src/ui/Screens.ts');
  it('opens the Saves screen from the title', () => {
    expect(screens).toContain('opts.onSaves');
    expect(app).toContain('onSaves: () => this.click(() => this.showSaves())');
  });
  it('reloads the progress after switching, deleting or importing the active slot', () => {
    const saves = app.slice(app.indexOf('private showSaves('), app.indexOf('private showHub('));
    expect(saves).toContain('this.store.selectSlot(slot)');
    expect(saves.split('this.meta = this.store.loadMeta()').length - 1).toBeGreaterThanOrEqual(2);
  });
  it('confirms before an import overwrites a slot or a delete empties one', () => {
    const screen = read('../src/ui/SavesScreen.ts');
    expect(screen).toMatch(/confirmButton\(\s*'Delete'/);
    expect(screen).toContain("'Replace this slot?'");
  });
  it('shows a save indicator, and keeps a failed save on screen longer', () => {
    expect(app).toContain('this.store.onWrite = ');
    const indicator = read('../src/ui/saveIndicator.ts');
    expect(indicator).toContain('Could not save');
    const css = read('../src/ui/ui.css');
    const tail = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(tail).toMatch(/\.save-indicator\s*\{\s*transition:\s*none/);
  });
});
