import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { floorTone } from '../src/view/palette';

const level = readFileSync(join(__dirname, '../src/view/LevelView.ts'), 'utf8');
const grey = (c: number) => c & 255;

describe('floor tone patches', () => {
  it('is deterministic and stays a gentle grey multiply (never below 0xd8)', () => {
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++) {
        const t = floorTone(x, y);
        expect(t).toBe(floorTone(x, y));
        expect(grey(t)).toBeGreaterThanOrEqual(0xd8);
        expect(grey(t)).toBeLessThanOrEqual(0xff);
        expect(t >> 16).toBe(grey(t));
      }
  });

  it('changes smoothly between neighbouring tiles', () => {
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < 30; x++)
        expect(Math.abs(grey(floorTone(x, y)) - grey(floorTone(x + 1, y)))).toBeLessThanOrEqual(10);
  });

  it('varies across a room-sized area so floors read as worn patches', () => {
    const seen = new Set<number>();
    for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) seen.add(grey(floorTone(x, y)));
    expect(seen.size).toBeGreaterThanOrEqual(12);
  });

  it('tints floor tiles in the level view', () => {
    expect(level).toContain('floorTone(tx, ty)');
  });
});
