import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function denied(events: unknown[], action: string): boolean {
  return (events as Array<Record<string, unknown>>).some(
    (event) => event.type === 'actionDenied' && event.action === action
  );
}

describe('denied actions emit a cue event', () => {
  it('reports a dash with no charges', () => {
    const world = new World(createRun(7, []));
    world.enemies.length = 0;
    world.player.dashCharges = 0;
    const events = world.step({ ...NO_INPUT, dash: true, moveX: 1 }, DT);
    expect(denied(events, 'dash')).toBe(true);
  });

  it('reports a bolt without mana', () => {
    const world = new World(createRun(7, []));
    world.enemies.length = 0;
    world.player.mana = 0;
    world.player.boltCooldown = 0;
    const events = world.step({ ...NO_INPUT, bolt: true }, DT);
    expect(denied(events, 'bolt')).toBe(true);
  });

  it('has a Sound case for the denied event', () => {
    const sound = readFileSync(join(__dirname, '../../src/audio/Sound.ts'), 'utf8');
    expect(sound).toContain("case 'actionDenied'");
  });
});
