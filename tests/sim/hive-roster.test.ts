import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS, enemyDef } from '../../src/sim/content';

describe('Hive Queen brood', () => {
  it('fills the room with hive children, not ash-born cinder wisps', () => {
    const plan = FLOOR_PLANS[15];
    expect(plan.boss).toBe('hive_queen');
    expect(plan.roster).not.toContain('cinder_wisp');
    for (const id of ['hive_drone', 'hive_guard', 'hive_oracle', 'hive_slinger'])
      expect(plan.roster).toContain(id);
    expect(enemyDef('hive_oracle').behavior).toBe('wall_warden');
  });
});
