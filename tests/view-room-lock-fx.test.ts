import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const effects = readFileSync(join(__dirname, '../src/view/Effects.ts'), 'utf8');
const events = readFileSync(join(__dirname, '../src/sim/events.ts'), 'utf8');
const world = readFileSync(join(__dirname, '../src/sim/world.ts'), 'utf8');

describe('room lock has a local effect', () => {
  it('draws a ring/burst at the room centre', () => {
    const start = effects.indexOf("case 'roomLocked'");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = effects.indexOf("case '", start + 1);
    const body = effects.slice(start, end);
    expect(body).toContain('this.ring(e.x, e.y');
    expect(body).toContain('this.burst(e.x, e.y');
  });

  it('carries the room-centre position', () => {
    expect(events).toContain("{ type: 'roomLocked'; roomId: number; x: number; y: number }");
    expect(world).toContain("this.emit({ type: 'roomLocked', roomId: room.id, x: c.x, y: c.y })");
  });
});
