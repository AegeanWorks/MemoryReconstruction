import { describe, expect, it } from 'vitest';
import enemiesJson from '../../src/data/enemies.json';
import { enemyDef, floorPlan } from '../../src/sim/content';

/**
 * The Bone Catacombs should field its own dead. A Hive Guard in the catacombs
 * contradicts its own bestiary ("stands where the queen points") and the
 * floor's rank-and-file story. The fifth roster slot is a catacomb-native
 * wall caster instead.
 */
describe('Bone Catacombs roster', () => {
  const roster = floorPlan(16).roster;
  const catacombIds = new Set(
    enemiesJson.enemies.filter((enemy) => enemy.biome === 'catacomb').map((enemy) => enemy.id)
  );

  it('fields only catacomb-native enemies', () => {
    expect(roster).not.toContain('hive_guard');
    for (const id of roster) expect(catacombIds.has(id)).toBe(true);
  });

  it('adds the Ossuary Chanter as a wall warden', () => {
    expect(roster).toContain('ossuary_chanter');
    const chanter = enemyDef('ossuary_chanter');
    expect(chanter.behavior).toBe('wall_warden');
    expect(chanter.sprite).toBe('voidCantor');
    expect(chanter.tint).toBeTypeOf('number');
  });
});
