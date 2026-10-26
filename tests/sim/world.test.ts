import { describe, expect, it } from 'vitest';
import { roomCentrePx } from '../../src/sim/dungeon';
import { FINAL_DEPTH, FLOOR_PLANS } from '../../src/sim/content';
import { NO_INPUT, type InputFrame } from '../../src/sim/entities';
import type { SimEvent } from '../../src/sim/events';
import { createRun, restoreRun, xpForLevel } from '../../src/sim/run';
import { TILE_SIZE } from '../../src/sim/tiles';
import { UPGRADES } from '../../src/sim/upgrades';
import { World } from '../../src/sim/world';

const DT = 1 / 60;

function newWorld(seed = 1234, depth = 0): World {
  const run = createRun(seed, []);
  run.depth = depth;
  return new World(run);
}

function stepFor(world: World, seconds: number, input: Partial<InputFrame> = {}): SimEvent[] {
  const events: SimEvent[] = [];
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) events.push(...world.step({ ...NO_INPUT, ...input }, DT));
  return events;
}

function teleportToRoom(world: World, kind: string): number {
  const room = world.floor.rooms.find((r) => r.kind === kind)!;
  const c = roomCentrePx(room);
  world.player.x = c.x;
  world.player.y = c.y + TILE_SIZE;
  return room.id;
}

function clearChoices(world: World): void {
  while (world.awaitingChoice) world.chooseUpgrade(world.run.pendingChoices[0].options[0]);
}

describe('World', () => {
  it('starts the player in the start room with no enemies', () => {
    const world = newWorld();
    expect(world.currentRoom()?.kind).toBe('start');
    expect(world.enemies).toHaveLength(0);
  });

  it('locks a combat room and spawns enemies when the player walks in', () => {
    const world = newWorld();
    const roomId = teleportToRoom(world, 'combat');
    const events = stepFor(world, 0.5);
    expect(events.some((e) => e.type === 'roomLocked' && e.roomId === roomId)).toBe(true);
    expect(world.enemies.length).toBeGreaterThan(0);
    const door = world.floor.rooms[roomId].doors[0].tiles[0];
    expect(world.grid.isSolid(door.x, door.y)).toBe(true);
  });

  it('unlocks the doors once every wave is dead', () => {
    const world = newWorld();
    const roomId = teleportToRoom(world, 'combat');
    const events: SimEvent[] = stepFor(world, 0.1);
    expect(world.rooms[roomId].phase).toBe('active');
    for (let i = 0; i < 4 && world.rooms[roomId].phase === 'active'; i++) {
      events.push(...stepFor(world, 1.2));
      for (const e of world.enemies) e.state = 'chase';
      for (const e of [...world.enemies]) world.damageEnemy(e, 99999, 'melee', false, 0);
      clearChoices(world);
      events.push(...stepFor(world, 1));
      clearChoices(world);
    }
    expect(world.rooms[roomId].phase).toBe('cleared');
    expect(events.some((e) => e.type === 'roomCleared')).toBe(true);
    const door = world.floor.rooms[roomId].doors[0].tiles[0];
    expect(world.grid.isSolid(door.x, door.y)).toBe(false);
  });

  it('lands a swing on an enemy in front and misses one behind', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const p = world.player;
    const front = world.spawnEnemy('scavenger', p.x + 36, p.y, -1);
    const behind = world.spawnEnemy('scavenger', p.x - 36, p.y, -1);
    front.state = behind.state = 'chase';
    front.cooldown = behind.cooldown = 99;
    stepFor(world, 0.25, { attack: true, aimX: p.x + 100, aimY: p.y });
    expect(front.health).toBeLessThan(front.maxHealth);
    expect(behind.health).toBe(behind.maxHealth);
  });

  it('chains three swings into a combo when attack is held', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const combos = stepFor(world, 1.2, {
      attack: true,
      aimX: world.player.x + 50,
      aimY: world.player.y,
    })
      .filter((e) => e.type === 'swing')
      .map((e) => (e.type === 'swing' ? e.combo : -1));
    expect(combos.slice(0, 3)).toEqual([0, 1, 2]);
  });

  it('makes the player invulnerable while dashing', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const p = world.player;
    world.step({ ...NO_INPUT, dash: true, moveX: 1 }, DT);
    expect(p.action).toBe('dash');
    world.damagePlayer(30, p.x + 10, p.y, 0);
    expect(p.health).toBe(p.stats.maxHealth);
  });

  it('spends mana on a bolt and refuses when mana is short', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const p = world.player;
    world.step({ ...NO_INPUT, bolt: true, aimX: p.x + 100, aimY: p.y }, DT);
    expect(world.projectiles).toHaveLength(1);
    expect(p.mana).toBeLessThan(p.stats.maxMana);
    p.mana = 1;
    p.boltCooldown = 0;
    world.step({ ...NO_INPUT, bolt: true, aimX: p.x + 100, aimY: p.y }, DT);
    expect(world.projectiles.filter((b) => b.owner === 'player').length).toBeLessThanOrEqual(1);
  });

  it('heals with a potion and consumes it', () => {
    const world = newWorld();
    const p = world.player;
    p.health = 20;
    world.step({ ...NO_INPUT, potion: true }, DT);
    expect(p.health).toBeGreaterThan(20);
    expect(p.potions).toBe(1);
  });

  it('pauses on a level-up until an upgrade is chosen', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const p = world.player;
    const e = world.spawnEnemy('scavenger', p.x + 30, p.y, -1);
    e.state = 'chase';
    p.xp = xpForLevel(1) - 1;
    world.damageEnemy(e, 99999, 'melee', false, 0);
    expect(world.awaitingChoice).toBe(true);
    const time = world.time;
    stepFor(world, 0.5);
    expect(world.time).toBe(time);
    const before = p.stats.maxHealth;
    const choice = world.run.pendingChoices[0];
    world.chooseUpgrade(choice.options[0]);
    expect(world.awaitingChoice).toBe(false);
    expect(p.upgrades[choice.options[0]]).toBe(1);
    if (choice.options[0] === 'vitality') expect(p.stats.maxHealth).toBe(before + 20);
  });

  it('opens a portal after the boss falls and exits through it', () => {
    const world = newWorld();
    const roomId = teleportToRoom(world, 'boss');
    stepFor(world, 1.5);
    const boss = world.activeBoss();
    expect(boss).toBeDefined();
    stepFor(world, 0.8);
    world.damageEnemy(boss!, 999999, 'melee', false, 0);
    clearChoices(world);
    stepFor(world, 1);
    expect(world.rooms[roomId].phase).toBe('cleared');
    const portal = world.interactables.find((i) => i.kind === 'portal')!;
    expect(portal).toBeDefined();
    // Standing on the rift does nothing until the player chooses to step through.
    world.player.x = portal.x;
    world.player.y = portal.y;
    expect(stepFor(world, 0.5).some((e) => e.type === 'floorExit')).toBe(false);
    const events = world.step({ ...NO_INPUT, interact: true }, DT);
    expect(events.some((e) => e.type === 'floorExit')).toBe(true);
    expect(world.exited).toBe(true);
  });

  it('builds every section with its planned biome, boss and rooms', () => {
    for (let depth = 0; depth < FLOOR_PLANS.length; depth++) {
      const run = createRun(400 + depth, []);
      run.depth = depth;
      const world = new World(run);
      expect(world.plan.biome).toBe(FLOOR_PLANS[depth].biome);
      expect(world.plan.boss).toBe(FLOOR_PLANS[depth].boss);
      if (FLOOR_PLANS[depth].bossOnly) {
        expect(world.floor.rooms).toHaveLength(1);
        expect(world.floor.bossRoom).toBe(0);
      } else {
        expect(world.floor.rooms.length).toBeGreaterThanOrEqual(5);
      }
      expect(world.floor.rooms[world.floor.bossRoom].kind).toBe('boss');
      expect(world.roster).toEqual(FLOOR_PLANS[depth].roster);
    }
  });

  it('declares victory after the final boss', () => {
    const world = newWorld(55, FINAL_DEPTH);
    teleportToRoom(world, 'boss');
    stepFor(world, 1.5);
    const boss = world.activeBoss()!;
    expect(boss.def.id).toBe('keeper');
    stepFor(world, 0.8);
    world.damageEnemy(boss, 999999, 'melee', false, 0);
    clearChoices(world);
    const events = stepFor(world, 3);
    expect(events.some((e) => e.type === 'victory')).toBe(true);
    expect(world.victory).toBe(true);
  });

  it('drops a memory fragment from the treasure chest', () => {
    const world = newWorld();
    teleportToRoom(world, 'treasure');
    const chest = world.interactables.find((i) => i.kind === 'chest')!;
    world.player.x = chest.x;
    world.player.y = chest.y + 20;
    world.step({ ...NO_INPUT, interact: true }, DT);
    expect(chest.used).toBe(true);
    expect(world.awaitingChoice).toBe(true);
    expect(world.pickups.some((p) => p.kind === 'fragment')).toBe(true);
  });

  it('routes a melee enemy around a pillar to reach the player', () => {
    const world = newWorld();
    const room = world.floor.rooms[world.floor.startRoom];
    const grid = world.grid;
    // A wall segment between enemy and player, open at both ends.
    const cx = room.x + Math.floor(room.w / 2);
    const cy = room.y + Math.floor(room.h / 2);
    for (let dy = -2; dy <= 2; dy++) grid.set(cx, cy + dy, 2);
    const p = world.player;
    p.x = (cx + 2.5) * TILE_SIZE;
    p.y = (cy + 0.5) * TILE_SIZE;
    const enemy = world.spawnEnemy(
      'scavenger',
      (cx - 2.5) * TILE_SIZE,
      (cy + 0.5) * TILE_SIZE,
      room.id
    );
    enemy.state = 'chase';
    enemy.cooldown = 99;
    // The detour is about 350px at 80px/s.
    stepFor(world, 6, { aimX: p.x - 100, aimY: p.y });
    expect(Math.hypot(enemy.x - p.x, enemy.y - p.y)).toBeLessThan(70);
  });

  it('kills the player and reports it', () => {
    const world = newWorld();
    world.player.health = 5;
    world.damagePlayer(50, 0, 0, 0);
    expect(world.dead).toBe(true);
  });

  it('delivers events raised between steps on the next step', () => {
    const world = newWorld();
    world.player.health = 5;
    world.damagePlayer(50, 0, 0, 0);
    expect(world.step(NO_INPUT, DT).some((e) => e.type === 'playerDied')).toBe(true);
    expect(world.step(NO_INPUT, DT)).toEqual([]);
  });

  it('replays identically from the same seed and inputs', () => {
    const script = (world: World): string => {
      teleportToRoom(world, 'combat');
      for (let i = 0; i < 240; i++) {
        const p = world.player;
        const target = world.enemies[0];
        world.step(
          {
            ...NO_INPUT,
            moveX: target ? Math.sign(target.x - p.x) : 0,
            moveY: target ? Math.sign(target.y - p.y) : 0,
            aimX: target?.x ?? p.x + 1,
            aimY: target?.y ?? p.y,
            attack: i % 2 === 0,
            dash: i % 90 === 0,
          },
          DT
        );
        clearChoices(world);
      }
      const p = world.player;
      return JSON.stringify([p.x, p.y, p.health, world.enemies.map((e) => [e.x, e.y, e.health])]);
    };
    expect(script(newWorld(9))).toBe(script(newWorld(9)));
  });

  it('builds a flow streak across quick kills and breaks it on a hit', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const p = world.player;
    const first = world.spawnEnemy('scavenger', p.x + 40, p.y, -1);
    const second = world.spawnEnemy('scavenger', p.x - 40, p.y, -1);
    first.state = second.state = 'chase';
    world.damageEnemy(first, 99999, 'melee', false, 0);
    world.damageEnemy(second, 99999, 'melee', false, 0);
    expect(p.resonance).toBe(2);
    expect(world.run.stats.bestResonance).toBe(2);
    const events = world.step(NO_INPUT, DT);
    expect(events.some((e) => e.type === 'resonance' && e.count === 2)).toBe(true);

    world.damagePlayer(10, p.x + 50, p.y, 0);
    const hurt = world.step(NO_INPUT, DT);
    expect(p.resonance).toBe(0);
    expect(hurt.some((e) => e.type === 'resonanceBreak' && e.count === 2)).toBe(true);
  });

  it('rewards a near miss while dashing through an enemy', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const p = world.player;
    p.mana = 0;
    const enemy = world.spawnEnemy('scavenger', p.x + 32, p.y, -1);
    enemy.state = 'stagger';
    enemy.stateTime = 99;
    enemy.cooldown = 99;
    let events: SimEvent[] = [];
    for (let i = 0; i < 12; i++)
      events.push(...world.step({ ...NO_INPUT, dash: true, moveX: 1 }, DT));
    expect(world.run.stats.grazes).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'graze')).toBe(true);
  });

  it('pays a flawless bonus only for rooms cleared without being hit', () => {
    const clean = newWorld();
    const roomId = teleportToRoom(clean, 'combat');
    stepFor(clean, 0.5);
    let events: SimEvent[] = [];
    for (let i = 0; i < 4 && clean.rooms[roomId].phase === 'active'; i++) {
      for (const e of clean.enemies) e.state = 'chase';
      for (const e of [...clean.enemies]) clean.damageEnemy(e, 99999, 'melee', false, 0);
      clearChoices(clean);
      events.push(...stepFor(clean, 1));
      clearChoices(clean);
    }
    expect(events.some((e) => e.type === 'flawlessRoom' && e.shards > 0)).toBe(true);

    const hit = newWorld();
    const hitRoom = teleportToRoom(hit, 'combat');
    stepFor(hit, 0.4);
    hit.damagePlayer(5, hit.player.x + 20, hit.player.y, 0);
    events = [];
    for (let i = 0; i < 4 && hit.rooms[hitRoom].phase === 'active'; i++) {
      for (const e of hit.enemies) e.state = 'chase';
      for (const e of [...hit.enemies]) hit.damageEnemy(e, 99999, 'melee', false, 0);
      clearChoices(hit);
      events.push(...stepFor(hit, 1));
      clearChoices(hit);
    }
    expect(events.some((e) => e.type === 'flawlessRoom')).toBe(false);
  });

  it('rerolls a pending choice for shards and refuses when broke', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const p = world.player;
    const enemy = world.spawnEnemy('scavenger', p.x + 40, p.y, -1);
    enemy.state = 'chase';
    p.xp = xpForLevel(1) - 1;
    world.damageEnemy(enemy, 99999, 'melee', false, 0);
    expect(world.awaitingChoice).toBe(true);
    p.shards = 100;
    const cost = world.rerollCost();
    expect(world.rerollChoices()).toBe(true);
    expect(p.shards).toBe(100 - cost);
    p.shards = 0;
    expect(world.rerollChoices()).toBe(false);

    // When every upgrade is maxed there is nothing to offer, so nothing is charged.
    const spent = newWorld();
    spent.run.player.upgrades = Object.fromEntries(UPGRADES.map((u) => [u.id, u.maxStacks]));
    spent.run.pendingChoices.push({ source: 'level', options: ['vitality'] });
    spent.player.shards = 500;
    expect(spent.rerollChoices()).toBe(false);
    expect(spent.player.shards).toBe(500);
  });

  it('pays the floor bonus for clearing every room and the chest', () => {
    const world = newWorld();
    for (const room of world.floor.rooms)
      if (room.kind === 'combat') world.rooms[room.id].phase = 'cleared';
    const chest = world.interactables.find((i) => i.kind === 'chest')!;
    world.player.x = chest.x;
    world.player.y = chest.y + 20;
    world.step({ ...NO_INPUT, interact: true }, DT);
    clearChoices(world);
    expect(world.floorObjectives().complete).toBe(false);

    teleportToRoom(world, 'boss');
    stepFor(world, 1.5);
    const boss = world.activeBoss()!;
    stepFor(world, 0.8);
    world.damageEnemy(boss, 999999, 'melee', false, 0);
    clearChoices(world);
    const events = stepFor(world, 1);
    expect(world.floorObjectives().complete).toBe(true);
    expect(world.floorObjectives().claimed).toBe(true);
    expect(world.run.stats.floorsRestored).toBe(1);
    expect(events.some((e) => e.type === 'objectiveComplete' && e.shards > 0)).toBe(true);
  });

  it('pays the floor bonus for a chest opened after the guardian falls', () => {
    const world = newWorld();
    for (const room of world.floor.rooms)
      if (room.kind === 'combat') world.rooms[room.id].phase = 'cleared';
    teleportToRoom(world, 'boss');
    stepFor(world, 1.5);
    const boss = world.activeBoss()!;
    stepFor(world, 0.8);
    world.damageEnemy(boss, 999999, 'melee', false, 0);
    clearChoices(world);
    stepFor(world, 1);
    expect(world.floorObjectives().complete).toBe(false);
    expect(world.floorObjectives().claimed).toBe(false);

    const chest = world.interactables.find((i) => i.kind === 'chest')!;
    world.player.x = chest.x;
    world.player.y = chest.y + 20;
    const events = world.step({ ...NO_INPUT, interact: true }, DT);
    clearChoices(world);
    expect(world.floorObjectives().claimed).toBe(true);
    expect(events.some((e) => e.type === 'objectiveComplete')).toBe(true);
  });

  it('converts a full-health heart into shards instead of leaving it stuck', () => {
    const w = newWorld();
    const p = w.player;
    p.health = p.stats.maxHealth;
    const before = p.shards;
    (
      w as unknown as {
        dropPickup: (kind: string, x: number, y: number, amount: number) => void;
      }
    ).dropPickup('health', p.x, p.y, 20);
    for (let i = 0; i < 90; i++) w.step(NO_INPUT, DT);
    expect(p.shards).toBeGreaterThan(before);
    expect(w.pickups.filter((pickup) => pickup.kind === 'health')).toHaveLength(0);
  });

  it('round-trips a run through JSON', () => {
    const world = newWorld();
    world.player.upgrades.vitality = 2;
    world.player.health = 50;
    const restored = restoreRun(JSON.parse(JSON.stringify(world.run)));
    expect(restored?.player.stats.maxHealth).toBe(140);
    expect(restored?.player.health).toBe(50);
    expect(restoreRun({ version: 0 })).toBeUndefined();
  });
});
