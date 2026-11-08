import { describe, expect, it } from 'vitest';
import {
  CORE_MEMORIES,
  FINAL_DEPTH,
  FLOOR_PLANS,
  MEMORY_FRAGMENTS,
  arenaBossFor,
  enemyDef,
} from '../../src/sim/content';

describe('frontier content', () => {
  it('adds two stronger late enemies with tracked sheets', () => {
    const reaver = enemyDef('obsidian_reaver');
    const echo = enemyDef('first_echo');
    expect(reaver.archetype).toBe('caster');
    expect(reaver.behavior).toBe('sweeper');
    expect(reaver.sprite).toBe('cinderWarden');
    expect(echo.archetype).toBe('caster');
    expect(echo.behavior).toBe('wall_warden');
    expect(echo.sprite).toBe('voidCantor');
    expect(reaver.maxHealth).toBeGreaterThan(enemyDef('ash_herald').maxHealth);
    expect(echo.damage).toBeGreaterThan(enemyDef('phase_stalker').damage);
  });

  it('adds a true final section after the Keeper', () => {
    expect(FINAL_DEPTH).toBe(22);
    expect(FLOOR_PLANS[21].boss).toBe('keeper');
    expect(FLOOR_PLANS[21].finale).toBe(false);
    expect(FLOOR_PLANS[22].boss).toBe('first_memory');
    expect(FLOOR_PLANS[22].finale).toBe(true);
    expect(FLOOR_PLANS[22].trialName).toBe('The First Remembering');
    expect(FLOOR_PLANS[22].roster).toContain('obsidian_reaver');
    expect(FLOOR_PLANS[22].roster).toContain('first_echo');
  });

  it('keeps the rebuilt Keeper on the 192px boss frame', () => {
    const keeper = enemyDef('keeper', true);
    expect(keeper.sprite).toBe('keeper');
    expect(keeper.displayHeight).toBe(192);
  });

  it('makes the First Memory a final boss and keeps it out of arenas', () => {
    const boss = enemyDef('first_memory', true);
    expect(boss.archetype).toBe('boss');
    expect(boss.behavior).toBe('final_boss');
    expect(boss.sprite).toBe('keeper');
    expect(boss.displayHeight).toBeLessThanOrEqual(200);
    expect(boss.displayHeight).toBeGreaterThanOrEqual(180);
    expect(boss.maxHealth).toBeGreaterThan(enemyDef('keeper', true).maxHealth);
    for (let depth = 0; depth < FLOOR_PLANS.length; depth++)
      expect(arenaBossFor(depth)).not.toBe('first_memory');
  });

  it('groups the First Remembering fragment into its own core memory', () => {
    expect(MEMORY_FRAGMENTS.some((f) => f.id === 'fragment_first')).toBe(true);
    expect(CORE_MEMORIES.some((c) => c.title === 'The First Remembering')).toBe(true);
  });
});
