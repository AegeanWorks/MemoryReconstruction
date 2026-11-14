import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(__dirname, '../src/view/ActorView.ts'), 'utf8');

describe('calm mobs breathe', () => {
  const start = src.indexOf('const moving = e.state ===');
  const body = src.slice(start, src.indexOf('Kinetic knockback', start));

  it('only breathes while no attack, stagger, spawn or death pose is active', () => {
    expect(body).toContain('const calm =');
    for (const state of ['windup', 'attack', 'stagger', 'spawning', 'dying'])
      expect(body.slice(body.indexOf('const calm ='), body.indexOf('const breathe'))).toContain(
        state
      );
  });

  it('desyncs each mob by id and squashes width against height', () => {
    expect(body).toContain('this.time * 2.6 + e.id');
    expect(body).toMatch(/\/\s*breathe/);
    expect(body).toMatch(/\*\s*breathe/);
  });
});
