import { describe, expect, it } from 'vitest';
import enemiesJson from '../../src/data/enemies.json';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('Crystal Golem pattern', () => {
  it('channels its advertised prism beam in the fourth pattern slot', () => {
    const world = new World(createRun(7, []));
    world.enemies.length = 0;
    const p = world.player;
    const room = world.floor.rooms[world.floor.bossRoom];
    world.rooms[room.id].phase = 'cleared';
    p.x = (room.x + room.w / 2) * 32;
    p.y = (room.y + room.h / 2) * 32;
    p.invulnerable = 9999;

    const boss = world.spawnEnemy('crystal_golem', p.x, p.y - 100, room.id, true);
    boss.state = 'chase';
    boss.cooldown = 0;
    boss.patternIndex = 3;
    boss.phase = 0;
    boss.def.speed = 0;

    for (let i = 0; i < 20 && (boss.state as string) !== 'windup'; i++) world.step(NO_INPUT, DT);
    expect(boss.state).toBe('windup');
    expect(boss.attack).toBe('beam');
  });

  it('describes the beam and shards instead of an unimplemented reflect', () => {
    const raw = enemiesJson as {
      enemies: Array<{ id: string; description: string; abilities: string[] }>;
    };
    const golem = raw.enemies.find((e) => e.id === 'crystal_golem')!;
    expect(golem.description).toContain('prism beam');
    expect(golem.description).not.toContain('Reflects projectiles');
    expect(golem.abilities).not.toContain('crystal_reflect');
  });
});
