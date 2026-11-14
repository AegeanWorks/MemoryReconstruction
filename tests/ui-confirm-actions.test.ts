import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');

describe('destructive actions need two presses', () => {
  it('shares one arming helper with a short disarm window', () => {
    expect(screens).toContain('const CONFIRM_WINDOW_MS = 2600;');
    const start = screens.indexOf('function confirmButton(');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = screens.slice(start, screens.indexOf('\nexport class Screens', start));
    expect(body).toContain("el.classList.add('danger')");
    expect(body).toContain('if (!el.isConnected) return;');
    expect(body).toContain('onConfirm();');
  });

  it('routes abandon, the relic sells, discard and sell-commons through it', () => {
    expect(screens).toContain(
      "confirmButton('Abandon Run', 'Confirm abandon', opts.onAbandon)"
    );
    const calls = screens.match(/confirmButton\(/g) ?? [];
    // One definition plus the five call sites.
    expect(calls.length).toBe(6);
    expect(screens).toContain("'Confirm sale'");
    expect(screens).toContain("'Confirm abandon'");
  });

  it('leaves no hand-rolled arming flags behind', () => {
    expect(screens).not.toContain('sellArmed');
    expect(screens).not.toContain('junkArmed');
    expect(screens).not.toContain('discardArmed');
  });

  it('never wires Abandon Run straight to its handler', () => {
    expect(screens).not.toContain("button('Abandon Run', opts.onAbandon)");
  });
});
