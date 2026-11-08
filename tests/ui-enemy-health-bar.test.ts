import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const view = readFileSync(join(__dirname, '../src/view/ActorView.ts'), 'utf8');
const start = view.indexOf('private drawHealthBar(');
const end = view.indexOf('private syncProjectiles', start);
const body = view.slice(start, end);

describe('enemy health bar readability', () => {
  it('uses a taller elite/boss-aware bar', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(body).toContain('const h = e.isBoss ? 6 : 4');
    expect(body).toContain('Math.max(28, e.radius * 2.4)');
  });

  it('draws an inner frame and a highlight without changing the color rule', () => {
    expect(body).toContain('0x1a1622');
    expect(body).toContain('this.bars.rect(x - w / 2, top, w * ratio, 1)');
    expect(body).toContain('e.elite ? 0xffc84a : 0xff4d5e');
  });
});
