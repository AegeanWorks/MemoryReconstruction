import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import equipmentJson from '../src/data/equipment.json';
import { HEAD_LOOKS, gearLooks } from '../src/view/gearLook';
import { weaponDef } from '../src/sim/weapons';

const heads = (equipmentJson as { items: Array<{ id: string; slot: string }> }).items
  .filter((item) => item.slot === 'head')
  .map((item) => item.id);

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

const empty = { weapon: null, armor: null, trinket: null, head: null, cape: null };

describe('headwear silhouettes', () => {
  it('gives every head relic a shape and colours', () => {
    expect(heads.length).toBeGreaterThan(0);
    for (const id of heads) {
      const look = HEAD_LOOKS[id];
      expect(look, id).toBeDefined();
      expect(['hood', 'helm', 'circlet', 'visor'], id).toContain(look.shape);
      expect(look.color, id).toBeGreaterThanOrEqual(0);
      expect(look.trim, id).toBeGreaterThanOrEqual(0);
    }
  });

  it('uses all four silhouettes across the head set', () => {
    const shapes = new Set(heads.map((id) => HEAD_LOOKS[id].shape));
    expect(shapes.size).toBe(heads.length);
  });

  it('reports the worn head through gearLooks and ignores unknown ids', () => {
    const looks = gearLooks({ ...empty, head: { uid: 4, defId: 'iron_helm' } });
    expect(looks.headId).toBe('iron_helm');
    expect(looks.head).toEqual(HEAD_LOOKS.iron_helm);
    const unknown = gearLooks({ ...empty, head: { uid: 5, defId: 'mystery_cap' } });
    expect(unknown.head).toBeNull();
    expect(unknown.headId).toBeNull();
  });

  it('draws a silhouette above the player and names each shape', () => {
    const actor = read('../src/view/ActorView.ts');
    expect(actor).toContain('drawHeadwear');
    expect(actor).toContain("case 'hood'");
    expect(actor).toContain("case 'helm'");
    expect(actor).toContain("case 'circlet'");
    expect(actor).toContain("case 'visor'");
  });
});

describe('longer blades', () => {
  it('reaches further with the sword and the greatsword than before', () => {
    const sword = weaponDef('sword');
    const great = weaponDef('greatsword');
    expect(sword.steps[0].reach).toBe(60);
    expect(sword.steps[sword.steps.length - 1].reach).toBe(71);
    expect(great.steps[0].reach).toBe(75);
    expect(great.steps[great.steps.length - 1].reach).toBe(86);
    // Ordering is preserved: the spear still out-ranges both blades.
    expect(weaponDef('spear').steps[0].reach).toBeGreaterThan(great.steps[0].reach);
  });
});
