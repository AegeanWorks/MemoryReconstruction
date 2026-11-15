import { describe, expect, it } from 'vitest';
import equipmentJson from '../../src/data/equipment.json';
import { emptyEquipment } from '../../src/sim/equipment';
import { bankCarriedRelics, bankSummary, createRun, restoreRun } from '../../src/sim/run';
import { defaultMeta, recordRun } from '../../src/save/SaveStore';

const RELIC_IDS = (equipmentJson as { items: Array<{ id: string }> }).items.map((item) => item.id);

function carriedRun(): ReturnType<typeof createRun> {
  const run = createRun(7, []);
  run.player.equipment = {
    ...emptyEquipment(),
    weapon: { uid: 1, defId: 'echo_dagger' },
    head: { uid: 2, defId: 'iron_helm' },
  };
  run.player.inventory = [
    { uid: 3, defId: 'sun_core' },
    { uid: 4, defId: 'tide_lens' },
  ];
  return run;
}

describe('checkpoints bank carried relics', () => {
  it('starts every expedition with nothing banked', () => {
    expect(createRun(1, []).bankedRelics).toEqual([]);
  });

  it('copies worn and carried relics into the bank once per checkpoint', () => {
    const run = carriedRun();
    expect(bankCarriedRelics(run)).toBe(4);
    expect(new Set(run.bankedRelics)).toEqual(
      new Set(['echo_dagger', 'iron_helm', 'sun_core', 'tide_lens'])
    );
    // Reaching a later checkpoint must not bank the same relic twice, and must
    // pick up whatever was found since the last one.
    run.player.inventory.push({ uid: 5, defId: 'bog_crown' });
    expect(bankCarriedRelics(run)).toBe(1);
    expect(run.bankedRelics.filter((id) => id === 'sun_core')).toHaveLength(1);
    expect(run.bankedRelics).toContain('bog_crown');
  });

  it('keeps only banked relics when the walker dies before the next checkpoint', () => {
    const run = carriedRun();
    bankCarriedRelics(run);
    // Found after the checkpoint: lost on death.
    run.player.inventory.push({ uid: 5, defId: 'void_visor' });
    const meta = recordRun({ ...defaultMeta(), vault: [] }, run, false);
    expect(new Set(meta.vault)).toEqual(
      new Set(['echo_dagger', 'iron_helm', 'sun_core', 'tide_lens'])
    );
    expect(meta.vault).not.toContain('void_visor');
  });

  it('keeps everything carried when the expedition is won', () => {
    const run = carriedRun();
    // No checkpoint was reached at all; a victory still returns the kit.
    const meta = recordRun({ ...defaultMeta(), vault: [] }, run, true);
    expect(new Set(meta.vault)).toEqual(
      new Set(['echo_dagger', 'iron_helm', 'sun_core', 'tide_lens'])
    );
  });

  it('never drops a relic the sanctuary already keeps', () => {
    const run = carriedRun();
    bankCarriedRelics(run);
    const meta = recordRun({ ...defaultMeta(), vault: ['sun_core'] }, run, false);
    expect(meta.vault.filter((id) => id === 'sun_core')).toHaveLength(1);
  });

  it('loads an old snapshot without a bank as empty and drops phantom ids', () => {
    const raw = JSON.parse(JSON.stringify(createRun(9, []))) as Record<string, unknown>;
    delete raw.bankedRelics;
    expect(restoreRun(raw)?.bankedRelics).toEqual([]);

    const odd = JSON.parse(JSON.stringify(createRun(9, []))) as Record<string, unknown>;
    odd.bankedRelics = ['sun_core', 'not_a_relic', 42];
    const restored = restoreRun(odd)!;
    expect(restored.bankedRelics).toEqual(['sun_core']);
    expect(RELIC_IDS).toContain('sun_core');
  });
});

describe('checkpoint bank summary', () => {
  it('separates kept relics from those found since the checkpoint', () => {
    const run = carriedRun();
    expect(bankSummary(run)).toEqual({ kept: 0, atRisk: 4 });
    bankCarriedRelics(run);
    expect(bankSummary(run)).toEqual({ kept: 4, atRisk: 0 });
    run.player.inventory.push({ uid: 5, defId: 'void_visor' });
    expect(bankSummary(run)).toEqual({ kept: 4, atRisk: 1 });
  });

  it('counts duplicate relics once', () => {
    const run = carriedRun();
    run.player.inventory.push({ uid: 9, defId: 'sun_core' });
    const summary = bankSummary(run);
    expect(summary.atRisk).toBe(4);
    expect(summary.kept).toBe(0);
  });
});
