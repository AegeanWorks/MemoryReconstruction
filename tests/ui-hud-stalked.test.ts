import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('HUD stalked chip', () => {
  it('hides the chip when the world is not stalked', () => {
    const rule = css.match(/\.chip\.stalked\.hidden\s*\{([^}]*)\}/);
    expect(rule, 'missing .chip.stalked.hidden rule').not.toBeNull();
    expect(rule?.[1]).toMatch(/display:\s*none/);
  });
});
