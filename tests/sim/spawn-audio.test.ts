import { describe, expect, it } from 'vitest';
import { ENEMY_SPAWN_AUDIO } from '../../src/audio/Sound';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

/** Every arrival pays a sound: gate spawns join teleports (blink) audibly. */
describe('enemy spawn cue (gate arrivals are heard, not just seen)', () => {
  it('publishes a quiet rising pop on its own throttle key', () => {
    expect(ENEMY_SPAWN_AUDIO.op).toBe('tone');
    if (ENEMY_SPAWN_AUDIO.op === 'tone') {
      expect(ENEMY_SPAWN_AUDIO.from).toBeLessThan(ENEMY_SPAWN_AUDIO.to);
      expect(ENEMY_SPAWN_AUDIO.volume).toBeLessThanOrEqual(0.06);
      expect(ENEMY_SPAWN_AUDIO.key).toBe('spawn');
    }
  });

  it('spawnEnemy emits the cued event', () => {
    const w = new World(createRun(3, []));
    const p = w.player;
    let spawned = 0;
    for (let i = 0; i < 30; i++) {
      for (const e of w.step({ ...NO_INPUT }, DT)) {
        if (e.type === 'enemySpawned') spawned++;
      }
    }
    expect(spawned).toBe(0);
    w.spawnEnemy('scavenger', p.x + 150, p.y, -1);
    for (let i = 0; i < 30; i++) {
      for (const e of w.step({ ...NO_INPUT }, DT)) {
        if (e.type === 'enemySpawned') spawned++;
      }
    }
    expect(spawned).toBeGreaterThan(0);
  });
});
