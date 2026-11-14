import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('title menu on short landscape screens', () => {
  const start = css.indexOf('/* Short title:');
  const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('\n}\n', start) + 1));

  it('has a short-screen block', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain('@media (max-height: 480px)');
  });

  it('lays the menu out in two columns with a full-width primary action and slimmer buttons', () => {
    expect(block).toContain('.title-menu .menu');
    expect(block).toContain('grid-template-columns: 1fr 1fr');
    expect(block).toContain('.title-menu .btn.primary');
    expect(block).toContain('grid-column: 1 / -1');
    expect(block).toContain('padding: 8px 12px');
  });
});
