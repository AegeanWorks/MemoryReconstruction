import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('summon cap', () => {
  it('never takes the room past four resident adds', () => {
    const world = new World(createRun(7, []));
    world.enemies.length = 0;
    const p = world.player;
    const room = world.floor.rooms[world.floor.bossRoom];
    world.rooms[room.id].phase = 'cleared';
    p.x = (room.x + room.w / 2) * 32;
    p.y = (room.y + room.h / 2) * 32;
    p.invulnerable = 9999;

    const boss = world.spawnEnemy('spirit', p.x, p.y - 100, room.id, true);
    boss.state = 'chase';
    boss.cooldown = 0;
    boss.patternIndex = 2;
    boss.phase = 0;
    boss.def.speed = 0;

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const add = world.spawnEnemy(
        'scavenger',
        p.x + Math.cos(a) * 90,
        p.y + Math.sin(a) * 90,
        room.id
      );
      add.state = 'chase';
      add.def.speed = 0;
      add.cooldown = 999;
    }

    for (let i = 0; i < 20 && (boss.state as string) !== 'windup'; i++) world.step(NO_INPUT, DT);
    expect(boss.state).toBe('windup');
    expect(boss.attack).toBe('summon');

    for (let i = 0; i < 80 && (boss.state as string) !== 'attack'; i++) world.step(NO_INPUT, DT);
    const adds = world.enemies.filter((e) => !e.isBoss && e.state !== 'dying').length;
    expect(adds).toBeLessThanOrEqual(4);
  });
});
