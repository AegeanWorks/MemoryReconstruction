import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(__dirname, '../src/view/LevelView.ts'), 'utf8');

describe('torch light is a soft additive halo', () => {
  const start = src.indexOf('private drawTorches(');
  const body = src.slice(start, src.indexOf('\n  }\n', start));

  it('no longer paints the light as hard flat circles', () => {
    expect(body).not.toContain('g.circle(px, py + 8, 64)');
    expect(body).not.toContain('g.circle(px, py + 8, 36)');
  });

  it('lights with pooled additive glow sprites that breathe with the flame', () => {
    expect(src).toContain('private readonly torchLights = new Container()');
    expect(src).toContain('private torchLight(');
    expect(body).toContain('this.torchLight(');
    expect(src).toContain("sprite.blendMode = 'add'");
  });

  it('hides unused pooled lights each frame', () => {
    expect(body).toContain('.visible = false');
  });
});
