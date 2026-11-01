import { describe, expect, it } from 'vitest';
import { roomCentrePx } from '../../src/sim/dungeon';
import { FINAL_DEPTH, FLOOR_PLANS } from '../../src/sim/content';
import { NO_INPUT, type InputFrame, type Pickup } from '../../src/sim/entities';
import { equipmentDef, INVENTORY_SLOTS, relicSellShards } from '../../src/sim/equipment';
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

  it('announces subsequent waves with shockwave and notice in multi-wave rooms', () => {
    const world = newWorld(42, 4);
    const room = world.floor.rooms.find((r) => r.kind === 'combat' && r.w * r.h >= 180)!;
    world.player.x = (room.x + room.w / 2) * 32;
    world.player.y = (room.y + room.h / 2) * 32;
    stepFor(world, 0.1);
    expect(world.rooms[room.id].phase).toBe('active');
    expect(world.rooms[room.id].totalWaves).toBeGreaterThanOrEqual(2);
    world.rooms[room.id].hideWaveCount = false;
    stepFor(world, 1.2);
    for (const e of [...world.enemies]) world.damageEnemy(e, 99999, 'melee', false, 0);
    clearChoices(world);
    const waveTransitionEvents = stepFor(world, 0.2);
    expect(waveTransitionEvents.some((e) => e.type === 'shockwave')).toBe(true);
    expect(
      waveTransitionEvents.some((e) => e.type === 'notice' && e.text.startsWith('Wave 2 of'))
    ).toBe(true);
  });

  it('omits the wave total when a room keeps its mystery', () => {
    const world = newWorld(42, 4);
    const room = world.floor.rooms.find((r) => r.kind === 'combat' && r.w * r.h >= 180)!;
    world.player.x = (room.x + room.w / 2) * 32;
    world.player.y = (room.y + room.h / 2) * 32;
    stepFor(world, 0.1);
    world.rooms[room.id].hideWaveCount = true;
    stepFor(world, 1.2);
    for (const e of [...world.enemies]) world.damageEnemy(e, 99999, 'melee', false, 0);
    clearChoices(world);
    const events = stepFor(world, 0.2);
    expect(events.some((e) => e.type === 'notice' && e.text === 'Wave 2')).toBe(true);
    expect(events.some((e) => e.type === 'notice' && e.text.includes(' of '))).toBe(false);
  });

  it('can roll deep wave chains but never past ten', () => {
    const totals: number[] = [];
    for (let seed = 0; seed < 60; seed++) {
      const world = newWorld(seed, 6);
      const room = world.floor.rooms.find((r) => r.kind === 'combat');
      if (!room) continue;
      world.player.x = (room.x + room.w / 2) * 32;
      world.player.y = (room.y + room.h / 2) * 32;
      stepFor(world, 0.1);
      const total = world.rooms[room.id].totalWaves ?? 0;
      expect(total).toBeLessThanOrEqual(10);
      totals.push(total);
    }
    expect(Math.max(...totals)).toBeGreaterThan(4);
  });

  it('never lands a wave on a player camping a gate', () => {
    let found: { world: World; roomId: number; gate: { spawnX: number; spawnY: number } } | undefined;
    for (let seed = 0; seed < 40 && !found; seed++) {
      const world = newWorld(seed, 3);
      const room = world.floor.rooms.find((r) => r.kind === 'combat' && r.gates?.length);
      if (room?.gates?.length) found = { world, roomId: room.id, gate: room.gates[0] };
    }
    expect(found).toBeDefined();
    const { world, roomId, gate } = found!;
    const room = world.floor.rooms[roomId];
    // Clear the chamber from its middle, then camp the gate mouth.
    world.player.x = (room.x + room.w / 2) * TILE_SIZE;
    world.player.y = (room.y + room.h / 2) * TILE_SIZE;
    stepFor(world, 0.1);
    expect(world.rooms[roomId].phase).toBe('active');
    world.player.x = gate.spawnX;
    world.player.y = gate.spawnY;
    const events = stepFor(world, 1.2);
    const spawns = events.filter((e) => e.type === 'enemySpawned');
    expect(spawns.length).toBeGreaterThan(0);
    for (const spawn of spawns)
      expect(Math.hypot(spawn.x - gate.spawnX, spawn.y - gate.spawnY)).toBeGreaterThanOrEqual(140);
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

describe('finisher', () => {
  it('melee hits on a wounded enemy deal +50% damage and restore mana', () => {
    const world = newWorld();
    const roomId = teleportToRoom(world, 'combat');
    stepFor(world, 0.5);
    const enemy = world.enemies[0];
    enemy.state = 'chase';
    // Wound the enemy below 30%.
    enemy.health = Math.max(1, Math.floor(enemy.maxHealth * 0.2));
    const before = enemy.health;
    const manaBefore = world.player.mana;
    const dealt = world.damageEnemy(enemy, 10, 'melee', false, 0);
    // 10 * 1.5 = 15, but capped by remaining health.
    expect(dealt).toBe(Math.min(before, 15));
    expect(world.player.mana).toBe(Math.min(world.player.stats.maxMana, manaBefore + 4));
  });

  it('does not trigger on healthy enemies or non-melee sources', () => {
    const world = newWorld();
    teleportToRoom(world, 'combat');
    stepFor(world, 0.5);
    const enemy = world.enemies[0];
    enemy.health = enemy.maxHealth; // healthy
    const manaBefore = world.player.mana;
    world.damageEnemy(enemy, 10, 'melee', false, 0);
    expect(world.player.mana).toBe(manaBefore);
    // non-melee on a wounded enemy
    const enemy2 = world.enemies[1] ?? world.enemies[0];
    enemy2.state = 'chase';
    enemy2.health = Math.max(1, Math.floor(enemy2.maxHealth * 0.2));
    const manaBefore2 = world.player.mana;
    world.damageEnemy(enemy2, 10, 'bolt', false, 0);
    expect(world.player.mana).toBe(manaBefore2);
  });
});

describe('crit reward', () => {
  it('a critical hit restores mana and extends the flow window', () => {
    const world = newWorld();
    teleportToRoom(world, 'combat');
    stepFor(world, 0.5);
    const enemy = world.enemies[0];
    enemy.state = 'chase';
    const manaBefore = world.player.mana;
    const flowBefore = world.player.resonanceTime;
    world.damageEnemy(enemy, 5, 'melee', true, 0);
    expect(world.player.mana).toBe(Math.min(world.player.stats.maxMana, manaBefore + 3));
    expect(world.player.resonanceTime).toBeGreaterThanOrEqual(flowBefore);
  });
});

describe('interrupt', () => {
  it('a melee hit during an enemy windup staggers and cancels the attack', () => {
    const world = newWorld();
    teleportToRoom(world, 'combat');
    stepFor(world, 0.5);
    const enemy = world.enemies[0];
    enemy.state = 'windup';
    enemy.stateTime = 0.5;
    world.damageEnemy(enemy, 5, 'melee', false, 0);
    expect(enemy.state).toBe('stagger');
  });

  it('a boss is not interrupted by a hit during windup', () => {
    const world = newWorld();
    teleportToRoom(world, 'combat');
    stepFor(world, 0.5);
    const enemy = world.enemies[0];
    enemy.isBoss = true;
    enemy.state = 'windup';
    enemy.stateTime = 0.5;
    world.damageEnemy(enemy, 5, 'melee', false, 0);
    expect(enemy.state).toBe('windup');
  });
});

describe('relic bag', () => {
  function dropRelicAt(world: World, defId: string): void {
    const pickup: Pickup = {
      id: 9900 + world.pickups.length,
      kind: 'equipment',
      x: world.player.x,
      y: world.player.y,
      amount: 1,
      equipment: { uid: 9500 + world.pickups.length, defId },
      age: 1,
      vx: 0,
      vy: 0,
    };
    world.pickups.push(pickup);
  }

  it('auto-equips a picked-up relic into an empty slot without using bag space', () => {
    const world = newWorld();
    const p = world.player;
    dropRelicAt(world, 'rusted_edge');
    stepFor(world, 0.1);
    expect(p.equipment.weapon?.defId).toBe('rusted_edge');
    expect(p.inventory).toHaveLength(0);
  });

  it('fills the bag up to the slot limit and sells overflow for shards', () => {
    const world = newWorld();
    const p = world.player;
    p.equipment.weapon = { uid: 9001, defId: 'rusted_edge' };
    for (let i = 0; i < INVENTORY_SLOTS; i++) p.inventory.push({ uid: 9100 + i, defId: 'ember_charm' });
    const shards = p.shards;
    dropRelicAt(world, 'echo_dagger');
    const events = stepFor(world, 0.1);
    expect(p.inventory).toHaveLength(INVENTORY_SLOTS);
    expect(p.shards).toBe(shards + relicSellShards(equipmentDef('echo_dagger')));
    expect(events.some((e) => e.type === 'equipment' && e.sold !== undefined)).toBe(true);
  });

  it('blocks unequipping into a full bag and resumes once space frees', () => {
    const world = newWorld();
    const p = world.player;
    p.equipment.weapon = { uid: 9001, defId: 'rusted_edge' };
    for (let i = 0; i < INVENTORY_SLOTS; i++) p.inventory.push({ uid: 9100 + i, defId: 'ember_charm' });
    expect(world.unequip('weapon')).toBe(false);
    expect(p.equipment.weapon?.defId).toBe('rusted_edge');
    expect(world.sellItem(9100)).toBeDefined();
    expect(world.unequip('weapon')).toBe(true);
    expect(p.equipment.weapon).toBeNull();
  });

  it('sells a carried relic for shards and removes it', () => {
    const world = newWorld();
    const p = world.player;
    p.inventory.push({ uid: 9201, defId: 'void_cleaver' });
    const price = relicSellShards(equipmentDef('void_cleaver'));
    const shards = p.shards;
    expect(world.sellItem(9201)).toBe(price);
    expect(p.shards).toBe(shards + price);
    expect(p.inventory).toHaveLength(0);
    expect(world.sellItem(9201)).toBeUndefined();
  });
});

describe('overkill', () => {
  it('spills half the excess damage to a nearby enemy on a killing blow', () => {
    const world = newWorld();
    teleportToRoom(world, 'combat');
    stepFor(world, 0.5);
    const a = world.enemies[0];
    const b = world.enemies[1] ?? world.enemies[0];
    // Place b close to a.
    b.x = a.x + 30;
    b.y = a.y;
    b.state = 'chase';
    a.state = 'chase';
    const bHealthBefore = b.health;
    // Kill a with a huge hit, generating excess.
    world.damageEnemy(a, 99999, 'melee', false, 0);
    // b should have taken some spillover (half of excess, capped by its health).
    expect(b.health).toBeLessThan(bHealthBefore);
  });

  it('does not spill when there is no nearby enemy', () => {
    const world = newWorld();
    teleportToRoom(world, 'combat');
    stepFor(world, 0.5);
    const a = world.enemies[0];
    // Move all other enemies far away.
    for (const e of world.enemies) if (e !== a) { e.x = 10000; e.y = 10000; }
    a.state = 'chase';
    const others = world.enemies.filter((e) => e !== a);
    const healthsBefore = others.map((e) => e.health);
    world.damageEnemy(a, 99999, 'melee', false, 0);
    others.forEach((e, i) => expect(e.health).toBe(healthsBefore[i]));
  });
});

describe('behavioral mechanics', () => {
  it('triggers near-miss clutch surge on graze when in critical health', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const p = world.player;
    p.health = Math.round(p.stats.maxHealth * 0.2);
    p.dashCharges = 1;
    p.resonanceTime = 0;
    expect(p.clutchUsed).toBe(false);

    const enemy = world.spawnEnemy('scavenger', p.x + 32, p.y, -1);
    enemy.state = 'stagger';
    enemy.stateTime = 99;
    enemy.cooldown = 99;

    let events: SimEvent[] = [];
    for (let i = 0; i < 12; i++)
      events.push(...world.step({ ...NO_INPUT, dash: true, moveX: 1 }, DT));

    expect(events.some((e) => e.type === 'clutchGraze')).toBe(true);
    expect(p.clutchUsed).toBe(true);
    expect(p.dashCharges).toBeGreaterThan(0);
    expect(p.resonanceTime).toBeGreaterThan(0);

    // Further graze while still critical does not trigger clutchGraze again
    events = [];
    p.action = 'idle';
    p.dashTime = 0;
    p.dashCharges = 1;
    p.dashGrazes = [];
    enemy.x = p.x + 32;
    for (let i = 0; i < 12; i++)
      events.push(...world.step({ ...NO_INPUT, dash: true, moveX: 1 }, DT));
    expect(events.some((e) => e.type === 'clutchGraze')).toBe(false);

    // Healing above 30% resets clutchUsed
    world.step({ ...NO_INPUT, potion: true }, DT);
    expect(p.health).toBeGreaterThan(p.stats.maxHealth * 0.3);
    expect(p.clutchUsed).toBe(false);
  });

  it('tracks archive pages in floorObjectives', () => {
    const world = newWorld();
    world.interactables.length = 0;
    world.interactables.push({
      id: 9999,
      kind: 'archive',
      x: world.player.x + 20,
      y: world.player.y,
      roomId: 0,
      cost: 0,
      used: false,
    });
    const obj = world.floorObjectives();
    expect(obj.archiveFound).toBe(true);
    expect(obj.archiveUsed).toBe(false);

    world.step({ ...NO_INPUT, interact: true }, DT);
    const updated = world.floorObjectives();
    expect(updated.archiveUsed).toBe(true);
  });

  it('delivers hitstop when landing a critical strike', () => {
    const world = newWorld();
    teleportToRoom(world, 'start');
    const enemy = world.spawnEnemy('scavenger', world.player.x + 20, world.player.y, -1);
    enemy.state = 'chase';
    world.damageEnemy(enemy, 20, 'melee', true, 0);
    const initialHitstop = (world as unknown as { freeze: number }).freeze;
    expect(initialHitstop).toBeGreaterThan(0);
  });
});
