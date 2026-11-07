import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const view = readFileSync(join(__dirname, '../src/view/ActorView.ts'), 'utf8');

describe('bomb blast telegraph', () => {
  it('draws the real blast radius around the bomb', () => {
    const start = view.indexOf('private drawBombs');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = view.slice(start, start + 900);
    expect(body).toContain('b.radius');
    expect(body).toMatch(/circle\(b\.x, b\.y, b\.radius\)/);
  });
});
