import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('soul anchor cue', () => {
  it('emits the dedicated soulAnchor event when death is refused', () => {
    const world = new World(createRun(7, []));
    const p = world.player;
    p.invulnerable = 0;
    p.equipment.trinket = { uid: 4242, defId: 'soul_anchor' };
    world.damagePlayer(99999, p.x + 10, p.y, 0);
    const events = world.step(NO_INPUT, DT);
    expect(p.health).toBeGreaterThan(0);
    expect(p.equipment.trinket).toBeNull();
    expect(events.some((event) => event.type === 'soulAnchor')).toBe(true);
  });

  it('does not emit the cue when there is no anchor to shatter', () => {
    const world = new World(createRun(7, []));
    const p = world.player;
    p.invulnerable = 0;
    world.damagePlayer(99999, p.x + 10, p.y, 0);
    const events = world.step(NO_INPUT, DT);
    expect(events.some((event) => event.type === 'soulAnchor')).toBe(false);
  });
});
