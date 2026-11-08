import { describe, expect, it } from 'vitest';
import { applyQuestClaim, questDef } from '../../src/sim/quests';
import { shade } from '../../src/view/tileArt';
import { createRun } from '../../src/sim/run';
import { NO_INPUT } from '../../src/sim/entities';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

describe('stage3 verified fixes', () => {
  // Terrace note: fixed by ADR-108. terraceCells() used to emit 16 entries
  // with (5,3) and (1,4) duplicated; it now dedupes to 14 unique cells, and
  // the seed-99 duelist fixture moved from +120 to +80 because the cleaned
  // start room placed +120 inside a wall.
  it('refuses to pay a quest twice', () => {
    const quest = questDef('edges')!;
    const base = {
      echoes: 0,
      vault: [] as string[],
      trust: {} as Record<string, number>,
      quests: { accepted: ['edges'], claimed: [] as string[], acceptedAt: {} as Record<string, number> },
      trustGifted: [] as string[],
    };
    const once = applyQuestClaim(base, 'smith', quest);
    expect(once.quests.claimed).toEqual(['edges']);
    expect(() => applyQuestClaim({ ...once, quests: { ...once.quests } }, 'smith', quest)).toThrow();
  });

  it('shade clamps out-of-range amounts to valid hex', () => {
    expect(shade('#808080', 2)).toMatch(/^#[0-9a-f]{6}$/);
    expect(shade('#808080', -2)).toMatch(/^#[0-9a-f]{6}$/);
    expect(() => shade('red', 0.5)).toThrow();
  });

  // Volley note (S2 claim dropped on verification): isolated World harness
  // fires 5 projectiles, not 4 — float dust makes before=-1 on the first
  // tick (extra stale-aim shot at fraction 0) while after=5 is suppressed.
  // Net count matches the "five shots" comment but mistimed; needs a
  // designer decision (clamp before>=0 vs allow after=5), so filed as
  // deferred, not fixed here.
  it('volley fires five projectiles across its phase (locked behavior)', () => {
    const run = createRun(7, []);
    const w = new World(run);
    w.enemies.length = 0;
    const p = w.player;
    p.invulnerable = 9999;
    const e = w.spawnEnemy('spirit', p.x + 200, p.y, -1);
    e.state = 'attack';
    e.attack = 'volley';
    (e as unknown as { stateTime: number }).stateTime = 0.5;
    let fired = 0;
    const orig = w.spawnProjectile.bind(w);
    w.spawnProjectile = ((proj: Parameters<typeof orig>[0]) => {
      fired++;
      return orig(proj);
    }) as typeof orig;
    for (let i = 0; i < 40; i++) w.step(NO_INPUT, DT);
    expect(fired).toBe(5);
  });
});
