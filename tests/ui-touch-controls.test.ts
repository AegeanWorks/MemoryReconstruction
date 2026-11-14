import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');
const overlay = readFileSync(join(__dirname, '../src/ui/TouchControls.ts'), 'utf8');
const app = readFileSync(join(__dirname, '../src/app/App.ts'), 'utf8');

function ruleBody(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

describe('touch controls overlay', () => {
  it('lays eight buttons out four across in landscape', () => {
    expect(ruleBody('.touch-buttons')).toContain('grid-template-columns: repeat(4, 48px)');
  });

  it('builds two sticks and the action buttons', () => {
    expect(overlay).toContain('export function createTouchControls');
    // The two sticks share one builder keyed by kind.
    expect(overlay).toContain('touch-stick ${kind}');
    expect(overlay).toContain("'move'");
    expect(overlay).toContain("'aim'");
    for (const cls of ['touch-btn dash', 'touch-btn bolt']) expect(overlay).toContain(cls);
    for (const cls of [
      'touch-btn bomb',
      'touch-btn trap',
      'touch-btn potion',
      'touch-btn interact',
      'touch-btn stance',
      'touch-btn art',
    ])
      expect(overlay).toContain(cls);
  });

  it('tracks each finger by pointer id and captures it, so two thumbs work at once', () => {
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
      expect(overlay).toContain(`'${ev}'`);
    expect(overlay).toContain('setPointerCapture');
    expect(overlay).toContain('pointerId');
  });

  it('is mounted in the HUD, so it hides with it on menus and the title', () => {
    expect(app).toContain('createTouchControls(');
    expect(app).toContain('this.hud.root.append(');
  });

  it('is hidden everywhere except coarse-pointer (touch) screens', () => {
    expect(ruleBody('.touch-controls')).toContain('display: none');
    expect(css).toContain('@media (pointer: coarse)');
    const start = css.indexOf('/* Touch controls (shown');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(css.slice(start)).toContain('.touch-controls {\n    display: block');
  });

  it('stops the browser scrolling or zooming under a thumb', () => {
    expect(ruleBody('.touch-stick')).toContain('touch-action: none');
    expect(ruleBody('.touch-btn')).toContain('touch-action: none');
    expect(ruleBody('.touch-controls')).toContain('pointer-events: none');
    expect(ruleBody('.touch-stick')).toContain('pointer-events: auto');
  });

  it('hides the keyboard hint panel on touch screens, where it only sits under the move stick', () => {
    const start = css.indexOf('/* Touch controls (shown');
    const block = css.slice(
      start,
      css.indexOf('@media (pointer: coarse) and (max-width: 560px)', start)
    );
    expect(block).toContain('.hint {\n    display: none');
  });

  it('on portrait phones puts the buttons between the sticks, clear of the walker at screen centre', () => {
    const start = css.indexOf('@media (pointer: coarse) and (max-width: 560px)');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = css.slice(start, css.indexOf('\n}\n', css.indexOf('.touch-buttons', start)));
    expect(block).toContain('.touch-buttons {');
    expect(block).toContain('grid-template-columns: repeat(3, 40px)');
    expect(block).toContain('.touch-btn {');
    expect(block).toContain('width: 40px');
    expect(block).toContain('left: 50%');
    expect(block).toContain('bottom: calc(var(--touch-bottom, 16px) + var(--safe-bottom))');
  });
});
