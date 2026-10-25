import { existsSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { atlasImagePaths } from '../src/view/sheets';
import { shade } from '../src/view/tileArt';

describe('assets', () => {
  it('has every image the sprite atlas references', () => {
    const missing = atlasImagePaths().filter(
      (p) => !existsSync(path.resolve(__dirname, '../assets', p))
    );
    expect(missing).toEqual([]);
  });

  it('shades colours to hex that can be shaded again', () => {
    const once = shade('#808080', 0.5);
    expect(once).toMatch(/^#[0-9a-f]{6}$/);
    expect(shade(once, -0.5)).toMatch(/^#[0-9a-f]{6}$/);
    expect(shade('#000000', 1)).toBe('#ffffff');
  });
});
