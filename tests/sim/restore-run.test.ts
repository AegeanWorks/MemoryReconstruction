import { describe, expect, it } from 'vitest';
import { createRun, restoreRun } from '../../src/sim/run';

function snapshot(overrides: Record<string, unknown> = {}): unknown {
  const run = createRun(7, []);
  const raw = JSON.parse(JSON.stringify({ ...run, ...overrides })) as Record<string, unknown>;
  return raw;
}

describe('restoreRun (a corrupt snapshot degrades, never crashes)', () => {
  it('rejects a snapshot with no stats instead of throwing', () => {
    const raw = snapshot() as Record<string, unknown>;
    delete raw['stats'];
    let result: unknown = 'threw';
    try {
      result = restoreRun(raw);
    } catch {
      result = 'threw';
    }
    expect(result).toBeUndefined();
  });

  it('defaults missing counters and fragment lists to zeros and empty', () => {
    const raw = snapshot({
      stats: { kills: 5 },
      fragmentsFound: undefined,
      knownFragments: undefined,
    });
    const run = restoreRun(raw);
    expect(run).toBeDefined();
    expect(run!.stats.kills).toBe(5);
    expect(run!.stats.elapsed).toBe(0);
    expect(run!.stats.damageDealt).toBe(0);
    expect(run!.stats.roomsCleared).toBe(0);
    expect(run!.stats.grazes).toBe(0);
    expect(run!.fragmentsFound).toEqual([]);
    expect(run!.knownFragments).toEqual([]);
  });

  it('never loads NaN vitals when mana or dash charges are missing', () => {
    const raw = snapshot() as Record<string, unknown>;
    const player = { ...(raw['player'] as Record<string, unknown>) };
    delete player['mana'];
    delete player['dashCharges'];
    raw['player'] = player;
    const run = restoreRun(raw);
    expect(run).toBeDefined();
    expect(Number.isNaN(run!.player.mana)).toBe(false);
    expect(Number.isNaN(run!.player.dashCharges)).toBe(false);
    expect(run!.player.dashCharges).toBeGreaterThan(0);
  });

  it('round-trips a healthy snapshot unchanged', () => {
    const run = restoreRun(snapshot());
    expect(run?.seed).toBe(7);
    expect(run?.depth).toBe(0);
    expect(run?.player.health).toBeGreaterThan(0);
    expect(run?.fragmentsFound).toEqual([]);
  });
});
