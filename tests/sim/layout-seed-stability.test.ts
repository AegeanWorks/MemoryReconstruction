import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(__dirname, '../../src/sim/dungeon.ts'), 'utf8');

describe('room layout roll keeps the random stream stable', () => {
  const start = src.indexOf('const layout = rng.pick([');
  const list = src.slice(start, src.indexOf('] as const);', start));
  const entries = list.match(/'[a-z]+'/g) ?? [];

  // Seven entries means one draw of seven, so every later roll on a seed is unchanged. It does not
  // freeze which layout a slot holds: replacing a slot changes the rooms that rolled it.
  it('draws from exactly seven layouts, so adding one never shifts every other room', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(entries).toHaveLength(7);
  });

  it('still offers the colonnade and the chicane', () => {
    expect(entries).toContain("'colonnade'");
    expect(entries).toContain("'chicane'");
  });

  it('has no layout branch that can no longer be rolled', () => {
    // 'open' is the empty room and has no branch of its own.
    for (const name of ['pillars', 'scatter', 'alcoves', 'ring', 'colonnade', 'chicane'])
      expect(src).toContain(`resolved === '${name}'`);
    expect(src).not.toContain("resolved === 'crossing'");
  });
});
