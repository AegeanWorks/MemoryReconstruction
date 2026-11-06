import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { WEAPON_ART_IMPACT } from '../../src/sim/weapons';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function world(seed = 11): World {
  const run = createRun(seed, []);
  return new World(run);
}

describe('weapon art impact (the 7s nuke must hit harder than a swing)', () => {
  it('every stance has a data-driven art impact, greatsword heaviest', () => {
    for (const id of ['sword', 'spear', 'greatsword'] as const) {
      expect(WEAPON_ART_IMPACT[id]).toBeDefined();
      expect(WEAPON_ART_IMPACT[id].hitstop).toBeGreaterThan(0);
      expect(WEAPON_ART_IMPACT[id].shake).toBeGreaterThan(0);
    }
    expect(WEAPON_ART_IMPACT.greatsword.hitstop).toBeGreaterThan(
      WEAPON_ART_IMPACT.sword.hitstop
    );
    expect(WEAPON_ART_IMPACT.greatsword.shake).toBeGreaterThanOrEqual(
      WEAPON_ART_IMPACT.sword.shake
    );
    // A basic finisher swing freezes 0.07s; the art must beat a plain swing.
    expect(WEAPON_ART_IMPACT.greatsword.hitstop).toBeGreaterThan(0.07);
  });

  it.each(['sword', 'spear', 'greatsword'] as const)(
    'firing the %s art freezes the sim and shakes by the table',
    (weapon) => {
      const w = world();
      const p = w.player;
      p.weapon = weapon;
      p.artCooldown = 0;
      p.aim = 0;
      const events = w.step(
        { ...NO_INPUT, aimX: p.x + 100, aimY: p.y, art: true },
        DT
      );
      expect(events.some((e) => e.type === 'weaponArt')).toBe(true);
      expect((w as unknown as { freeze: number }).freeze).toBeGreaterThan(0);
      const shakes = events.filter((e) => e.type === 'shake');
      expect(shakes.length).toBeGreaterThan(0);
      expect(shakes[shakes.length - 1].strength).toBe(
        WEAPON_ART_IMPACT[weapon].shake
      );
    }
  );
});
