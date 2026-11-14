import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('controls hint stays clear of the vitals panel on tablets', () => {
  const start = css.indexOf('/* Tablet hint:');
  const block = css.slice(start, css.indexOf('\n}\n', start));

  it('caps the hint width to the space left of the vitals panel', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('@media (min-width: 561px) and (max-width: 1120px)');
    expect(block).toContain('max-width: max(120px, calc(50vw - 154px))');
  });

  it('lifts the field-manual checklist above the wrapped three-line hint', () => {
    expect(block).toContain('.hint.checklist');
    expect(block).toContain('bottom: 104px');
  });
});
