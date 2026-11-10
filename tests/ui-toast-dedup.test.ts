import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = readFileSync(join(__dirname, '../src/app/App.ts'), 'utf8');

describe('combat toast deduplication', () => {
  it('deduplicates roomLocked toast when tutorial tip is active on the first run', () => {
    // Asserts that App.ts filters or prevents double roomLocked toast to hud
    expect(app).toMatch(/!this\.tipRoom\s*&&\s*this\.meta\.runs\s*===\s*0/);
    expect(app).toContain('events.filter((e) => e.type !== \'roomLocked\')');
  });
});
