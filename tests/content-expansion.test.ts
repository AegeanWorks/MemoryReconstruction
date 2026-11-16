import { describe, expect, it } from 'vitest';
import { FINAL_DEPTH, FLOOR_PLANS, allEnemyIds, enemyDef } from '../src/sim/content';
import { createEnemy } from '../src/sim/enemies';

const NEW_MOBS = ['bone_picker', 'lantern_wraith', 'cinder_stalker', 'spire_marksman'];
const NEW_BOSSES = ['reliquary_warden', 'salt_orchard_hydra'];

describe('Cycle 100 content additions', () => {
  it('adds four late mobs and two late guardians to the bestiary', () => {
    for (const id of [...NEW_MOBS, ...NEW_BOSSES]) expect(allEnemyIds(), id).toContain(id);
    for (const id of NEW_BOSSES) expect(enemyDef(id, true).archetype, id).toBe('boss');
  });

  it('puts every new mob on a reachable roster', () => {
    for (const id of NEW_MOBS) {
      expect(
        FLOOR_PLANS.some((plan) => plan.roster.includes(id)),
        `${id} is in no roster`
      ).toBe(true);
    }
  });

  it('keeps the plan depths sequential and ending at FINAL_DEPTH', () => {
    expect(FLOOR_PLANS.map((plan) => plan.depth)).toEqual(
      Array.from({ length: FINAL_DEPTH + 1 }, (_, i) => i)
    );
    expect(FINAL_DEPTH).toBe(24);
  });

  it('extends the late road with two distinct trials before the Keeper', () => {
    const reliquary = FLOOR_PLANS[21];
    const orchard = FLOOR_PLANS[22];
    expect(reliquary.trialName).toBe('The Gilded Reliquary');
    expect(reliquary.boss).toBe('reliquary_warden');
    expect(orchard.trialName).toBe('The Salt Orchard');
    expect(orchard.boss).toBe('salt_orchard_hydra');
    expect(reliquary.roster).toContain('bone_picker');
    expect(reliquary.roster).toContain('spire_marksman');
    expect(orchard.roster).toContain('lantern_wraith');
    expect(FLOOR_PLANS[23].boss).toBe('keeper');
    expect(FLOOR_PLANS[24].boss).toBe('first_memory');
  });

  it('gives the new guardians boss-scale frames and real attack patterns', () => {
    for (const id of NEW_BOSSES) {
      const def = enemyDef(id, true);
      expect(def.displayHeight, id).toBeGreaterThan(170);
      expect(def.displayHeight, id).toBeLessThanOrEqual(200);
      const enemy = createEnemy(1, def, 0, 0, 0, { health: 1, damage: 1 }, false);
      expect(typeof enemy.attack, id).toBe('string');
      expect(enemy.attack.length, id).toBeGreaterThan(0);
    }
    expect(enemyDef('reliquary_warden', true).sprite).not.toBe(
      enemyDef('salt_orchard_hydra', true).sprite
    );
  });
});
