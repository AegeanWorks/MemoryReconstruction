import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FINAL_DEPTH, FLOOR_PLANS, guardianIds } from '../src/sim/content';
import { RUN_VERSION, createRun, restoreRun } from '../src/sim/run';
import { checkpointDepths } from '../src/sim/hub';
import { World } from '../src/sim/world';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('two new vaults before the Sanctuary', () => {
  it('extends the descent by two sections', () => {
    expect(FLOOR_PLANS).toHaveLength(27);
    expect(FINAL_DEPTH).toBe(26);
    expect(FLOOR_PLANS.map((plan) => plan.depth)).toEqual(Array.from({ length: 27 }, (_, i) => i));
  });

  it('names the two vaults and gives them hive and storm rosters', () => {
    const chitin = FLOOR_PLANS[23];
    const thunder = FLOOR_PLANS[24];
    expect(chitin.trialName).toBe('The Chitin Vault');
    expect(chitin.biome).toBe('hive');
    expect(chitin.boss).toBe('chitin_sovereign');
    expect(chitin.roster).toContain('hive_guard');
    expect(thunder.trialName).toBe('The Thunder Vault');
    expect(thunder.biome).toBe('storm');
    expect(thunder.boss).toBe('storm_sovereign');
    expect(thunder.roster).toContain('thunder_brute');
    // Both are real guardians, not trials.
    for (const plan of [chitin, thunder]) {
      expect(guardianIds()).toContain(plan.boss);
      expect(plan.finale).toBe(false);
      expect(plan.bossOnly).toBeUndefined();
      expect(plan.roomCount).toBeGreaterThan(10);
    }
  });

  it('keeps the Sanctuary and the finale last', () => {
    expect(FLOOR_PLANS[25].biome).toBe('sanctuary');
    expect(FLOOR_PLANS[25].boss).toBe('keeper');
    expect(FLOOR_PLANS[26].finale).toBe(true);
    expect(FLOOR_PLANS[26].boss).toBe('first_memory');
  });

  it('builds both vaults as playable floors', () => {
    for (const depth of [23, 24]) {
      const run = createRun(4321, []);
      run.depth = depth;
      const world = new World(run);
      expect(world.floor.rooms.length).toBeGreaterThan(5);
      expect(world.floor.rooms.some((room) => room.kind === 'boss')).toBe(true);
    }
  });

  it('adds the deeper vaults to the checkpoint ladder', () => {
    const depths = checkpointDepths();
    expect(depths[depths.length - 1]).toBe(FINAL_DEPTH);
    expect(depths).toContain(24);
  });
});

describe('runs saved before the vaults keep their floor', () => {
  it('writes the new run version', () => {
    expect(RUN_VERSION).toBe(2);
    expect(createRun(1, []).version).toBe(2);
  });

  it('shifts a version-1 Sanctuary run forward two sections', () => {
    const old = { ...createRun(7, []), version: 1 as const, depth: 23 };
    const restored = restoreRun(JSON.parse(JSON.stringify(old)))!;
    expect(restored.depth).toBe(25);
    expect(restored.version).toBe(2);
  });

  it('shifts a version-1 finale run forward two sections', () => {
    const old = { ...createRun(7, []), version: 1 as const, depth: 24 };
    expect(restoreRun(JSON.parse(JSON.stringify(old)))!.depth).toBe(26);
  });

  it('leaves earlier version-1 floors where they were', () => {
    const old = { ...createRun(7, []), version: 1 as const, depth: 12 };
    expect(restoreRun(JSON.parse(JSON.stringify(old)))!.depth).toBe(12);
  });

  it('leaves a version-2 run alone', () => {
    const run = { ...createRun(7, []), depth: 23 };
    expect(restoreRun(JSON.parse(JSON.stringify(run)))!.depth).toBe(23);
  });

  it('documents the migration in the source', () => {
    const source = read('../src/sim/run.ts');
    expect(source).toContain('LATER_FLOORS_ADDED');
    expect(source).toContain('SANCTUARY_DEPTH_V1');
  });
});
