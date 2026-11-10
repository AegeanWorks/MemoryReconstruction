import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');
const hud = readFileSync(join(__dirname, '../src/ui/Hud.ts'), 'utf8');

describe('boss bar monumental styling and enrage cue', () => {
  it('toggles enraged class when boss health ratio is at or below 30%', () => {
    expect(hud).toMatch(/bossBar\.classList\.toggle\(\s*['"]enraged['"]\s*,\s*ratio\s*<=\s*0\.3\s*\)/);
  });

  it('defines an enraged pulse animation in CSS for the final phase', () => {
    expect(css).toContain('.boss-bar.enraged');
    expect(css).toContain('@keyframes bossEnragePulse');
  });
});
