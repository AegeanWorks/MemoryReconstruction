import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('controls list on short landscape screens', () => {
  const start = css.indexOf('/* Short controls:');
  const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('\n}\n', start) + 1));

  it('sets two key and action pairs per row inside a wider panel', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('@media (max-height: 480px)');
    expect(block).toContain('.controls {');
    expect(block).toContain('grid-template-columns: auto 1fr auto 1fr');
    expect(block).toContain('.panel:has(> .controls)');
    expect(block).toContain('width: min(920px, 96vw)');
  });
});
