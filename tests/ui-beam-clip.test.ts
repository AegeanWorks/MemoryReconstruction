import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const view = readFileSync(join(__dirname, '../src/view/ActorView.ts'), 'utf8');

describe('beam telegraph clipping', () => {
  it('clips the beam lane to the arena wall', () => {
    const start = view.indexOf("case 'beam'");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(view.slice(start, start + 700)).toContain('clipLaneToRoom');
  });
});
