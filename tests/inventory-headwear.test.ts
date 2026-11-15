import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import equipmentJson from '../src/data/equipment.json';
import {
  EQUIPMENT,
  EQUIPMENT_SLOTS,
  INVENTORY_SLOTS,
  applyEquipment,
  emptyEquipment,
  equipmentDef,
  type EquipmentSlot,
} from '../src/sim/equipment';
import { createRun, restoreRun } from '../src/sim/run';
import { BASE_STATS } from '../src/sim/upgrades';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');
const HEAD_IDS = ['scout_hood', 'iron_helm', 'oracle_circlet', 'void_visor'];

describe('headwear is a worn slot of its own', () => {
  it('adds a head slot beside weapon, armor and trinket', () => {
    expect(EQUIPMENT_SLOTS).toEqual(['weapon', 'armor', 'trinket', 'head']);
    expect(emptyEquipment().head).toBeNull();
  });

  it('ships four head relics, each with mods and a description', () => {
    const heads = (equipmentJson as { items: Array<{ id: string; slot: string }> }).items.filter(
      (item) => item.slot === 'head'
    );
    expect(heads.map((item) => item.id).sort()).toEqual([...HEAD_IDS].sort());
    for (const id of HEAD_IDS) {
      const def = equipmentDef(id);
      expect(def.slot, id).toBe('head');
      expect(def.description.length, id).toBeGreaterThan(0);
      expect(Object.keys(def.mods).length, id).toBeGreaterThan(0);
    }
    expect(EQUIPMENT.every((def) => EQUIPMENT_SLOTS.includes(def.slot))).toBe(true);
  });

  it('applies a head relic to the worn stats', () => {
    const stats = applyEquipment(
      { ...BASE_STATS },
      { ...emptyEquipment(), head: { uid: 1, defId: 'iron_helm' } }
    );
    expect(stats.maxHealth).toBe(BASE_STATS.maxHealth + 12);
    expect(stats.damageReduction).toBeCloseTo(0.04);
    expect(stats.moveSpeed).toBeCloseTo(BASE_STATS.moveSpeed * 0.97);
  });

  it('grows the bag to twenty carried relics', () => {
    expect(INVENTORY_SLOTS).toBe(20);
  });
});

describe('headwear reaches the doll, the CSS and old saves', () => {
  it('draws a head box on the paper doll', () => {
    const grid = read('../src/ui/InventoryGrid.ts');
    const css = read('../src/ui/ui.css');
    expect(grid).toContain('EQUIPMENT_SLOTS.map');
    expect(css).toContain('.doll .slot-head');
    expect(css).toMatch(/grid-template-areas:[\s\S]*'head figure armor'/);
  });

  it('loads a save without a head key and keeps a worn head relic', () => {
    const older = JSON.parse(JSON.stringify(createRun(1, []))) as {
      player: { equipment: Record<string, unknown> };
    };
    delete older.player.equipment.head;
    const restored = restoreRun(older);
    expect(restored?.player.equipment.head).toBeNull();

    const withHead = JSON.parse(JSON.stringify(createRun(1, []))) as {
      player: { equipment: Record<string, unknown> };
    };
    withHead.player.equipment.head = { uid: 77, defId: 'void_visor' };
    expect(restoreRun(withHead)?.player.equipment.head?.defId).toBe('void_visor');
  });

  it('parses the head drop target like the other slots', () => {
    const drag = read('../src/ui/inventoryDrag.ts');
    expect(drag).toContain("value === 'slot:head'");
    expect(drag).toContain("value.slice(5) as EquipmentSlot");
    const slot: EquipmentSlot = 'head';
    expect(slot).toBe('head');
  });
});
