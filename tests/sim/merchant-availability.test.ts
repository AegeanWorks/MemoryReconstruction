import { describe, expect, it } from 'vitest';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

/**
 * The stall is a real feature, not a secret-room lottery: every floor must
 * place at least one merchant the walker can reach without opening a vault.
 */
describe('maze merchants are always available', () => {
  it('places at least one stock-selling merchant on every floor for 24 seeds', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const world = new World(createRun(seed, []));
      const merchants = world.interactables.filter((item) => item.kind === 'merchant');
      expect(merchants.length, `seed ${seed} has no merchant`).toBeGreaterThan(0);
      for (const merchant of merchants) {
        expect(world.shopStock(merchant.id).length, `seed ${seed} merchant ${merchant.id}`).toBe(5);
      }
    }
  });

  it('falls back to the labelled wandering stall when the vault roll misses', () => {
    let labelled = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const world = new World(createRun(seed, []));
      const merchants = world.interactables.filter((item) => item.kind === 'merchant');
      if (merchants.some((item) => item.label === 'Wandering merchant')) labelled++;
    }
    // The vault merchant only rolls 35%; the guaranteed stall must cover most floors.
    expect(labelled).toBeGreaterThanOrEqual(12);
  });
});
