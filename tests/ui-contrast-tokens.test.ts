import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');

type Rgb = { r: number; g: number; b: number };

/** Reads a `#rrggbb` token from the :root block. */
function token(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  expect(match, `missing token ${name}`).not.toBeNull();
  return match![1].toLowerCase();
}

function rgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** `rgba(r, g, b, a)` flattened over an opaque backdrop. */
function overpanel(backdrop: Rgb, r: number, g: number, b: number, a: number): Rgb {
  return {
    r: r * a + backdrop.r * (1 - a),
    g: g * a + backdrop.g * (1 - a),
    b: b * a + backdrop.b * (1 - a),
  };
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(c: Rgb): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// The canvas sits under rgba(4, 3, 10, ~0.97) screens; #050409 is the worst realistic backdrop.
const PAGE: Rgb = rgb('#050409');
// --panel is rgba(14, 12, 26, 0.86) over that page, the plate most text actually sits on.
const PANEL = overpanel(PAGE, 14, 12, 26, 0.86);

const TEXT_TOKENS = ['--ink', '--ink-dim', '--gold', '--gold-deep', '--cyan', '--violet', '--red'];

describe('palette contrast floor', () => {
  it('keeps every text token at AA or better on the page and on a panel', () => {
    for (const name of TEXT_TOKENS) {
      const colour = rgb(token(name));
      expect(contrast(colour, PAGE), `${name} on the page`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour, PANEL), `${name} on a panel`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps dim text well clear of the 4.5 floor, since it is used at 10-11px', () => {
    const dim = rgb(token('--ink-dim'));
    expect(contrast(dim, PANEL)).toBeGreaterThanOrEqual(7);
  });

  it('keeps an empty bag slot readable instead of fading the whole row', () => {
    const start = css.indexOf('.gear-row.empty {');
    expect(start).toBeGreaterThanOrEqual(0);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule, 'the row must not fade its own text').not.toContain('opacity');
    expect(rule).toContain('border-style: dashed');
    expect(css).toContain('.gear-row.empty .gear-name');
    expect(css).toMatch(/\.gear-row\.empty \.gear-desc \{[^}]*color: var\(--ink-dim\)/s);
  });

  it('never sets text to translucent white below 60%, which is where it fails AA', () => {
    const faint: string[] = [];
    for (const line of css.split('\n')) {
      const match = line.match(/^\s*color:\s*rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/);
      if (match && Number(match[1]) < 0.6) faint.push(line.trim());
    }
    expect(faint, `faint text colours: ${faint.join(' | ')}`).toEqual([]);
  });
});
