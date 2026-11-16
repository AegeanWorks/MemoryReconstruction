import { describe, expect, it } from 'vitest';
import {
  RAGE_DAMAGE,
  cycleRage,
  normalizeRage,
  rageAfterHit,
  rageDamageScale,
  rageEndsOnHit,
  rageLabel,
} from '../src/sim/rage';
import { createPlayer } from '../src/sim/player';
import { createRun } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/entities';
import { World } from '../src/sim/world';

describe('rage stances', () => {
  it('cycles none -> frenzy -> berserker -> none', () => {
    expect(cycleRage('none')).toBe('frenzy');
    expect(cycleRage('frenzy')).toBe('berserker');
    expect(cycleRage('berserker')).toBe('none');
  });

  it('makes frenzy hit hardest and berserker a softer, steadier boost', () => {
    expect(rageDamageScale('none')).toBe(1);
    expect(rageDamageScale('frenzy')).toBe(RAGE_DAMAGE.frenzy);
    expect(rageDamageScale('berserker')).toBe(RAGE_DAMAGE.berserker);
    expect(RAGE_DAMAGE.frenzy).toBeGreaterThan(RAGE_DAMAGE.berserker);
  });

  it('breaks frenzy on a landed blow but never berserker', () => {
    expect(rageEndsOnHit('frenzy')).toBe(true);
    expect(rageEndsOnHit('berserker')).toBe(false);
    expect(rageAfterHit('frenzy')).toBe('none');
    expect(rageAfterHit('berserker')).toBe('berserker');
  });

  it('labels the stance and refuses unknown saves', () => {
    expect(rageLabel('none')).toBeUndefined();
    expect(rageLabel('frenzy')).toBe('Frenzy');
    expect(rageLabel('berserker')).toBe('Berserker');
    expect(normalizeRage('frenzy')).toBe('frenzy');
    expect(normalizeRage('other')).toBe('none');
    expect(normalizeRage(undefined)).toBe('none');
  });

  it('starts calm and cycles from the input frame', () => {
    const player = createPlayer(0, 0);
    expect(player.rage).toBe('none');
    const world = new World(createRun(99, []));
    world.step({ ...NO_INPUT, rage: true }, 1 / 60);
    expect(world.player.rage).toBe('frenzy');
    world.step({ ...NO_INPUT, rage: true }, 1 / 60);
    expect(world.player.rage).toBe('berserker');
    world.step({ ...NO_INPUT, rage: true }, 1 / 60);
    expect(world.player.rage).toBe('none');
  });

  it('multiplies player damage and breaks frenzy on a hit', () => {
    const world = new World(createRun(7, []));
    const enemy = world.spawnEnemy('memory_echo', world.player.x + 40, world.player.y, 0);
    enemy.state = 'chase';
    enemy.health = 1000;
    enemy.maxHealth = 1000;
    world.player.rage = 'frenzy';
    world.damageEnemy(enemy, 10, 'melee', false, 0);
    expect(enemy.health).toBe(1000 - 16);

    world.player.rage = 'frenzy';
    enemy.health = 1000;
    world.damagePlayer(5, enemy.x, enemy.y, 0);
    expect(world.player.rage).toBe('none');
  });

  it('keeps berserker through a hit', () => {
    const world = new World(createRun(8, []));
    world.player.rage = 'berserker';
    world.damagePlayer(5, 0, 0, 0);
    expect(world.player.rage).toBe('berserker');
  });
});
