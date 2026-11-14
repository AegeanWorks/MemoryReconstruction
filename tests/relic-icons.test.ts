import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import equipmentJson from '../src/data/equipment.json';
const items = (equipmentJson as { items: Array<{ id: string }> }).items;
const icon = (id: string): string => join(__dirname, `../assets/sprites/ui/relic_${id}.png`);
/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(1, 4).toString('latin1'), 'not a PNG').toBe('PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
describe('every relic has its own icon', () => {
  it('ships a 64 px icon for each relic in equipment.json', () => {
    for (const { id } of items) {
      expect(existsSync(icon(id)), `missing relic_${id}.png`).toBe(true);
      expect(pngSize(readFileSync(icon(id))), id).toEqual({ w: 64, h: 64 });
    }
  });
  it('draws every icon differently', () => {
    const hashes = items.map(({ id }) => createHash('sha1').update(readFileSync(icon(id))).digest('hex'));
    expect(new Set(hashes).size).toBe(items.length);
  });
  it('shows the icon in the grid boxes and the list rows', () => {
    const grid = readFileSync(join(__dirname, '../src/ui/InventoryGrid.ts'), 'utf8');
    const screens = readFileSync(join(__dirname, '../src/ui/Screens.ts'), 'utf8');
    expect(grid).toContain('relicIconUrl(item.defId)');
    expect(screens).toContain('relicIconUrl(');
  });
  it('generates the icons from the project script, so they can be rebuilt', () => {
    const script = readFileSync(join(__dirname, '../scripts/generate_relic_icons.py'), 'utf8');
    expect(script).toContain('equipment.json');
    expect(script).toContain('relic_');
  });
});
