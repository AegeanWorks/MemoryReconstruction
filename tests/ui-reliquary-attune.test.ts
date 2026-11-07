import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');
const app = readFileSync(join(__dirname, '../src/app/App.ts'), 'utf8');

describe('Reliquary attunement feedback', () => {
  it('pulses the newly attuned relic row', () => {
    const row = css.slice(css.indexOf('.gear-row.attuned {'));
    expect(row.slice(0, row.indexOf('}'))).toContain('animation: attune-pulse');
    expect(css).toContain('@keyframes attune-pulse');
  });

  it('disables the pulse for reduced motion', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('.gear-row.attuned');
    expect(reduced.slice(0, reduced.indexOf('}'))).toContain('animation: none');
  });

  it('uses the dedicated attunement chime, not the generic menu click', () => {
    const start = app.indexOf('private showReliquary()');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = app.slice(start, app.indexOf('private showAspects()', start));
    expect(body).toContain('this.sound.attune();');
    expect(body).not.toContain('this.sound.click();');
  });
});
