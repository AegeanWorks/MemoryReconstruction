import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '../src/ui/ui.css'), 'utf8');
const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');

function ruleBody(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

describe('memories screen style', () => {
  const start = screens.indexOf('export function memoriesScreen');
  const body = screens.slice(start, screens.indexOf('export function settingsScreen'));

  it('shows one gem pip per fragment, lit when recovered', () => {
    expect(body).toContain("class: 'memory-pips'");
    expect(body).toContain("have.has(id) ? 'pip on' : 'pip'");
    expect(body).toContain('aria-label');
    expect(body).toContain("role: 'img'");
  });

  it('marks restored memories and tells recovered from sealed fragments', () => {
    expect(body).toContain("complete ? 'memory complete' : 'memory'");
    expect(body).toContain("'frag found'");
    expect(body).toContain("'frag sealed'");
  });

  it('styles pips as glowing gems and restored memories in gold', () => {
    expect(ruleBody('.memory-pips .pip.on')).toContain('box-shadow');
    expect(ruleBody('.memory.complete')).toContain('border-left: 2px solid');
    expect(ruleBody('.memory .frag.sealed')).toContain('opacity');
  });
});
