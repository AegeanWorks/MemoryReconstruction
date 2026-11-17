import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import equipmentJson from '../src/data/equipment.json';
import relicColors from '../src/data/relic_colors.json';
import { ARMOR_LOOKS, CAPE_LOOKS } from '../src/view/gearLook';

const items = (equipmentJson as { items: Array<{ id: string; slot: string; name: string }> }).items;
const colors = relicColors as Record<string, { hue: number; sat: number; val: number }>;

const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe('worn gear takes its colour from its own icon', () => {
  it('records a colour for every armor and cape icon', () => {
    for (const item of items.filter((i) => i.slot === 'armor' || i.slot === 'cape')) {
      expect(colors[item.id], `no colour for ${item.id}`).toBeDefined();
      expect(colors[item.id].hue, item.id).toBeGreaterThanOrEqual(0);
      expect(colors[item.id].val, item.id).toBeGreaterThan(0);
    }
  });

  it('leans every armor look towards the hue its icon is drawn in', () => {
    for (const item of items.filter((i) => i.slot === 'armor')) {
      const look = ARMOR_LOOKS[item.id];
      const icon = colors[item.id];
      expect(
        hueDistance(look.hue, icon.hue),
        `${item.id}: look hue ${look.hue} vs icon hue ${icon.hue}`
      ).toBeLessThanOrEqual(12);
    }
  });

  it('leans every cape look towards its icon hue too', () => {
    for (const item of items.filter((i) => i.slot === 'cape')) {
      const look = CAPE_LOOKS[item.id];
      const icon = colors[item.id];
      expect(hueDistance(look.hue, icon.hue), item.id).toBeLessThanOrEqual(12);
    }
  });

  it('generates the colour manifest from the icon script so it cannot drift', () => {
    const script = readFileSync(join(__dirname, '../scripts/generate_relic_icons.py'), 'utf8');
    expect(script).toContain('relic_colors.json');
    expect(script).toContain('dominantColor');
  });

  it('never paints two armors the same robe colour', () => {
    const seen = new Map<string, string>();
    for (const [id, look] of Object.entries(ARMOR_LOOKS)) {
      const key = `${Math.round(look.hue)}|${look.sat.toFixed(2)}`;
      expect(seen.get(key), `${id} matches ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });
});

describe('weapon relics are named for what they are', () => {
  it('names each weapon relic after a real stance weapon', () => {
    const weapons = items.filter((item) => item.slot === 'weapon');
    const byId = new Map(weapons.map((item) => [item.id, item.name]));
    expect(byId.get('rusted_edge')).toBe('Rusted Arming Sword');
    expect(byId.get('echo_dagger')).toBe('Echo Dagger');
    expect(byId.get('choir_staff')).toBe('Choir Glaive');
    expect(byId.get('void_cleaver')).toBe('Void Cleaver');
    expect(byId.get('ember_core')).toBe('Emberfang');
  });

  it('locks every weapon relic to a stance it is named for', () => {
    const weapons = equipmentJson.items.filter((item) => item.slot === 'weapon') as Array<{
      id: string;
      restrictTo?: string[];
    }>;
    const allowed = new Set(['sword', 'spear', 'greatsword']);
    for (const weapon of weapons) {
      expect(weapon.restrictTo, weapon.id).toBeDefined();
      expect(weapon.restrictTo!.length, weapon.id).toBeGreaterThan(0);
      for (const stance of weapon.restrictTo!) expect(allowed.has(stance), weapon.id).toBe(true);
    }
  });

  it('calls the heavy stance a long sword in the stance table', () => {
    const weapons = readFileSync(join(__dirname, '../src/sim/weapons.ts'), 'utf8');
    expect(weapons).toContain("name: 'Long Sword'");
  });
});
