import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');
const html = readFileSync(join(__dirname, '../index.html'), 'utf8');

function ruleBody(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

describe('notched-phone safe areas', () => {
  it('asks the browser for the full screen so the inset variables are non-zero', () => {
    expect(html).toContain('viewport-fit=cover');
  });

  it('defines the four inset variables once, with zero fallbacks for desktop', () => {
    const root = ruleBody(':root');
    expect(root).toContain('--safe-top: env(safe-area-inset-top, 0px)');
    expect(root).toContain('--safe-right: env(safe-area-inset-right, 0px)');
    expect(root).toContain('--safe-bottom: env(safe-area-inset-bottom, 0px)');
    expect(root).toContain('--safe-left: env(safe-area-inset-left, 0px)');
  });

  it('keeps the touch sticks and action cluster clear of the notch and home bar', () => {
    expect(ruleBody('.touch-stick.move')).toContain('left: calc(16px + var(--safe-left))');
    expect(ruleBody('.touch-stick.aim')).toContain('right: calc(16px + var(--safe-right))');
    expect(ruleBody('.touch-stick.move')).toContain('var(--safe-bottom)');
    expect(ruleBody('.touch-buttons')).toContain('var(--safe-right)');
    expect(ruleBody('.touch-buttons')).toContain('var(--safe-bottom)');
  });

  it('keeps the utility rail and HUD pills out of the top and side insets', () => {
    expect(ruleBody('.touch-utility')).toContain('left: calc(12px + var(--safe-left))');
    expect(ruleBody('.touch-utility')).toContain('top: calc(12px + var(--safe-top))');
    expect(ruleBody('.hud-floor')).toContain('top: calc(14px + var(--safe-top))');
    expect(ruleBody('.hud-map')).toContain('right: calc(18px + var(--safe-right))');
    expect(ruleBody('.hud-vitals')).toContain('bottom: calc(14px + var(--safe-bottom))');
  });

  it('keeps the phone-width HUD overrides inside the insets too', () => {
    expect(css).toContain('right: calc(10px + var(--safe-right))');
    expect(css).toContain('top: calc(10px + var(--safe-top))');
    expect(css).toContain('bottom: calc(10px + var(--safe-bottom))');
    expect(css).toContain('left: calc(10px + var(--safe-left))');
  });

  it('applies the same insets inside the portrait media query', () => {
    const start = css.indexOf('@media (pointer: coarse) and (max-width: 560px)');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('.touch-btn {', start)));
    expect(block).toContain('top: calc(68px + var(--safe-top))');
    expect(block).toContain('var(--safe-bottom)');
  });

  it('narrows the full-width portrait vitals plate between the side insets', () => {
    expect(css).toContain(
      'width: calc(100vw - 24px - var(--safe-left) - var(--safe-right))'
    );
  });
});
