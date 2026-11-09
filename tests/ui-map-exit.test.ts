import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const minimap = readFileSync(join(__dirname, '../src/ui/Minimap.ts'), 'utf8');
const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');

describe('floor exit map marker', () => {
  it('reads the active portal and draws a pale diamond', () => {
    expect(minimap).toContain("i.kind === 'portal'");
    expect(minimap).toContain('PALE');
    expect(minimap).toContain('portal');
  });

  it('documents the marker in the map legend', () => {
    expect(screens).toContain('Pale diamond: floor exit');
  });
});
