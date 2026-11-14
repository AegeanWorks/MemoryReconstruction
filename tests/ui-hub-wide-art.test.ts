import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('wide short hub keeps resident art', () => {
  const start = css.indexOf('@media (min-width: 1180px) and (max-height: 820px)');
  const media = css.slice(start, css.indexOf('\n}\n', start));

  it('restores a compact art strip that the short-height rule hides', () => {
    expect(css.indexOf('.building-art {\n    display: none;')).toBeGreaterThan(-1);
    expect(media).toMatch(/\.building-art \{[^}]*display: flex/);
    expect(media).toMatch(/\.building-art \{[^}]*height: 60px/);
    expect(media).toMatch(/\.building-art img \{[^}]*height: 56px/);
  });
});
