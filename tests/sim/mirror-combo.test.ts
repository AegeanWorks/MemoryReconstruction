import { describe, expect, it } from 'vitest';
import { mirrorComboStepDamage } from '../../src/sim/enemies';
import { createExpedition } from '../../src/sim/hub';
import { World } from '../../src/sim/world';

describe('mirror combo', () => {
  it('keeps a three-hit mirror combo from deleting a fresh checkpoint walker', () => {
    const w = new World(
      createExpedition(20261107, [], 17, { echoes: 0, restorations: {}, checkpoint: 0 })
    );
    const mirror = w.spawnEnemy('mirror_self', w.player.x + 60, w.player.y, -1, true);

    const combo = [0, 1, 2].reduce(
      (sum, step) => sum + mirrorComboStepDamage(mirror.def.damage, w.player.stats.maxHealth, step),
      0
    );
    expect(combo).toBeLessThan(w.player.stats.maxHealth);
  });
});
