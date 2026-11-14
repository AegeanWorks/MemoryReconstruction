import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('upgrade choice on short landscape screens', () => {
  const start = css.indexOf('/* Short choice:');
  const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('\n}\n', start) + 1));

  it('compacts the cards so the reroll button and hint stay on screen', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('@media (max-height: 480px)');
    expect(block).toContain('.card {');
    expect(block).toContain('min-height: 0');
    expect(block).toContain('padding: 10px 14px');
    expect(block).toContain('.card .card-emblem');
  });
});
