import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

describe('relic inventory UI styling and stat pill framing', () => {
  it('frames .gear-stats with a recessed backplate and pill gap', () => {
    const statsStart = css.indexOf('.gear-stats {');
    expect(statsStart).toBeGreaterThanOrEqual(0);
    const statsEnd = css.indexOf('}', statsStart);
    const block = css.slice(statsStart, statsEnd);

    expect(block).toContain('background: rgba(0, 0, 0, 0.32)');
    expect(block).toContain('border-radius: 8px');
    expect(block).toContain('gap: 6px');
  });

  it('styles .gear-stat as a distinct rounded pill with background and border', () => {
    const statStart = css.indexOf('.gear-stat {');
    expect(statStart).toBeGreaterThanOrEqual(0);
    const statEnd = css.indexOf('}', statStart);
    const block = css.slice(statStart, statEnd);

    expect(block).toContain('display: inline-flex');
    expect(block).toContain('border-radius: 6px');
    expect(block).toContain('padding: 3px 8px');
  });

  it('gives the bag the taller 74vh panel the player asked for', () => {
    const panelStart = css.indexOf('.gear-panel {');
    expect(panelStart).toBeGreaterThanOrEqual(0);
    const panelEnd = css.indexOf('}', panelStart);
    const block = css.slice(panelStart, panelEnd);

    expect(block).toContain('max-height: min(74vh, 600px)');
  });
});
