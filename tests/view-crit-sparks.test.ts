import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const effects = readFileSync(join(__dirname, '../src/view/Effects.ts'), 'utf8');

describe('combat hit sparks and critical hit punch', () => {
  it('spawns a specular star glint on enemy hits for visual blade sharpness', () => {
    const start = effects.indexOf("case 'hit':");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = effects.indexOf("case 'shockwave':", start);
    const body = effects.slice(start, end);
    expect(body).toContain('this.star(');
    expect(body).toContain('e.crit ? 0xfff3a0 : 0xd0f4ff');
    expect(body).toContain('e.crit ? 54 : 20');
  });

  it('boosts critical hit starburst radius and spark count', () => {
    const start = effects.indexOf("case 'hit':");
    const end = effects.indexOf("case 'shockwave':", start);
    const body = effects.slice(start, end);
    expect(body).toContain('e.crit ? 18 : 8');
    expect(body).toContain('this.ring(e.x, e.y, 44, 0xffd98a');
  });
});
