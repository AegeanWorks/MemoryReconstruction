import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const view = readFileSync(join(__dirname, '../src/view/ActorView.ts'), 'utf8');

describe('projectile aim-line clipping', () => {
  it('clips shot, spread, volley and bolt aim lines to the arena wall', () => {
    const start = view.indexOf("case 'shot'");
    const end = view.indexOf("case 'ring'", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(view.slice(start, end)).toContain('clipLaneToRoom');
  });
});
