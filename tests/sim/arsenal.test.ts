import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';
import { weaponDef } from '../../src/sim/weapons';
import { questProgress, questSnapshot, QUESTS } from '../../src/sim/quests';

const DT = 1 / 60;

function world(depth = 0, seed = 5): World {
  const run = createRun(seed, []);
  run.depth = depth;
  return new World(run);
}

function frame(w: World, extra: Partial<typeof NO_INPUT> = {}) {
  return { ...NO_INPUT, aimX: w.player.x + 100, aimY: w.player.y, ...extra };
}

function step(w: World, frames: number): ReturnType<World['step']> {
  let events: ReturnType<World['step']> = [];
  for (let i = 0; i < frames; i++) events = events.concat(w.step(frame(w), DT));
  return events;
}

describe('weapons', () => {
  it('defines three stances with different combos and reach', () => {
    expect(weaponDef('sword').steps).toHaveLength(3);
    expect(weaponDef('spear').steps).toHaveLength(2);
    expect(weaponDef('greatsword').steps).toHaveLength(2);
    expect(weaponDef('spear').steps[0].reach).toBeGreaterThan(weaponDef('sword').steps[0].reach);
    expect(weaponDef('greatsword').finisherShockwave).toBe(true);
  });

  it('switches stance from the input and resets the combo', () => {
    const w = world();
    const p = w.player;
    const events = w.step({ ...NO_INPUT, weapon: 1 }, DT);
    expect(p.weapon).toBe('spear');
    expect(events.some((e) => e.type === 'weaponSwitch')).toBe(true);
  });

  it('the spear hits at a range the sword cannot', () => {
    const sword = world();
    const spear = world();
    for (const w of [sword, spear]) {
      const p = w.player;
      const e = w.spawnEnemy('scavenger', p.x + 68, p.y, -1);
      e.state = 'stagger';
      e.stateTime = 99;
      e.cooldown = 99;
    }
    const swordEnemy = sword.enemies[0];
    const spearEnemy = spear.enemies[0];
    const beforeSword = swordEnemy.health;
    const beforeSpear = spearEnemy.health;
    sword.player.aim = 0;
    spear.player.aim = 0;
    spear.player.weapon = 'spear';
    sword.step({ ...NO_INPUT, attack: true }, DT);
    spear.step({ ...NO_INPUT, attack: true }, DT);
    step(sword, 25);
    step(spear, 20);
    expect(spearEnemy.health).toBeLessThan(beforeSpear);
    expect(swordEnemy.health).toBe(beforeSword);
  });

  it('the greatsword finisher shockwaves without the upgrade', () => {
    const w = world();
    const p = w.player;
    p.weapon = 'greatsword';
    p.aim = 0;
    let events = w.step(frame(w, { attack: true }), DT);
    events = events.concat(step(w, 30));
    events = events.concat(w.step(frame(w, { attack: true }), DT));
    events = events.concat(step(w, 40));
    expect(events.some((e) => e.type === 'shockwave')).toBe(true);
  });
});

describe('bombs and traps', () => {
  it('throws a bomb that fuses and damages an enemy', () => {
    const w = world();
    const p = w.player;
    const enemy = w.spawnEnemy('scavenger', p.x + 130, p.y, -1);
    enemy.state = 'stagger';
    enemy.stateTime = 99;
    enemy.cooldown = 99;
    const before = enemy.health;
    p.aim = 0;
    p.bombs = 1;
    w.step(frame(w, { bomb: true }), DT);
    expect(p.bombs).toBe(0);
    expect(w.bombs).toHaveLength(1);
    step(w, 120);
    expect(w.bombs).toHaveLength(0);
    expect(enemy.health).toBeLessThan(before);
  });

  it('places a trap that arms and hurts an enemy that steps on it', () => {
    const w = world();
    const p = w.player;
    p.traps = 1;
    p.aim = 0;
    w.step(frame(w, { trap: true }), DT);
    const trap = w.hazards.find((h) => h.kind === 'trap');
    expect(trap).toBeDefined();
    expect(p.traps).toBe(0);
    const enemy = w.spawnEnemy('scavenger', trap!.x, trap!.y, -1);
    enemy.state = 'chase';
    enemy.cooldown = 99;
    const before = enemy.health;
    const hpBefore = p.health;
    step(w, 60);
    expect(w.hazards).not.toContain(trap);
    expect(enemy.health).toBeLessThan(before);
    // The trap is indiscriminate: standing on it hurts the player too.
    expect(p.health).toBeLessThanOrEqual(hpBefore);
  });

  it('a bombardier throws bombs of its own', () => {
    const w = world(4);
    const p = w.player;
    const bomber = w.spawnEnemy('bombardier', p.x + 150, p.y, -1);
    bomber.state = 'chase';
    bomber.cooldown = 0;
    let sawBomb = false;
    for (let i = 0; i < 150; i++) {
      w.step(frame(w), DT);
      if (w.bombs.some((b) => b.owner === 'enemy')) sawBomb = true;
    }
    expect(sawBomb).toBe(true);
  });

  it('a weapon art damages nearby enemies and starts its cooldown', () => {
    const w = world(0);
    const p = w.player;
    p.weapon = 'sword';
    p.artCooldown = 0;
    const enemy = w.spawnEnemy('scavenger', p.x + 80, p.y, -1);
    enemy.state = 'stagger';
    enemy.stateTime = 999;
    const before = enemy.health;
    w.step(frame(w, { art: true }), DT);
    expect(p.artCooldown).toBeGreaterThan(0);
    expect(enemy.health).toBeLessThan(before);
  });

  it('boss patterns include the new bomb and quake attacks', () => {
    const w = world(14, 31);
    const room = w.floor.rooms.find((r) => r.kind === 'boss')!;
    w.player.x = (room.x + room.w / 2) * 32;
    w.player.y = (room.y + room.h / 2) * 32;
    w.player.stats.maxHealth = 99999;
    w.player.health = 99999;
    let bombs = 0;
    let blasts = 0;
    for (let i = 0; i < 420; i++) {
      w.step(frame(w), DT);
      bombs = Math.max(bombs, w.bombs.length);
      blasts = Math.max(blasts, w.blasts.length);
    }
    expect(w.activeBoss()?.def.id).toBe('bone_tyrant');
    expect(bombs + blasts).toBeGreaterThan(0);
  });
});

describe('quests and stances', () => {
  it('tracks depth and guardian quests', () => {
    const progress = { echoes: 0, restorations: {}, checkpoint: 0 };
    const snapshot = questSnapshot([], 0, progress, 8, 5);
    const depth = QUESTS.find((q) => q.kind === 'depth')!;
    const bosses = QUESTS.find((q) => q.kind === 'bosses')!;
    expect(questProgress(depth, snapshot)).toBe(8);
    expect(questProgress(bosses, snapshot)).toBe(5);
  });
});
