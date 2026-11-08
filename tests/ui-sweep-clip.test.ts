import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const view = readFileSync(join(__dirname, '../src/view/ActorView.ts'), 'utf8');

describe('sweep telegraph clipping', () => {
  it('clips both the warning arc and the live beam to the arena wall', () => {
    const telegraph = view.indexOf("case 'sweep'");
    expect(telegraph).toBeGreaterThanOrEqual(0);
    expect(view.slice(telegraph, telegraph + 500)).toContain('clipLaneToRoom');

    const beam = view.indexOf('private drawSweepBeam');
    expect(beam).toBeGreaterThanOrEqual(0);
    expect(view.slice(beam, beam + 700)).toContain('clipLaneToRoom');
  });
});
