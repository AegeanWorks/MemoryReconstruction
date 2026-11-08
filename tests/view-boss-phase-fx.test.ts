import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const effects = readFileSync(join(__dirname, '../src/view/Effects.ts'), 'utf8');
const events = readFileSync(join(__dirname, '../src/sim/events.ts'), 'utf8');
const world = readFileSync(join(__dirname, '../src/sim/world.ts'), 'utf8');

describe('boss phase has a local effect', () => {
  it('draws a ring/star/burst at the boss position', () => {
    const start = effects.indexOf("case 'bossPhase'");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = effects.indexOf("case '", start + 1);
    const body = effects.slice(start, end);
    expect(body).toContain('this.ring(e.x, e.y');
    expect(body).toContain('this.star(e.x, e.y');
    expect(body).toContain('this.burst(e.x, e.y');
  });

  it('carries the boss position on the event', () => {
    expect(events).toContain(
      "{ type: 'bossPhase'; phase: number; x: number; y: number }"
    );
    expect(world).toContain(
      "this.emit({ type: 'bossPhase', phase, x: enemy.x, y: enemy.y })"
    );
  });
});
