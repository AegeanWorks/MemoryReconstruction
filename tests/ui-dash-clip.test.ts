import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const view = readFileSync(join(__dirname, '../src/view/ActorView.ts'), 'utf8');

describe('dash-strike telegraph clipping', () => {
  it('clips the dash-strike lane to the arena wall', () => {
    const start = view.indexOf("case 'dashStrike'");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(view.slice(start, start + 700)).toContain('clipLaneToRoom');
  });
});
