import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('hub on short wide screens', () => {
  const start = css.indexOf('/* Short hub:');
  const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('\n}\n', start) + 1));

  it('seats all six residents in one row', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('@media (min-width: 700px) and (max-height: 480px)');
    expect(block).toContain('.building-grid');
    expect(block).toContain('grid-template-columns: repeat(6, 1fr)');
  });
});
