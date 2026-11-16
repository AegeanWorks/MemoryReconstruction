import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RELIC_SETS,
  activeSets,
  applyEquipment,
  emptyEquipment,
  equipmentDef,
  setForRelic,
  setMods,
  wornSetCount,
  type EquipmentSlots,
} from '../src/sim/equipment';
import { BASE_STATS } from '../src/sim/upgrades';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

function worn(ids: readonly string[]): EquipmentSlots {
  const equipment = emptyEquipment();
  for (const id of ids) equipment[equipmentDef(id).slot] = { uid: ids.indexOf(id) + 1, defId: id };
  return equipment;
}

describe('relic sets', () => {
  it('defines four three-piece sets with real, slot-distinct pieces', () => {
    expect(RELIC_SETS).toHaveLength(4);
    for (const set of RELIC_SETS) {
      expect(set.pieces, set.id).toHaveLength(3);
      const slots = set.pieces.map((id) => equipmentDef(id).slot);
      expect(new Set(slots).size, `${set.id} shares a slot`).toBe(3);
    }
  });

  it('maps each piece back to its set', () => {
    expect(setForRelic('ember_core')?.id).toBe('ashforged');
    expect(setForRelic('void_mantle')?.id).toBe('voidwrought');
    expect(setForRelic('rusted_edge')).toBeUndefined();
  });

  it('activates only at two pieces and counts three', () => {
    const one = activeSets(worn(['ember_core']));
    expect(one).toHaveLength(0);
    const two = activeSets(worn(['ember_core', 'ember_charm']));
    expect(two).toHaveLength(1);
    expect(two[0].count).toBe(2);
    const three = activeSets(worn(['ember_core', 'ember_charm', 'ember_drape']));
    expect(three[0].count).toBe(3);
  });

  it('adds the two-piece bonus to the stat block and the three-piece on top', () => {
    const plate = applyEquipment({ ...BASE_STATS }, worn(['colossus_plate']));
    const two = applyEquipment({ ...BASE_STATS }, worn(['colossus_plate', 'iron_helm']));
    // The helm's own +12 health plus the Reliquary two-piece +20.
    expect(two.maxHealth - plate.maxHealth).toBe(12 + 20);

    const three = applyEquipment(
      { ...BASE_STATS },
      worn(['colossus_plate', 'iron_helm', 'ember_ward'])
    );
    const withoutSet = applyEquipment({ ...BASE_STATS }, worn(['ember_ward']));
    // ember_ward's own +12 HP and +4% DR, plus the set's +8% DR.
    expect(three.maxHealth - two.maxHealth).toBe(withoutSet.maxHealth - BASE_STATS.maxHealth);
    expect(three.damageReduction).toBeCloseTo(
      two.damageReduction + (withoutSet.damageReduction - BASE_STATS.damageReduction) + 0.08,
      5
    );
  });

  it('reports the aggregate set mods', () => {
    const two = setMods(worn(['ember_core', 'ember_charm']));
    expect(two.meleeDamage).toBe(6);
    const three = setMods(worn(['ember_core', 'ember_charm', 'ember_drape']));
    expect(three.meleeDamage).toBe(6);
    expect(three.critMultiplier).toBeCloseTo(0.25);
    expect(setMods(worn(['ember_core']))).toEqual({});
  });

  it('counts one worn piece before the two-piece bonus starts', () => {
    const set = setForRelic('ember_core')!;
    expect(wornSetCount(set, worn(['ember_core']))).toBe(1);
    expect(wornSetCount(set, worn(['ember_core', 'ember_charm']))).toBe(2);
    expect(wornSetCount(set, worn(['ember_core', 'ember_charm', 'ember_drape']))).toBe(3);
    expect(wornSetCount(set, emptyEquipment())).toBe(0);
  });

  it('shows the set on the item sheet and a chip while worn', () => {
    const screens = read('../src/ui/Screens.ts');
    expect(screens).toContain('setForRelic');
    expect(screens).toContain('gear-set-bonus');
    expect(screens).toContain('set-chips');
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.set-chip {');
    expect(css).toContain('.gear-set {');
  });
});
