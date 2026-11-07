import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { isMeleeBossId } from '../../src/sim/enemies';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

/** Distance a boss holds after three seconds of chasing a walker in the start room. */
function holdDistance(bossId: string): number {
  const run = createRun(20261107, []);
  run.depth = 7;
  const world = new World(run);
  world.enemies.length = 0;
  const room = world.floor.rooms[world.floor.startRoom];
  const cx = (room.x + room.w / 2) * 32;
  const cy = (room.y + room.h / 2) * 32;
  const p = world.player;
  p.x = cx;
  p.y = cy;
  const boss = world.spawnEnemy(bossId, cx + 120, cy, -1, true);
  boss.state = 'chase';
  boss.cooldown = 999;
  for (let i = 0; i < 180; i++) world.step(NO_INPUT, DT);
  return Math.hypot(boss.x - p.x, boss.y - p.y);
}

describe('boss approach discipline', () => {
  it('classifies the tide and storm warlords as melee bosses', () => {
    for (const id of ['dread_champion', 'ruin_warlord', 'drowned_blademaster', 'storm_warlord']) {
      expect(isMeleeBossId(id), `${id} should close in`).toBe(true);
    }
    expect(isMeleeBossId('forgotten')).toBe(false);
    expect(isMeleeBossId('abyssal_revenant')).toBe(false);
  });

  it('brings a melee boss to blade range', () => {
    expect(holdDistance('dread_champion')).toBeLessThan(90);
  });

  it('leaves a caster boss at its firing distance', () => {
    expect(holdDistance('forgotten')).toBeGreaterThan(90);
  });
});
