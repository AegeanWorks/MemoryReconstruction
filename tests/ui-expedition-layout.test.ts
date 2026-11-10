import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('expedition checkpoint list layout', () => {
  it('constrains checkpoint list max-height to fit cleanly within 720p viewports', () => {
    const listIndex = css.indexOf('.checkpoint-list {');
    expect(listIndex).toBeGreaterThanOrEqual(0);
    const closeIndex = css.indexOf('}', listIndex);
    const rule = css.slice(listIndex, closeIndex);
    expect(rule).toContain('max-height: min(45vh, 320px)');
  });
});
