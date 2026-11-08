import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const view = readFileSync(join(__dirname, '../src/view/LevelView.ts'), 'utf8');
const renderer = readFileSync(join(__dirname, '../src/view/Renderer.ts'), 'utf8');
const start = view.indexOf('private drawDoors(');
const end = view.indexOf('destroy()', start);
const body = view.slice(start, end);

describe('cleared spawn gates read as spent', () => {
  it('receives a room-phase lookup from the renderer', () => {
    expect(view).toContain('roomPhase?');
    expect(renderer).toContain('(id) => world.rooms[id]?.phase');
  });

  it('washes a cleared gate after its art', () => {
    expect(body).toContain("const cleared = this.roomPhase?.(room.id) === 'cleared'");
    expect(body).toContain(
      'if (cleared) g.rect(px, py, T, T).fill({ color: 0x05040a, alpha: 0.55 })'
    );
  });
});
