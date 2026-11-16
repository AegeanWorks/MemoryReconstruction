import { describe, expect, it } from 'vitest';
import {
  BURN_DPS,
  FREEZE_SLOW,
  MIN_MOVE_SCALE,
  MUD_SLOW,
  NO_STATUS,
  SHATTER_BONUS,
  applyStatus,
  damageScale,
  moveScale,
  normalizeStatus,
  shattersOnHit,
  statusLabel,
  tickStatus,
} from '../src/sim/status';
import { shotHitRadius } from '../src/sim/combat';
import { createEnemy } from '../src/sim/enemies';
import { enemyDef } from '../src/sim/content';
import { createPlayer } from '../src/sim/player';
import { restoreRun } from '../src/sim/run';

describe('status effects', () => {
  it('refreshes a timer instead of stacking it', () => {
    let status = applyStatus(NO_STATUS, 'burn', 2);
    status = applyStatus(status, 'burn', 3);
    expect(status.burn).toBe(3);
    status = applyStatus(status, 'burn', 1);
    expect(status.burn).toBe(3);
  });

  it('ticks every timer down and pays burn damage only while burning', () => {
    const lit = applyStatus(NO_STATUS, 'burn', 1);
    const first = tickStatus(lit, 0.5);
    expect(first.status.burn).toBeCloseTo(0.5);
    expect(first.burnDamage).toBeCloseTo(BURN_DPS * 0.5);
    const last = tickStatus(first.status, 0.5);
    expect(last.status.burn).toBe(0);
    const cold = tickStatus(NO_STATUS, 0.5);
    expect(cold.burnDamage).toBe(0);
  });

  it('slows without ever stopping movement', () => {
    expect(moveScale(NO_STATUS)).toBe(1);
    expect(moveScale(applyStatus(NO_STATUS, 'mud'))).toBe(MUD_SLOW);
    expect(moveScale(applyStatus(NO_STATUS, 'freeze'))).toBe(FREEZE_SLOW);
    const both = applyStatus(applyStatus(NO_STATUS, 'freeze'), 'mud');
    expect(moveScale(both)).toBe(Math.min(FREEZE_SLOW, MUD_SLOW));
    expect(moveScale(both)).toBeGreaterThanOrEqual(MIN_MOVE_SCALE);
  });

  it('pays a shatter bonus while frozen, then breaks the ice', () => {
    const frozen = applyStatus(NO_STATUS, 'freeze');
    expect(damageScale(frozen)).toBe(SHATTER_BONUS);
    expect(shattersOnHit(frozen)).toBe(true);
    expect(damageScale(NO_STATUS)).toBe(1);
    expect(shattersOnHit(NO_STATUS)).toBe(false);
  });

  it('reads junk and older saves as clear, capped timers', () => {
    expect(normalizeStatus(undefined)).toEqual(NO_STATUS);
    expect(normalizeStatus({ burn: -4, freeze: Number.NaN, mud: 500 })).toEqual({
      burn: 0,
      freeze: 0,
      mud: 60,
    });
  });

  it('labels the active effects for the HUD', () => {
    expect(statusLabel(NO_STATUS)).toBeUndefined();
    const lit = applyStatus(applyStatus(NO_STATUS, 'burn'), 'freeze');
    expect(statusLabel(lit)).toBe('Burning · Frozen');
  });
});

describe('bolt hit radius', () => {
  it('covers the drawn sprite width, never less than the body', () => {
    expect(shotHitRadius(10, 48)).toBeCloseTo(14.4);
    expect(shotHitRadius(10, 8)).toBe(10);
    expect(shotHitRadius(24, 192)).toBeCloseTo(57.6);
  });
});

describe('status wiring', () => {
  it('starts every walker and enemy clear', () => {
    expect(createPlayer(0, 0).status).toEqual(NO_STATUS);
    const enemy = createEnemy(1, enemyDef('memory_echo'), 0, 0, 0, { health: 1, damage: 1 }, false);
    expect(enemy.status).toEqual(NO_STATUS);
  });

  it('defaults a restored run without status fields to clear', () => {
    const player = createPlayer(0, 0);
    delete player.status;
    const run = {
      version: 1,
      seed: 1,
      depth: 0,
      player,
      stats: {},
      pendingChoices: [],
    };
    const restored = restoreRun(run);
    expect(restored?.player.status).toEqual(NO_STATUS);
  });
});
