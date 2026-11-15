import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { placeBalloon } from '../src/ui/balloon';

const read = (path: string): string => readFileSync(join(__dirname, path), 'utf8');

describe('resident speech balloon placement', () => {
  it('hangs above the resident when the title band has room', () => {
    expect(placeBalloon(300, 360, 60, 720)).toEqual({ top: 300 });
  });

  it('pins the balloon to the top of the screen instead of below the resident', () => {
    // Resident rooms hold the camera at the top of the room, so there is no
    // room above the resident's head; the message still belongs at the top.
    const placement = placeBalloon(68, 230, 78, 720);
    expect(placement.top).toBe(92 + 78);
    expect(placement.top - 78).toBe(92);
  });

  it('keeps the balloon inside a short viewport', () => {
    const placement = placeBalloon(40, 180, 80, 200);
    expect(placement.top).toBeGreaterThanOrEqual(0);
    expect(placement.top - 80).toBeGreaterThanOrEqual(0);
    expect(placement.top).toBeLessThanOrEqual(200);
  });
});

describe('the balloon markup', () => {
  it('never flips below the resident', () => {
    const app = read('../src/app/App.ts');
    const css = read('../src/ui/ui.css');
    expect(app).not.toContain("classList.toggle('below'");
    expect(css).not.toContain('.npc-balloon.below {');
    expect(css).not.toContain('.npc-balloon.below::after');
  });
});
