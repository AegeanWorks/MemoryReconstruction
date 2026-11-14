import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');

function block(start: string, end: string): string {
  const from = screens.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThanOrEqual(0);
  const to = screens.indexOf(end, from + start.length);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return screens.slice(from, to);
}

describe('screens are named modal dialogs', () => {
  it('marks every screen as a dialog and labels it from its heading or title', () => {
    const announce = block('private announce(', '  close(): void {');
    expect(announce).toContain("el.setAttribute('role', 'dialog')");
    expect(announce).toContain("el.setAttribute('aria-modal', 'true')");
    expect(announce).toContain("el.querySelector('.heading')");
    expect(announce).toContain("el.querySelector('.title')");
    expect(announce).toContain("el.setAttribute('aria-label', label)");
    expect(announce).toContain("?? 'Memory Reconstruction'");
  });

  it('labels the title screen from its title text, since it has no heading', () => {
    expect(screens).toContain("h('div', { class: 'title' }, 'Memory Reconstruction')");
  });
});
