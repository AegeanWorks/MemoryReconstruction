import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('hub feats ladder styling', () => {
  it('spans the hub width and centres its chips', () => {
    const b = block('.feats-panel');
    expect(b).toContain('width: 100%');
    expect(b).toContain('justify-content: safe center');
  });

  it('marks unlocked feats with a gold gem glyph', () => {
    expect(block('.feat.unlocked::before')).toContain("content: '◆'");
  });

  it('renders sealed feats as compact quiet chips', () => {
    const b = block('.feat.locked');
    expect(b).toContain('border-style: dashed');
  });

  it('keeps the wide 720p layout from collapsing into a small box', () => {
    const start = css.indexOf('@media (min-width: 1180px) and (max-height: 820px)');
    expect(start).toBeGreaterThanOrEqual(0);
    const media = css.slice(start, css.indexOf('\n}\n', start));
    expect(media).toContain('width: 100%');
  });

  it('never shrinks below its chips when the hub is taller than the screen', () => {
    expect(block('.feats-panel')).toContain('flex-shrink: 0');
  });
});
