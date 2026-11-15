import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import equipmentJson from '../src/data/equipment.json';
import {
  EQUIPMENT,
  EQUIPMENT_SLOTS,
  applyEquipment,
  emptyEquipment,
  equipmentDef,
} from '../src/sim/equipment';
import { BASE_STATS } from '../src/sim/upgrades';
import { CAPE_LOOKS, gearLooks } from '../src/view/gearLook';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');
const CAPE_IDS = ['tattered_cloak', 'tidecloak', 'ember_drape', 'void_mantle'];

describe('a cape is a worn relic of its own', () => {
  it('sits beside the other worn slots', () => {
    expect(EQUIPMENT_SLOTS).toEqual(['weapon', 'armor', 'trinket', 'head', 'cape']);
    expect(emptyEquipment().cape).toBeNull();
  });

  it('ships four capes with mods and a description', () => {
    const capes = (equipmentJson as { items: Array<{ id: string; slot: string }> }).items.filter(
      (item) => item.slot === 'cape'
    );
    expect(capes.map((item) => item.id).sort()).toEqual([...CAPE_IDS].sort());
    for (const id of CAPE_IDS) {
      const def = equipmentDef(id);
      expect(def.slot, id).toBe('cape');
      expect(def.description.length, id).toBeGreaterThan(0);
      expect(Object.keys(def.mods).length, id).toBeGreaterThan(0);
    }
    expect(EQUIPMENT.every((def) => EQUIPMENT_SLOTS.includes(def.slot))).toBe(true);
  });

  it('applies a cape to the worn stats', () => {
    const stats = applyEquipment(
      { ...BASE_STATS },
      { ...emptyEquipment(), cape: { uid: 1, defId: 'tidecloak' } }
    );
    expect(stats.maxMana).toBe(BASE_STATS.maxMana + 8);
    expect(stats.manaRegen).toBeCloseTo(BASE_STATS.manaRegen + 1);
    expect(stats.damageReduction).toBeCloseTo(0.02);
  });
});

describe('the cape changes the wanderer’s colours', () => {
  it('has a look for every cape so none silently stays cyan', () => {
    for (const id of CAPE_IDS) expect(CAPE_LOOKS[id], id).toBeDefined();
  });

  it('reports the worn cape through gearLooks', () => {
    const looks = gearLooks({ ...emptyEquipment(), cape: { uid: 1, defId: 'void_mantle' } });
    expect(looks.capeId).toBe('void_mantle');
    expect(looks.cape).toEqual(CAPE_LOOKS.void_mantle);
  });

  it('paints the doll and the actor through the same cape-aware layer', () => {
    const grid = read('../src/ui/InventoryGrid.ts');
    const actor = read('../src/view/ActorView.ts');
    const art = read('../src/ui/dollArt.ts');
    expect(grid).toContain('looks.cape');
    expect(actor).toContain('looks.cape');
    expect(art).toContain('recolorCapePixels');
  });

  it('lays out a cape box on the doll', () => {
    const css = read('../src/ui/ui.css');
    expect(css).toContain('.doll .slot-cape');
    expect(css).toMatch(/grid-template-areas:[\s\S]*'cape figure trinket'/);
  });

  it('lets a cape drop onto its slot', () => {
    const drag = read('../src/ui/inventoryDrag.ts');
    expect(drag).toContain("value === 'slot:cape'");
  });

  it('no longer clips the bag panel at the old 460px height', () => {
    const css = read('../src/ui/ui.css');
    const start = css.indexOf('.gear-panel {');
    const panel = css.slice(start, start + 240);
    expect(panel).not.toContain('min(60vh, 460px)');
    expect(panel).not.toContain('max-height: min(60vh');
  });
});
