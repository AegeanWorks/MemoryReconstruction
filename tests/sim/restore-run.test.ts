import { describe, expect, it } from 'vitest';
import { equipmentExists } from '../../src/sim/equipment';
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

  it('rebuilds a snapshot with no player stats instead of throwing', () => {
    const raw = snapshot() as Record<string, unknown>;
    const player = { ...(raw['player'] as Record<string, unknown>) };
    delete player['stats'];
    raw['player'] = player;
    let result: unknown = 'threw';
    try {
      result = restoreRun(raw);
    } catch {
      result = 'threw';
    }
    expect(result).not.toBe('threw');
    const run = result as NonNullable<ReturnType<typeof restoreRun>>;
    expect(run.player.stats.maxHealth).toBeGreaterThan(0);
    expect(Number.isFinite(run.player.health)).toBe(true);
    expect(run.player.health).toBeGreaterThan(0);
  });

  it('refills a non-finite health instead of loading NaN', () => {
    const raw = snapshot() as Record<string, unknown>;
    raw['player'] = { ...(raw['player'] as Record<string, unknown>), health: NaN };
    const run = restoreRun(raw as Record<string, unknown>);
    expect(run).toBeDefined();
    expect(Number.isNaN(run!.player.health)).toBe(false);
    expect(run!.player.health).toBe(run!.player.stats.maxHealth);
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

  it('validates the saved weapon id', () => {
    const raw = snapshot() as Record<string, unknown>;
    raw['player'] = { ...(raw['player'] as Record<string, unknown>), weapon: 'not_a_weapon' };
    expect(restoreRun(raw)?.player.weapon).toBe('sword');
    const spear = snapshot() as Record<string, unknown>;
    spear['player'] = { ...(spear['player'] as Record<string, unknown>), weapon: 'spear' };
    expect(restoreRun(spear)?.player.weapon).toBe('spear');
  });

  it('round-trips a healthy snapshot unchanged', () => {
    const run = restoreRun(snapshot());
    expect(run?.seed).toBe(7);
    expect(run?.depth).toBe(0);
    expect(run?.player.health).toBeGreaterThan(0);
    expect(run?.fragmentsFound).toEqual([]);
  });

  it('knows which relic ids exist', () => {
    expect(equipmentExists('rusted_edge')).toBe(true);
    expect(equipmentExists('not_a_relic')).toBe(false);
    expect(equipmentExists('')).toBe(false);
  });

  it('drops phantom upgrade options from a pending choice', () => {
    const raw = snapshot({
      pendingChoices: [
        null,
        { source: 'level' },
        { source: 'level', options: ['not_an_upgrade', 'vitality'] },
        { source: 'chest', options: ['also_gone'] },
      ],
    });
    const run = restoreRun(raw);
    expect(run).toBeDefined();
    expect(run!.pendingChoices).toHaveLength(2);
    expect(run!.pendingChoices[0].options).toEqual(['vitality']);
    expect(run!.pendingChoices[1].options).toEqual([]);
  });

  it('drops phantom relic defIds instead of loading a crashing bag', () => {
    const raw = snapshot({
      player: {
        ...(snapshot() as Record<string, unknown>)['player'] as Record<string, unknown>,
        inventory: [
          { uid: 1, defId: 'rusted_edge' },
          { uid: 2, defId: 'not_a_relic' },
        ],
        equipment: {
          weapon: { uid: 3, defId: 'echo_dagger' },
          armor: null,
          trinket: { uid: 4, defId: 'ghost_charm' },
        },
      },
    });
    const run = restoreRun(raw);
    expect(run).toBeDefined();
    expect(run!.player.inventory.map((i) => i.defId)).toEqual(['rusted_edge']);
    expect(run!.player.equipment.weapon?.defId).toBe('echo_dagger');
    expect(run!.player.equipment.trinket).toBeNull();
  });
});
