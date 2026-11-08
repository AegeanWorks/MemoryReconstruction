import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { generateFloor, roomCentrePx } from '../../src/sim/dungeon';
import { createRun, restoreRun } from '../../src/sim/run';
import { featProgress, flowMilestone } from '../../src/sim/feats';
import { dailyModifier } from '../../src/save/SaveStore';
import {
  applyQuestClaim,
  applyTribute,
  bountyForDay,
  claimDailyBounty,
  dailyBounty,
  questDef,
  rushMinutesLeft,
  trustBonus,
  trustLevel,
} from '../../src/sim/quests';
import { World } from '../../src/sim/world';
import {
  applyEquipment,
  emptyEquipment,
  EQUIPMENT,
  equipmentDef,
  rollEquipment,
} from '../../src/sim/equipment';
import { computeStats } from '../../src/sim/upgrades';
import { enemyDef } from '../../src/sim/content';
import { dashStrikeRange } from '../../src/sim/enemies';
import { Rng } from '../../src/sim/rng';
import { TILE_SIZE, Tile } from '../../src/sim/tiles';
import { questProgress, questSnapshot, QUESTS } from '../../src/sim/quests';
import { restoredLevels, createExpedition } from '../../src/sim/hub';

const DT = 1 / 60;

function world(depth = 0, seed = 7): World {
  const run = createRun(seed, []);
  run.depth = depth;
  return new World(run);
}

/** A world as the player actually meets it: from the matching checkpoint. */
function checkpointWorld(depth: number, seed = 7): World {
  return new World(createExpedition(seed, [], depth, { echoes: 0, restorations: {}, checkpoint: 0 }));
}

/**
 * Traps and blasts stagger anything they touch, so mechanics tests clear the
 * ground around their subject first. This tests the behaviour, not the room.
 */
function clearHazardsAround(w: World, x: number, y: number, radius = 220): void {
  for (let i = w.hazards.length - 1; i >= 0; i--) {
    const h = w.hazards[i];
    if (Math.hypot(h.x - x, h.y - y) < radius) w.hazards.splice(i, 1);
  }
}

describe('equipment', () => {
  it('applies flat and percentage mods and clamps outcomes', () => {
    const stats = computeStats({});
    const vest = EQUIPMENT.find((e) => e.id === 'scavenger_vest')!;
    const gear = {
      ...emptyEquipment(),
      armor: { uid: 1, defId: vest.id },
    };
    const out = applyEquipment(stats, gear);
    expect(out.maxHealth).toBe(stats.maxHealth + 15);
    expect(out.damageReduction).toBeCloseTo(0.03);
    expect(out.damageReduction).toBeLessThan(0.65);

    const swift = computeStats({ haste: 10 });
    expect(
      applyEquipment(swift, { ...emptyEquipment(), armor: { uid: 1, defId: 'crystal_mail' } })
        .moveSpeed
    ).toBeLessThan(swift.moveSpeed);
  });

  it('rolls better rarity more often in deep sections', () => {
    const shallow = new Rng(3);
    const deep = new Rng(3);
    let shallowEpic = 0;
    let deepEpic = 0;
    for (let i = 0; i < 200; i++) {
      if (rollEquipment(shallow, 0).rarity === 'epic') shallowEpic++;
      if (rollEquipment(deep, 10).rarity === 'epic') deepEpic++;
    }
    expect(deepEpic).toBeGreaterThan(shallowEpic);
  });

  it('auto-equips the first boss relic and reports it', () => {
    const w = world(0);
    const p = w.player;
    const boss = w.spawnEnemy('guardian', p.x + 40, p.y, -1, true);
    boss.state = 'chase';
    w.damageEnemy(boss, 999999, 'melee', false, 0);
    while (w.awaitingChoice) w.chooseUpgrade(w.run.pendingChoices[0].options[0]);
    const relic = w.pickups.find((x) => x.kind === 'equipment');
    expect(relic?.equipment).toBeDefined();
    let events = [] as ReturnType<World['step']>;
    for (let i = 0; i < 30; i++) {
      const drop = w.pickups.find((x) => x.kind === 'equipment');
      if (drop) {
        p.x = drop.x;
        p.y = drop.y;
      }
      events = events.concat(w.step(NO_INPUT, DT));
    }
    const def = equipmentDef(relic!.equipment!.defId);
    expect(p.equipment[def.slot]?.defId).toBe(def.id);
    expect(events.some((e) => e.type === 'equipment')).toBe(true);
  });

  it('can equip, swap and discard carried relics', () => {
    const w = world(0);
    const p = w.player;
    p.inventory.push({ uid: 10, defId: 'rusted_edge' });
    p.inventory.push({ uid: 11, defId: 'echo_dagger' });
    expect(w.equipItem(10)).toBe(true);
    expect(p.equipment.weapon?.uid).toBe(10);
    expect(w.equipItem(11)).toBe(true);
    expect(p.equipment.weapon?.uid).toBe(11);
    expect(p.inventory.map((i) => i.uid)).toContain(10);
    expect(w.unequip('weapon')).toBe(true);
    expect(p.equipment.weapon).toBeNull();
    expect(w.discardItem(10)).toBe(true);
    expect(p.inventory.map((i) => i.uid)).not.toContain(10);
  });
});

describe('hazards and the sanctuary', () => {
  it('places traps and barrels in combat rooms', () => {
    const w = world(3);
    expect(w.hazards.length).toBeGreaterThan(0);
    expect(w.hazards.some((h) => h.kind === 'barrel')).toBe(true);
    expect(
      w.hazards.some((h) => h.kind === 'crate' || h.kind === 'crystal' || h.kind === 'urn')
    ).toBe(true);
  });

  it('a sprung trap hurts the player and can be disarmed', () => {
    const w = world(2);
    const p = w.player;
    const trap = w.hazards.find((h) => h.kind === 'spike' || h.kind === 'flame');
    expect(trap).toBeDefined();
    p.x = trap!.x;
    p.y = trap!.y;
    p.invulnerable = 0;
    trap!.phase = 'warning';
    trap!.timer = 0.001;
    const before = p.health;
    w.step(NO_INPUT, DT);
    expect(p.health).toBeLessThan(before);
    w.disableHazards(trap!.roomId);
    expect(trap!.disabled).toBe(true);
  });

  it('breaks a barrel and damages nearby enemies', () => {
    const w = world(3);
    const barrel = w.hazards.find((h) => h.kind === 'barrel')!;
    const enemy = w.spawnEnemy('scavenger', barrel.x + 20, barrel.y, -1);
    enemy.state = 'chase';
    const before = enemy.health;
    w.hitHazards(barrel.x, barrel.y, 10, 999);
    expect(w.hazards).not.toContain(barrel);
    expect(enemy.health).toBeLessThan(before);
  });

  it('a disarmed hazard stops its warning telegraph', () => {
    const w = world(2);
    const trap = w.hazards.find((h) => h.kind === 'spike' || h.kind === 'flame')!;
    trap.phase = 'warning';
    trap.timer = 0.2;
    w.disableHazards(trap.roomId);
    expect(trap.disabled).toBe(true);
    expect(trap.phase).toBe('idle');
    expect(trap.timer).toBe(0);
  });

  it('a disarmed room keeps its breakables intact', () => {
    const w = world(3);
    const barrel = w.hazards.find((h) => h.kind === 'barrel')!;
    w.disableHazards(barrel.roomId);
    expect(barrel.disabled).toBe(false);
    w.hitHazards(barrel.x, barrel.y, 10, 999);
    expect(w.hazards).not.toContain(barrel);
  });

  it('breaks a crate into stored shards without hurting the player', () => {
    const w = world(3);
    const crate = w.hazards.find((h) => h.kind === 'crate')!;
    w.player.x = crate.x;
    w.player.y = crate.y;
    const health = w.player.health;
    const pickups = w.pickups.length;
    w.hitHazards(crate.x, crate.y, 10, 999);
    expect(w.hazards).not.toContain(crate);
    expect(w.pickups.length).toBeGreaterThan(pickups);
    expect(w.player.health).toBe(health);
  });

  it('reports a landed blow on a prop that survives the hit', () => {
    const w = world(3);
    const crate = w.hazards.find((h) => h.kind === 'crate')!;
    w.hitHazards(crate.x, crate.y, 10, 1);
    const events = w.step(NO_INPUT, 0);
    expect(w.hazards).toContain(crate);
    expect(crate.hitFlash).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'hazardHit' && e.kind === 'crate')).toBe(true);
    for (let i = 0; i < 20; i++) w.step(NO_INPUT, DT);
    expect(crate.hitFlash).toBe(0);
  });

  it('lights nearby breakables when a barrel detonates', () => {
    const w = world(3);
    const barrel = w.hazards.find((h) => h.kind === 'barrel')!;
    const crate = w.hazards.find((h) => h.kind === 'crate')!;
    crate.x = barrel.x + 30;
    crate.y = barrel.y;
    w.player.x = barrel.x + 480;
    w.player.y = barrel.y;
    w.hitHazards(barrel.x, barrel.y, 10, 999);
    expect(w.hazards).not.toContain(barrel);
    expect(w.hazards).toContain(crate);
    expect(crate.ignite).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) w.step(NO_INPUT, DT);
    expect(w.hazards).not.toContain(crate);
  });

  it('a bomb blast lights a crate but never a floor trap', () => {
    const w = world(2);
    const crate = w.hazards.find((h) => h.kind === 'crate')!;
    const trap = w.hazards.find((h) => h.kind === 'spike' || h.kind === 'flame')!;
    trap.x = crate.x + 12;
    trap.y = crate.y;
    w.player.x = crate.x + 480;
    w.player.y = crate.y;
    w.spawnBomb(crate.x - 24, crate.y, 0, 0, 'player', 1, 0.01);
    for (let i = 0; i < 40; i++) w.step(NO_INPUT, DT);
    expect(w.hazards).not.toContain(crate);
    expect(w.hazards).toContain(trap);
    expect(trap.ignite).toBeUndefined();
  });

  it('breaks only the props inside the swing arc', () => {
    const w = world(3);
    const p = w.player;
    const front = w.hazards.find((h) => h.kind === 'crate')!;
    const behind = w.hazards.find((h) => h.kind === 'urn' || h.kind === 'crystal')!;
    front.x = p.x + 40;
    front.y = p.y;
    behind.x = p.x - 40;
    behind.y = p.y;
    p.aim = 0;
    const input = { ...NO_INPUT, attack: true, aimX: p.x + 100, aimY: p.y };
    for (let i = 0; i < 30; i++) w.step(input, DT);
    expect(w.hazards).not.toContain(front);
    expect(w.hazards).toContain(behind);
  });

  it('never buries an interactable under a prop', () => {
    for (const seed of [1, 2, 3, 42, 1337]) {
      const w = world(2, seed);
      for (const h of w.hazards)
        for (const i of w.interactables)
          expect(Math.hypot(h.x - i.x, h.y - i.y)).toBeGreaterThanOrEqual(43.9);
    }
  });

  it('shatters a crystal into a memory flare that sears enemies only', () => {
    const w = world(3);
    const crystal = w.hazards.find((h) => h.kind === 'crystal')!;
    const enemy = w.spawnEnemy('scavenger', crystal.x + 20, crystal.y, -1);
    enemy.state = 'chase';
    w.player.x = crystal.x;
    w.player.y = crystal.y;
    const health = w.player.health;
    const before = enemy.health;
    w.hitHazards(crystal.x, crystal.y, 10, 999);
    expect(w.hazards).not.toContain(crystal);
    expect(enemy.health).toBeLessThan(before);
    expect(w.player.health).toBe(health);
  });

  it('cracks a neighbouring breakable when a crystal shatters', () => {
    const w = world(3);
    const crystal = w.hazards.find((h) => h.kind === 'crystal')!;
    const crate = w.hazards.find((h) => h.kind === 'crate')!;
    crate.x = crystal.x + 30;
    crate.y = crystal.y;
    w.hitHazards(crystal.x, crystal.y, 10, 999);
    expect(w.hazards).not.toContain(crate);
  });

  it('spills a shard or a draught from a broken urn', () => {
    const w = world(3);
    const urn = w.hazards.find((h) => h.kind === 'urn')!;
    const pickups = w.pickups.length;
    w.hitHazards(urn.x, urn.y, 10, 999);
    expect(w.hazards).not.toContain(urn);
    expect(w.pickups.length).toBeGreaterThan(pickups);
  });

  it('leaves traps and floor dangers unbreakable', () => {
    const w = world(2);
    const trap = w.hazards.find((h) => h.kind === 'spike' || h.kind === 'flame')!;
    expect(w.hitHazards(trap.x, trap.y, 10, 999)).toBe(0);
    expect(w.hazards).toContain(trap);
  });

  it('moves loot out of solid tiles before it drops', () => {
    const w = world(2, 4);
    const grid = w.grid;
    let wall: { x: number; y: number } | undefined;
    for (let ty = 0; ty < grid.height && !wall; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        if (grid.get(tx, ty) === Tile.Wall) {
          wall = { x: tx, y: ty };
          break;
        }
      }
    }
    expect(wall).toBeDefined();
    const at = w.safeDropPosition((wall!.x + 0.5) * TILE_SIZE, (wall!.y + 0.5) * TILE_SIZE);
    expect(grid.isSolidAtPixel(at.x, at.y)).toBe(false);
  });

  it('pushes safe drop positions away from gate and wall boundaries', () => {
    let gateWorld: World | undefined;
    let gateTile: { x: number; y: number } | undefined;
    for (let seed = 1; seed < 40 && !gateTile; seed++) {
      const candidate = world(0, seed);
      for (let ty = 0; ty < candidate.grid.height && !gateTile; ty++) {
        for (let tx = 0; tx < candidate.grid.width && !gateTile; tx++) {
          if (candidate.grid.get(tx, ty) === Tile.Gate) {
            gateTile = { x: tx, y: ty };
            gateWorld = candidate;
          }
        }
      }
    }
    expect(gateWorld).toBeDefined();
    expect(gateTile).toBeDefined();
    const w = gateWorld!;
    const at = w.safeDropPosition((gateTile!.x + 0.5) * TILE_SIZE, (gateTile!.y + 0.5) * TILE_SIZE);
    expect(w.grid.isSolidAtPixel(at.x, at.y, 'player')).toBe(false);
    expect(w.grid.get(Math.floor(at.x / TILE_SIZE), Math.floor(at.y / TILE_SIZE))).toBe(Tile.Floor);
  });

  it('recovers pickups dropped or nudged into walls', () => {
    const w = world(0);
    let wall: { x: number; y: number } | undefined;
    for (let ty = 0; ty < w.grid.height && !wall; ty++) {
      for (let tx = 0; tx < w.grid.width && !wall; tx++) {
        if (w.grid.get(tx, ty) === Tile.Wall) wall = { x: tx, y: ty };
      }
    }
    expect(wall).toBeDefined();
    w.pickups.push({
      id: 9999,
      kind: 'shard',
      x: (wall!.x + 0.5) * TILE_SIZE,
      y: (wall!.y + 0.5) * TILE_SIZE,
      amount: 5,
      age: 0,
      vx: 0,
      vy: 0,
    });
    w.step(NO_INPUT, DT);
    const p = w.pickups.find((it) => it.id === 9999);
    expect(p).toBeDefined();
    expect(w.grid.isSolidAtPixel(p!.x, p!.y, 'player')).toBe(false);
  });

  it('turns a mimic chest into an ambush', () => {
    const w = world(0);
    const chest = w.interactables.find((i) => i.kind === 'chest')!;
    chest.mimic = true;
    w.player.x = chest.x;
    w.player.y = chest.y + 20;
    const events = w.step({ ...NO_INPUT, interact: true }, DT);
    expect(chest.used).toBe(true);
    expect(w.enemies.length).toBe(1);
    expect(events.some((e) => e.type === 'notice' && e.text.includes('mimic'))).toBe(true);
  });

  it('lets a merchant trade shards for a relic', () => {
    let merchantWorld: World | undefined;
    for (let seed = 1; seed < 40 && !merchantWorld; seed++) {
      const candidate = world(0, seed);
      if (candidate.interactables.some((i) => i.kind === 'merchant')) merchantWorld = candidate;
    }
    expect(merchantWorld).toBeDefined();
    const w = merchantWorld!;
    const merchant = w.interactables.find((i) => i.kind === 'merchant')!;
    w.player.shards = merchant.cost + 10;
    w.player.x = merchant.x;
    w.player.y = merchant.y + 10;
    w.step({ ...NO_INPUT, interact: true }, DT);
    expect(merchant.used).toBe(true);
    expect(w.player.shards).toBe(10);
    expect(w.pickups.some((p) => p.kind === 'equipment')).toBe(true);
  });

  it('builds a resident room with one NPC, one door and furnished floor', () => {
    const run = createRun(1, []);
    const w = new World(run, { sanctuary: true, building: 'archivist' });
    expect(w.mode).toBe('sanctuary');
    expect(w.activeBuilding).toBe('archivist');
    expect(w.enemies).toHaveLength(0);
    expect(w.hazards).toHaveLength(0);
    expect(w.interactables.filter((i) => i.kind === 'npc')).toHaveLength(1);
    expect(w.interactables.filter((i) => i.kind === 'door')).toHaveLength(1);
    expect(w.decor.length).toBeGreaterThan(5);
  });

  it('emits the resident event when talking inside a room', () => {
    const run = createRun(1, []);
    const w = new World(run, { sanctuary: true, building: 'smith' });
    const npc = w.interactables.find((i) => i.kind === 'npc')!;
    w.player.x = npc.x;
    w.player.y = npc.y;
    const events = w.step({ ...NO_INPUT, interact: true }, DT);
    const event = events.find((e) => e.type === 'sanctuary');
    expect(event && event.type === 'sanctuary' ? event.id : '').toBe(npc.npcId);
  });
});

describe('map layouts', () => {
  it('keeps every room reachable in every section and layout', () => {
    for (let depth = 0; depth < 16; depth++) {
      const w = world(depth, 90 + depth);
      const seen = new Set<number>([w.floor.startRoom]);
      const queue = [w.floor.startRoom];
      while (queue.length > 0) {
        const id = queue.shift()!;
        for (const door of w.floor.rooms[id].doors)
          if (!seen.has(door.leadsTo)) {
            seen.add(door.leadsTo);
            queue.push(door.leadsTo);
          }
      }
      expect(seen.size).toBe(w.floor.rooms.length);
    }
  });

  it('always assigns a guardian and connects every room across layouts and seeds', () => {
    const layouts = ['branch', 'ring', 'spine', 'grid', 'diamond', 'cross'] as const;
    for (const layout of layouts) {
      for (let seed = 1; seed <= 40; seed++) {
        const floor = generateFloor(seed, 5, { roomCount: 12, layout });
        expect(floor.bossRoom).toBeGreaterThanOrEqual(0);
        const seen = new Set<number>([floor.startRoom]);
        const queue = [floor.startRoom];
        while (queue.length > 0) {
          const id = queue.shift()!;
          for (const door of floor.rooms[id].doors)
            if (!seen.has(door.leadsTo)) {
              seen.add(door.leadsTo);
              queue.push(door.leadsTo);
            }
        }
        expect(seen.size).toBe(floor.rooms.length);
      }
    }
  });

  it('adds arena and library rooms and non-rectangular footprints', () => {
    let arena = false;
    let library = false;
    const shapes = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const floor = generateFloor(seed, 4, { roomCount: 12, layout: 'branch' });
      for (const room of floor.rooms) {
        if (room.kind === 'arena') arena = true;
        if (room.kind === 'library') library = true;
        shapes.add(room.shape);
      }
    }
    expect(arena).toBe(true);
    expect(library).toBe(true);
    expect(shapes.size).toBeGreaterThanOrEqual(3);
  });

  it('builds a boss-only echo episode as one arena and activates immediately on entry', () => {
    for (const [depth, expectedBoss] of [
      [5, 'choir_hierophant'],
      [11, 'hollow_behemoth'],
    ] as const) {
      const run = createRun(77, []);
      run.depth = depth;
      const w = new World(run);
      expect(w.plan.bossOnly).toBe(true);
      expect(w.visited[w.floor.startRoom]).toBe(true);
      expect(w.floor.rooms).toHaveLength(1);
      expect(w.floor.rooms[w.floor.bossRoom].kind).toBe('boss');
      expect(w.hazards).toHaveLength(0);

      for (let i = 0; i < 110; i++) w.step(NO_INPUT, DT);
      const boss = w.activeBoss();
      expect(boss?.def.id).toBe(expectedBoss);
      expect(boss?.state).not.toBe('spawning');

      w.damageEnemy(boss!, boss!.health, 'melee', false, 0);
      w.run.pendingChoices.length = 0;
      for (let i = 0; i < 30; i++) w.step(NO_INPUT, DT);
      const relics = w.pickups.filter((p) => p.kind === 'equipment');
      expect(relics).toHaveLength(2);
    }
  });

  it('blocks combat consumables inside a resident room', () => {
    const w = new World(createRun(12, []), { sanctuary: true, building: 'warden' });
    w.player.health = 20;
    const beforePotions = w.player.potions;
    const beforeBombs = w.player.bombs;
    const beforeTraps = w.player.traps;
    w.step({ ...NO_INPUT, bolt: true, bomb: true, trap: true, potion: true }, DT);
    expect(w.projectiles).toHaveLength(0);
    expect(w.bombs).toHaveLength(0);
    expect(w.hazards).toHaveLength(0);
    expect(w.player.potions).toBe(beforePotions);
    expect(w.player.bombs).toBe(beforeBombs);
    expect(w.player.traps).toBe(beforeTraps);
  });

  it('uses at least eight structural layouts across the sections', () => {
    const layouts = new Set(
      Array.from({ length: 16 }, (_, depth) => world(depth, 5 + depth).plan.layout)
    );
    expect(layouts.size).toBeGreaterThanOrEqual(8);
    expect(layouts.has('clover')).toBe(true);
    expect(layouts.has('terrace')).toBe(true);
  });
});

describe('boss attacks and quests', () => {
  it('runs a late boss with its new attacks without throwing', () => {
    const w = world(6, 21);
    const room = w.floor.rooms.find((r) => r.kind === 'boss')!;
    w.player.x = (room.x + room.w / 2) * 32;
    w.player.y = (room.y + room.h / 2) * 32;
    w.player.stats.maxHealth = 9999;
    w.player.health = 9999;
    for (let i = 0; i < 120; i++) w.step(NO_INPUT, DT);
    expect(w.activeBoss()?.def.id).toBe('clockwork_regent');
    expect(w.player.health).toBeGreaterThan(0);
  });

  it('resolves each new attack kind without throwing', () => {
    const w = world(3, 11);
    const room = w.floor.rooms.find((r) => r.kind === 'combat') ?? w.floor.rooms[1];
    w.player.x = (room.x + room.w / 2) * 32;
    w.player.y = (room.y + room.h / 2) * 32;
    w.player.stats.maxHealth = 9999;
    w.player.health = 9999;
    for (let i = 0; i < 40; i++) w.step(NO_INPUT, DT);
    const enemy = w.enemies[0];
    expect(enemy).toBeDefined();
    for (const kind of ['fan', 'sweep', 'wall', 'pillars'] as const) {
      enemy.state = 'windup';
      enemy.stateTime = 0;
      enemy.attack = kind;
      w.step(NO_INPUT, DT);
      for (let i = 0; i < 12; i++) w.step(NO_INPUT, DT);
    }
    expect(w.player.health).toBeGreaterThan(0);
    expect(w.enemies.length).toBeGreaterThan(0);
  });

  it('derives quest progress from the save without extra state', () => {
    const progress = { echoes: 0, restorations: { hearth: 2, armory: 2 }, checkpoint: 0 };
    const snapshot = questSnapshot(['a', 'b', 'c'], 60, progress);
    expect(snapshot).toEqual({ fragments: 3, kills: 60, restored: 4, depth: 0, bosses: 0 });
    const fragments = QUESTS.find((q) => q.kind === 'fragments')!;
    const kills = QUESTS.find((q) => q.kind === 'kills')!;
    expect(questProgress(fragments, snapshot)).toBe(3);
    expect(questProgress(kills, snapshot)).toBe(60);
    expect(restoredLevels(progress)).toBe(4);
  });
});

describe('duellists', () => {
  it('gives the duelist behaviour its own archetype', () => {
    expect(enemyDef('rime_duelist').archetype).toBe('duelist');
    expect(enemyDef('lost_self').archetype).toBe('duelist');
  });

  // Traps and blasts stagger anything they touch, so mechanics tests clear
  // the ground around their subject first.
  function clearHazardsNear(w: World, x: number, y: number, radius = 220): void {
    for (let i = w.hazards.length - 1; i >= 0; i--) {
      const h = w.hazards[i];
      if (Math.hypot(h.x - x, h.y - y) < radius) w.hazards.splice(i, 1);
    }
  }

  // Dungeon layouts shift as room kinds are added, so far spawn offsets can
  // land inside a wall. The behaviour under test needs open ground, not a
  // specific tile: nudge the spawn to the nearest open pixel with a clear
  // 80px runway to the west, so dashes and bolts never start inside stone.
  function spawnDuelist(w: World, x: number, y: number) {
    const clear = (sx: number, sy: number): boolean => {
      for (let d = 0; d <= 80; d += 16) {
        if (w.grid.isSolidAtPixel(sx - d, sy)) return false;
      }
      return true;
    };
    let best = { x, y };
    let bestDist = !w.grid.isSolidAtPixel(x, y) && clear(x, y) ? 0 : Infinity;
    for (let oy = -128; oy <= 128 && bestDist > 0; oy += 16) {
      for (let ox = -128; ox <= 128 && bestDist > 0; ox += 16) {
        if (w.grid.isSolidAtPixel(x + ox, y + oy) || !clear(x + ox, y + oy)) continue;
        const d = Math.hypot(ox, oy);
        if (d < bestDist) {
          bestDist = d;
          best = { x: x + ox, y: y + oy };
        }
      }
    }
    return w.spawnEnemy('rime_duelist', best.x, best.y, -1);
  }

  it('opens with a player-style attack at sword range', () => {
    const w = world(9);
    const duelist = w.spawnEnemy('rime_duelist', w.player.x + 60, w.player.y, -1);
    duelist.state = 'chase';
    duelist.cooldown = 0;
    for (let i = 0; i < 30 && duelist.state === 'chase'; i++) w.step(NO_INPUT, DT);
    expect(duelist.state).toBe('windup');
    expect(['combo', 'dashStrike', 'bolt']).toContain(duelist.attack);
  });

  it('chains three sword arcs that each land in front', () => {
    const w = world(9);
    const p = w.player;
    const duelist = w.spawnEnemy('rime_duelist', p.x + 40, p.y, -1);
    // Traps stagger attackers, which tests the dungeon rather than the combo.
    clearHazardsNear(w, duelist.x, duelist.y);
    duelist.state = 'windup';
    duelist.attack = 'combo';
    duelist.stateTime = 0;
    duelist.dirX = -1;
    duelist.dirY = 0;
    p.invulnerable = 0;
    const before = p.health;
    const slashes: number[] = [];
    // 60 steps: a heavy arc staggers the walker with a longer hitstop freeze,
    // stretching the combo past the old 45-step window. The arcs asserted
    // are unchanged.
    for (let i = 0; i < 60; i++)
      for (const event of w.step(NO_INPUT, DT))
        if (event.type === 'enemySlash') slashes.push(event.combo);
    expect(slashes).toEqual([0, 1, 2]);
    expect(p.health).toBeLessThan(before);
  });

  it('cannot touch a player standing behind the chain', () => {
    const w = world(9);
    const p = w.player;
    const duelist = w.spawnEnemy('rime_duelist', p.x + 70, p.y, -1);
    duelist.state = 'windup';
    duelist.attack = 'combo';
    duelist.stateTime = 0;
    duelist.dirX = 1;
    duelist.dirY = 0;
    p.x = duelist.x - 170;
    p.invulnerable = 0;
    const before = p.health;
    for (let i = 0; i < 45; i++) w.step(NO_INPUT, DT);
    expect(p.health).toBe(before);
  });

  it('cannot one-combo a player who arrives at its section', () => {
    const w = checkpointWorld(9);
    const p = w.player;
    const duelist = w.spawnEnemy('rime_duelist', p.x + 40, p.y, -1);
    clearHazardsNear(w, duelist.x, duelist.y);
    duelist.state = 'windup';
    duelist.attack = 'combo';
    duelist.stateTime = 0;
    duelist.dirX = -1;
    duelist.dirY = 0;
    p.invulnerable = 0;
    for (let i = 0; i < 45; i++) w.step(NO_INPUT, DT);
    expect(p.health).toBeGreaterThan(p.stats.maxHealth * 0.25);
  });

  it('fires a thin bolt of its own', () => {
    const w = world(9);
    const duelist = spawnDuelist(w, w.player.x + 240, w.player.y);
    duelist.state = 'windup';
    duelist.attack = 'bolt';
    duelist.stateTime = 0;
    duelist.dirX = -1;
    duelist.dirY = 0;
    w.step(NO_INPUT, DT);
    expect(w.projectiles.some((shot) => shot.owner === 'enemy')).toBe(true);
  });

  it('closes the gap with a dash strike', () => {
    const w = world(9);
    const p = w.player;
    // Spawn beside the player, where sibling tests prove the floor is open:
    // far offsets can sit a body-radius from a pillar and end the dash on
    // the first step, which tests the dungeon rather than the dash.
    const duelist = w.spawnEnemy('rime_duelist', p.x + 60, p.y, -1);
    duelist.state = 'windup';
    duelist.attack = 'dashStrike';
    duelist.stateTime = 0;
    duelist.dirX = -1;
    duelist.dirY = 0;
    const startX = duelist.x;
    for (let i = 0; i < 20; i++) w.step(NO_INPUT, DT);
    expect(duelist.x).toBeLessThan(startX - 40);
  });

  it('dashes about as far as its warning lane shows', () => {
    const w = world(9);
    const p = w.player;
    const room = w.floor.rooms.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    p.x = (room.x + room.w / 2) * TILE_SIZE;
    p.y = (room.y + room.h / 2) * TILE_SIZE;
    const duelist = w.spawnEnemy('rime_duelist', p.x + 40, p.y, room.id);
    const expected = dashStrikeRange(duelist.def);
    // Dash down the clearest lane so a wall does not cut the run short.
    const lanes = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    const clearance = (dir: { x: number; y: number }): number => {
      for (let d = 0; d <= expected + 40; d += 4) {
        const scan = { x: duelist.x + dir.x * d, y: duelist.y + dir.y * d };
        if (w.grid.isSolidAtPixel(scan.x, scan.y)) return d;
      }
      return expected + 40;
    };
    const lane = lanes.reduce((a, b) => (clearance(b) > clearance(a) ? b : a));
    const start = { x: duelist.x, y: duelist.y };
    duelist.state = 'windup';
    duelist.attack = 'dashStrike';
    duelist.stateTime = 0;
    duelist.dirX = lane.x;
    duelist.dirY = lane.y;
    for (let i = 0; i < 20; i++) w.step(NO_INPUT, DT);
    const travelled = Math.hypot(duelist.x - start.x, duelist.y - start.y);
    expect(travelled).toBeGreaterThan(expected * 0.6);
    expect(travelled).toBeLessThan(expected * 1.25);
  });
});

describe('the mirror of self', () => {
  it('opens its pattern with a player-style swing', () => {
    const w = world(17);
    const boss = w.spawnEnemy('mirror_self', w.player.x + 120, w.player.y, -1, true);
    boss.state = 'chase';
    boss.cooldown = 0;
    w.step(NO_INPUT, DT);
    expect(boss.state).toBe('windup');
    expect(['combo', 'dashStrike', 'bolt']).toContain(boss.attack);
  });

  it('grows stronger as the player levels', () => {
    const w = world(17);
    const low = w.spawnEnemy('mirror_self', w.player.x + 40, w.player.y, -1, true);
    w.player.level = 20;
    const high = w.spawnEnemy('mirror_self', w.player.x + 60, w.player.y, -1, true);
    expect(high.def.damage).toBeGreaterThan(low.def.damage);
  });

  it('cannot one-combo a player who reaches its trial', () => {
    const w = checkpointWorld(17);
    const p = w.player;
    const boss = w.spawnEnemy('mirror_self', p.x + 56, p.y, -1, true);
    clearHazardsAround(w, boss.x, boss.y);
    boss.state = 'windup';
    boss.attack = 'combo';
    boss.stateTime = 0;
    boss.dirX = -1;
    boss.dirY = 0;
    p.invulnerable = 0;
    for (let i = 0; i < 45; i++) w.step(NO_INPUT, DT);
    expect(p.health).toBeGreaterThan(p.stats.maxHealth * 0.25);
  });

  it('wears the player sheet in the mirror trial', () => {
    const w = world(17);
    expect(w.plan.boss).toBe('mirror_self');
    expect(w.plan.bossOnly).toBe(true);
    expect(enemyDef('mirror_self', true).sprite).toBe('mirror');
  });

  it('swings whichever stance the player holds', () => {
    for (const weapon of ['sword', 'spear', 'greatsword'] as const) {
      const w = world(17);
      const p = w.player;
      p.weapon = weapon;
      p.invulnerable = 9999;
      const boss = w.spawnEnemy('mirror_self', p.x + 50, p.y, -1, true);
      clearHazardsAround(w, boss.x, boss.y);
      boss.state = 'windup';
      boss.attack = 'combo';
      boss.stateTime = 0;
      boss.dirX = -1;
      boss.dirY = 0;
      const seen = new Set<string>();
      for (let i = 0; i < 45; i++)
        for (const event of w.step(NO_INPUT, DT))
          if (event.type === 'enemySlash') seen.add(event.weapon);
      expect([...seen]).toEqual([weapon]);
    }
  });

  it('keeps ordinary duellists on a plain sword', () => {
    const w = world(9);
    const p = w.player;
    p.weapon = 'greatsword';
    p.invulnerable = 9999;
    const duelist = w.spawnEnemy('rime_duelist', p.x + 40, p.y, -1);
    clearHazardsAround(w, duelist.x, duelist.y);
    duelist.state = 'windup';
    duelist.attack = 'combo';
    duelist.stateTime = 0;
    duelist.dirX = -1;
    duelist.dirY = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 45; i++)
      for (const event of w.step(NO_INPUT, DT))
        if (event.type === 'enemySlash') seen.add(event.weapon);
    expect([...seen]).toEqual(['sword']);
  });

  it('melee bosses swing heavy greatswords with shockwaves', () => {
    for (const bossId of [
      'dread_champion',
      'ruin_warlord',
      'drowned_blademaster',
      'storm_warlord',
    ]) {
      const w = world(16);
      const p = w.player;
      p.invulnerable = 9999;
      const boss = w.spawnEnemy(bossId, p.x + 40, p.y, -1, true);
      clearHazardsAround(w, boss.x, boss.y);
      boss.state = 'windup';
      boss.attack = 'combo';
      boss.stateTime = 0;
      boss.dirX = -1;
      boss.dirY = 0;
      const seen = new Set<string>();
      for (let i = 0; i < 45; i++)
        for (const event of w.step(NO_INPUT, DT))
          if (event.type === 'enemySlash') seen.add(event.weapon);
      expect([...seen]).toEqual(['greatsword']);
    }
  });

  it('phase stalkers use teleporter archetype to blink and strike', () => {
    const w = world(15);
    const p = w.player;
    p.invulnerable = 9999;
    const stalker = w.spawnEnemy('phase_stalker', p.x + 120, p.y, -1);
    expect(stalker.def.archetype).toBe('teleporter');
    stalker.state = 'chase';
    stalker.cooldown = 0;
    let blinked = false;
    for (let i = 0; i < 60; i++) {
      for (const event of w.step(NO_INPUT, DT)) {
        if (event.type === 'blink') blinked = true;
      }
      if (blinked) break;
    }
    expect(blinked).toBe(true);
  });

  it('centers the start room fountain and mounts levers on walls', () => {
    const w = world(0);
    const start = w.floor.rooms[w.floor.startRoom];
    const fountain = w.interactables.find((it) => it.kind === 'fountain');
    expect(fountain).toBeDefined();
    const centre = roomCentrePx(start);
    expect(fountain!.x).toBe(centre.x);
    expect(fountain!.y).toBe(centre.y);

    const lever = w.interactables.find((it) => it.kind === 'lever');
    if (lever) {
      const tx = Math.floor(lever.x / 32);
      const ty = Math.floor(lever.y / 32);
      const touchingWall =
        w.grid.isSolid(tx - 1, ty) ||
        w.grid.isSolid(tx + 1, ty) ||
        w.grid.isSolid(tx, ty - 1) ||
        w.grid.isSolid(tx, ty + 1);
      expect(touchingWall).toBe(true);
    }
  });

  it('dropPickup sanitizes spawn coordinates and prevents spawning inside walls or gates', () => {
    const w = world(0);
    // Find an impassable wall tile
    let wall: { x: number; y: number } | undefined;
    for (let ty = 0; ty < w.grid.height && !wall; ty++) {
      for (let tx = 0; tx < w.grid.width && !wall; tx++) {
        if (w.grid.get(tx, ty) === Tile.Wall) wall = { x: tx, y: ty };
      }
    }
    expect(wall).toBeDefined();
    const initialCount = w.pickups.length;
    // Attempt to drop a pickup deep inside the wall tile
    w['dropPickup']('shard', (wall!.x + 0.5) * TILE_SIZE, (wall!.y + 0.5) * TILE_SIZE, 5);
    expect(w.pickups.length).toBe(initialCount + 1);
    const dropped = w.pickups[w.pickups.length - 1];
    // Position must be safe on an open floor tile
    expect(w.grid.isSolidAtPixel(dropped.x, dropped.y, 'player')).toBe(false);
  });

  it('breakables roll variable-ratio surges and can emit lootSurge', () => {
    let surgeSeen = false;
    for (let seed = 0; seed < 40 && !surgeSeen; seed++) {
      const w = world(0, seed);
      const crate = w.hazards.find((h) => h.kind === 'crate' && !h.disabled);
      if (!crate) continue;
      const events = w['breakCrate'](crate, { x: crate.x, y: crate.y });
      // world.breakCrate emits events to world
      if (w.run.stats.surges > 0) {
        surgeSeen = true;
      }
    }
    // Across 40 seeds with crates, variable surge should trigger
    expect(surgeSeen).toBe(true);
  });

  it('cleared room expands pickup homing range to pull items toward player', () => {
    const w = world(0);
    const start = w.floor.rooms[w.floor.startRoom];
    // Mark room cleared
    w.rooms[start.id].phase = 'cleared';
    const centre = roomCentrePx(start);
    w.player.x = centre.x;
    w.player.y = centre.y;

    // Place a shard 180px away (beyond base pickupRadius of 64, but within cleared homing range of 260)
    w.pickups.push({
      id: 8888,
      kind: 'shard',
      x: centre.x + 180,
      y: centre.y,
      amount: 10,
      age: 0.5,
      vx: 0,
      vy: 0,
    });

    w.step(NO_INPUT, DT);
    const shard = w.pickups.find((it) => it.id === 8888);
    expect(shard).toBeDefined();
    // Shard should have acquired a negative vx homing towards player at centre.x
    expect(shard!.vx).toBeLessThan(0);
  });
});

describe('player stagger', () => {
  it('heavy blows interrupt swings and slow the walker', () => {
    const w = world(0);
    const p = w.player;
    p.swingTime = 0.2;
    p.action = 'attack';
    p.invulnerable = 0;
    // A 260-knockback hit is always heavy, whatever the damage.
    w.damagePlayer(5, p.x + 10, p.y, 300);
    expect(p.stagger).toBeGreaterThan(0);
    expect(p.swingTime).toBeLessThan(0);
    expect(p.action).toBe('idle');
  });

  it('light blows do not stagger', () => {
    const w = world(0);
    const p = w.player;
    p.invulnerable = 0;
    w.damagePlayer(1, p.x + 10, p.y, 50);
    expect(p.stagger).toBe(0);
  });

  it('staggered walkers cannot start swings until they recover', () => {
    const w = world(0);
    const p = w.player;
    p.invulnerable = 9999;
    p.stagger = 0.4;
    w.step({ ...NO_INPUT, attack: true }, DT);
    expect(p.swingTime).toBeLessThan(0);
    p.stagger = 0;
    w.step({ ...NO_INPUT, attack: true }, DT);
    expect(p.swingTime).toBeGreaterThanOrEqual(0);
  });
});

describe('engagement mechanics', () => {
  it('pays clutch shards for kills landed near death', () => {
    const w = world(0);
    const p = w.player;
    p.invulnerable = 0;
    p.health = Math.round(p.stats.maxHealth * 0.2);
    const foe = w.spawnEnemy('scavenger', p.x + 40, p.y, -1);
    foe.state = 'chase';
    w.damageEnemy(foe, 99999, 'melee', false, 0);
    expect(w.run.stats.clutchKills).toBe(1);
    // The comeback pays out as dropped shards at the kill site.
    expect(w.pickups.some((it) => it.kind === 'shard' && Math.hypot(it.x - foe.x, it.y - foe.y) < 120)).toBe(true);
  });

  it('no clutch bonus when the walker is healthy', () => {
    const w = world(0);
    const p = w.player;
    p.invulnerable = 0;
    p.health = p.stats.maxHealth;
    const foe = w.spawnEnemy('scavenger', p.x + 40, p.y, -1);
    foe.state = 'chase';
    w.damageEnemy(foe, 99999, 'melee', false, 0);
    expect(w.run.stats.clutchKills).toBe(0);
  });

  it('a soul anchor shatters instead of the walker, once', () => {
    const w = world(0);
    const p = w.player;
    p.invulnerable = 0;
    p.equipment.trinket = { uid: 4242, defId: 'soul_anchor' };
    w.damagePlayer(99999, p.x + 10, p.y, 0);
    expect(p.health).toBeGreaterThan(0);
    expect(p.equipment.trinket).toBeNull();
    expect(p.invulnerable).toBeGreaterThan(0);
    // Spent: the next lethal blow lands (after the anchor's iframes fade).
    p.invulnerable = 0;
    w.damagePlayer(99999, p.x + 10, p.y, 0);
    expect(p.health).toBe(0);
  });

  it('a sealed cache warns first, then pays double for blood and company', () => {
    const w = world(0);
    const p = w.player;
    p.invulnerable = 0;
    const cache = w.interactables.find((i) => i.kind === 'cache');
    expect(cache).toBeDefined();
    p.x = cache!.x;
    p.y = cache!.y + 30;
    const foesBefore = w.enemies.length;
    w.step({ ...NO_INPUT, interact: true }, DT);
    expect(cache!.used).toBe(false);
    expect(cache!.armed).toBe(true);
    expect(w.enemies.length).toBe(foesBefore);
    w.step({ ...NO_INPUT, interact: true }, DT);
    expect(cache!.used).toBe(true);
    expect(w.enemies.length).toBe(foesBefore + 2);
    expect(p.health).toBeLessThan(p.stats.maxHealth);
  });

  it('tracks the field-manual checklist as the walker acts', () => {
    const w = world(0);
    const p = w.player;
    p.invulnerable = 9999;
    expect(w.run.stats.onboarding).toBe(0);
    w.step({ ...NO_INPUT, attack: true }, DT);
    expect(w.run.stats.onboarding & 1).toBe(1);
    w.step({ ...NO_INPUT, bolt: true }, DT);
    expect(w.run.stats.onboarding & 2).toBe(2);
    w.step({ ...NO_INPUT, dash: true, moveX: 1, moveY: 0 }, DT);
    expect(w.run.stats.onboarding & 4).toBe(4);
    w.step({ ...NO_INPUT, potion: true }, DT);
    expect(w.run.stats.onboarding & 8).toBe(8);
  });
});

describe('trust and the friends share', () => {
  it('starts strangers at zero and caps at three hearts', () => {
    expect(trustLevel({ trust: {} }, 'smith')).toBe(0);
    expect(trustLevel({ trust: { smith: 2 } }, 'smith')).toBe(2);
    expect(trustLevel({ trust: { smith: 9 } }, 'smith')).toBe(3);
    expect(trustBonus(70, 0)).toBe(0);
    expect(trustBonus(70, 2)).toBe(35);
  });

  it('settles claims with bonus, relic, claim and deeper trust', () => {
    const quest = questDef('edges')!;
    const after = applyQuestClaim(
      { echoes: 0, vault: [], trust: {}, trustGifted: [], quests: { accepted: ['edges'], claimed: [], acceptedAt: {} } },
      'smith',
      quest
    );
    expect(after.echoes).toBe(50);
    expect(after.vault).toEqual(['echo_dagger']);
    expect(after.quests.claimed).toEqual(['edges']);
    expect(after.trust).toEqual({ smith: 1 });
    const again = applyQuestClaim({ echoes: 0, vault: ['echo_dagger'], trust: { smith: 1 }, trustGifted: [], quests: { accepted: [], claimed: [], acceptedAt: {} } }, 'smith', quest);
    expect(again.echoes).toBe(50 + 13);
    expect(again.vault).toEqual(['echo_dagger']);
    expect(again.trust).toEqual({ smith: 2 });
  });

  it('pays a rush bonus for fast claims, nothing for slow ones', () => {
    const quest = questDef('edges')!;
    const base = { echoes: 0, vault: [], trust: {}, trustGifted: [] };
    const quick = applyQuestClaim(
      { ...base, quests: { accepted: ['edges'], claimed: [], acceptedAt: { edges: 1_000_000 } } },
      'smith',
      quest,
      1_000_000 + 10 * 60 * 1000
    );
    expect(quick.rush).toBe(25);
    expect(quick.echoes).toBe(50 + 25);
    const slow = applyQuestClaim(
      { ...base, quests: { accepted: ['edges'], claimed: [], acceptedAt: { edges: 1_000_000 } } },
      'smith',
      quest,
      1_000_000 + 31 * 60 * 1000
    );
    expect(slow.rush).toBe(0);
    expect(slow.echoes).toBe(50);
    const never = applyQuestClaim(
      { ...base, quests: { accepted: ['edges'], claimed: [], acceptedAt: {} } },
      'smith',
      quest
    );
    expect(never.rush).toBe(0);
    expect(rushMinutesLeft(undefined)).toBe(0);
    expect(rushMinutesLeft(1_000_000, 1_000_000 + 29 * 60 * 1000)).toBe(1);
  });

  it('trades echoes for trust, one heart at a time', () => {
    const base = { echoes: 500, vault: [], trust: {}, trustGifted: [] };
    const once = applyTribute(base, 'smith')!;
    expect(once.echoes).toBe(400);
    expect(once.trust).toEqual({ smith: 1 });
    expect(once.gift).toBeUndefined();
    const broke = applyTribute({ ...base, echoes: 50 }, 'smith');
    expect(broke).toBeUndefined();
    const maxed = applyTribute({ ...base, trust: { smith: 3 } }, 'smith');
    expect(maxed).toBeUndefined();
  });

  it('hands a one-time parting gift at full trust', () => {
    const quest = questDef('edges')!;
    const third = applyQuestClaim({ echoes: 0, vault: [], trust: { smith: 2 }, trustGifted: [], quests: { accepted: ['edges'], claimed: [], acceptedAt: {} } }, 'smith', quest);
    expect(third.trust).toEqual({ smith: 3 });
    expect(third.gift).toBeDefined();
    expect(third.vault).toContain(third.gift);
    expect(third.trustGifted).toEqual(['smith']);
    // One per resident: the next claim brings no second gift.
    const fourth = applyQuestClaim({ echoes: 0, vault: third.vault, trust: { smith: 3 }, trustGifted: ['smith'], quests: { accepted: [], claimed: [], acceptedAt: {} } }, 'smith', quest);
    expect(fourth.gift).toBeUndefined();
  });
});

describe('daily mark', () => {
  it('names the same mark for a key and varies across days', () => {
    expect(dailyBounty('2026-11-02').defId).toBe(dailyBounty('2026-11-02').defId);
    const ids = new Set(
      ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'].map(
        (k) => dailyBounty(k).defId
      )
    );
    expect(ids.size).toBeGreaterThan(1);
    expect(dailyBounty('2026-11-02').target).toBe(12);
  });

  it('claims once per day at full progress and resets on a new key', () => {
    const contract = dailyBounty('2026-11-02');
    const meta = { echoes: 0, dailyBounty: { key: '2026-11-02', kills: 12, claimed: false } };
    const settled = claimDailyBounty(meta, '2026-11-02');
    expect(settled?.echoes).toBe(contract.reward);
    expect(settled?.dailyBounty.claimed).toBe(true);
    expect(claimDailyBounty({ echoes: 0, dailyBounty: { key: '2026-11-02', kills: 12, claimed: true } }, '2026-11-02')).toBeUndefined();
    expect(claimDailyBounty({ echoes: 0, dailyBounty: { key: '2026-11-02', kills: 11, claimed: false } }, '2026-11-02')).toBeUndefined();
    expect(bountyForDay({ key: '2026-11-02', kills: 12, claimed: true }, '2026-11-03')).toEqual({
      key: '2026-11-03',
      kills: 0,
      claimed: false,
    });
  });
});

describe('hunter pressure', () => {
  it('sends an elite stalker into the room after every third clear', () => {
    const w = world(9);
    const combats = w.floor.rooms.filter((r) => r.kind === 'combat');
    expect(combats.length).toBeGreaterThanOrEqual(4);
    const clearRoomByForce = (roomId: number): void => {
      // Up to 10 waves plus ambushes can take a while at depth 9; the loop
      // only ends when the room actually clears. Kills level the walker, and
      // the sim pauses while a choice is pending, so spend every upgrade.
      for (let i = 0; i < 2500 && w.rooms[roomId].phase !== 'cleared'; i++) {
        for (const e of [...w.enemies]) {
          if (e.roomId === roomId && e.state !== 'dying') {
            e.state = 'chase';
            w.damageEnemy(e, 99999, 'melee', false, 0);
          }
        }
        while (w.run.pendingChoices.length > 0) {
          w.chooseUpgrade(w.run.pendingChoices[0].options[0]);
        }
        w.step(NO_INPUT, DT);
      }
      expect(w.rooms[roomId].phase).toBe('cleared');
    };
    const centreOf = (id: number): { x: number; y: number } => {
      const r = w.floor.rooms[id];
      return { x: (r.x + r.w / 2) * 32, y: (r.y + r.h / 2) * 32 };
    };
    // Clear three combat rooms in turn.
    for (const room of combats.slice(0, 3)) {
      const c = centreOf(room.id);
      w.player.x = c.x;
      w.player.y = c.y;
      w.player.invulnerable = 9999;
      for (let i = 0; i < 5; i++) w.step(NO_INPUT, DT);
      clearRoomByForce(room.id);
    }
    // The next activation carries the stalker.
    const fourth = combats[3];
    const c = centreOf(fourth.id);
    w.player.x = c.x;
    w.player.y = c.y;
    const seen: string[] = [];
    for (let i = 0; i < 10; i++) for (const e of w.step(NO_INPUT, DT)) if (e.type === 'notice') seen.push(e.text);
    expect(seen.some((t) => t.includes('stalker'))).toBe(true);
    expect(w.enemies.some((e) => e.elite && e.roomId === fourth.id)).toBe(true);
  });

  it('brings the armed stalker into a guardian fight instead of dropping it', () => {
    const w = world(9);
    const combats = w.floor.rooms.filter((r) => r.kind === 'combat');
    expect(combats.length).toBeGreaterThanOrEqual(3);
    const bossRoom = w.floor.rooms[w.floor.bossRoom];
    const clearRoomByForce = (roomId: number): void => {
      for (let i = 0; i < 2500 && w.rooms[roomId].phase !== 'cleared'; i++) {
        for (const e of [...w.enemies]) {
          if (e.roomId === roomId && e.state !== 'dying') {
            e.state = 'chase';
            w.damageEnemy(e, 99999, 'melee', false, 0);
          }
        }
        while (w.run.pendingChoices.length > 0) {
          w.chooseUpgrade(w.run.pendingChoices[0].options[0]);
        }
        w.step(NO_INPUT, DT);
      }
      expect(w.rooms[roomId].phase).toBe('cleared');
    };
    const centreOf = (id: number): { x: number; y: number } => {
      const r = w.floor.rooms[id];
      return { x: (r.x + r.w / 2) * 32, y: (r.y + r.h / 2) * 32 };
    };
    for (const room of combats.slice(0, 3)) {
      const c = centreOf(room.id);
      w.player.x = c.x;
      w.player.y = c.y;
      w.player.invulnerable = 9999;
      for (let i = 0; i < 5; i++) w.step(NO_INPUT, DT);
      clearRoomByForce(room.id);
    }
    expect(w.isStalked).toBe(true);

    const c = centreOf(bossRoom.id);
    w.player.x = c.x;
    w.player.y = c.y;
    const seen: string[] = [];
    for (let i = 0; i < 120; i++) {
      for (const e of w.step(NO_INPUT, DT)) if (e.type === 'notice') seen.push(e.text);
    }

    expect(w.isStalked).toBe(false);
    expect(w.enemies.some((e) => e.elite && !e.isBoss && e.roomId === bossRoom.id)).toBe(true);
    expect(seen.some((t) => t.toLowerCase().includes('stalker'))).toBe(true);
  });
});

describe('daily twists', () => {
  it('picks the same twist for a key and varies across days', () => {
    expect(dailyModifier('2026-11-02').id).toBe(dailyModifier('2026-11-02').id);
    const ids = new Set(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((k) => dailyModifier(k).id));
    expect(ids.size).toBeGreaterThan(1);
  });

  it('heavy air sharpens incoming blows and keen edge sharpens outgoing ones', () => {
    const heavy = new World(createRun(7, []));
    heavy.run.dailyMod = 'heavy_air';
    const plain = new World(createRun(7, []));
    for (const w of [heavy, plain]) w.player.invulnerable = 0;
    heavy.damagePlayer(30, heavy.player.x + 10, heavy.player.y, 0);
    plain.damagePlayer(30, plain.player.x + 10, plain.player.y, 0);
    expect(heavy.player.health).toBeLessThan(plain.player.health);

    const keen = new World(createRun(7, []));
    keen.run.dailyMod = 'keen_edge';
    const foeK = keen.spawnEnemy('scavenger', keen.player.x + 60, keen.player.y, -1);
    foeK.state = 'chase';
    const foeP = plain.spawnEnemy('scavenger', plain.player.x + 60, plain.player.y, -1);
    foeP.state = 'chase';
    const hp = foeK.health;
    keen.damageEnemy(foeK, 20, 'melee', false, 0);
    plain.damageEnemy(foeP, 20, 'melee', false, 0);
    expect(hp - foeK.health).toBeGreaterThan(hp - foeP.health);
  });
});

describe('death recap and feat progress', () => {
  it('records where the run fell', () => {
    const w = world(0);
    const p = w.player;
    p.invulnerable = 0;
    w.damagePlayer(99999, p.x + 10, p.y, 0);
    expect(w.run.deathSection).toBe(1);
    expect(typeof w.run.deathRoom === 'string' || w.run.deathRoom === undefined).toBe(true);
  });

  it('previews unfinished countable feats', () => {
    expect(featProgress('slayer', { kills: 320, bestDepth: 0, bestResonance: 0, victories: 0 })).toEqual({ current: 320, target: 500 });
    expect(featProgress('delver', { kills: 0, bestDepth: 12, bestResonance: 0, victories: 0 })).toEqual({ current: 8, target: 8 });
    expect(featProgress('victor', { kills: 0, bestDepth: 0, bestResonance: 0, victories: 3 })).toEqual({ current: 1, target: 1 });
    expect(featProgress('executioner', { kills: 0, bestDepth: 0, bestResonance: 0, victories: 0 })).toBeUndefined();
  });
});

describe('flow milestones', () => {
  it('names streaks at widening milestones and stays quiet otherwise', () => {
    expect(flowMilestone(4)).toBeUndefined();
    expect(flowMilestone(5)).toContain('x5');
    expect(flowMilestone(10)).toContain('x10');
    expect(flowMilestone(15)).toContain('x15');
    expect(flowMilestone(19)).toBeUndefined();
    expect(flowMilestone(20)).toContain('x20');
    expect(flowMilestone(30)).toContain('x30');
  });
});

describe('difficulty', () => {
  function diffWorld(difficulty: 'story' | 'normal' | 'nightmare'): World {
    const run = createRun(7, [], difficulty);
    return new World(run);
  }

  it('story softens incoming blows and sharpens outgoing ones', () => {
    const story = diffWorld('story');
    const normal = diffWorld('normal');
    story.player.invulnerable = 0;
    normal.player.invulnerable = 0;
    const px = story.player.x;
    const py = story.player.y;
    story.damagePlayer(100, px + 10, py, 0);
    normal.damagePlayer(100, px + 10, py, 0);
    expect(story.player.health).toBeGreaterThan(normal.player.health);
    const foe = story.spawnEnemy('scavenger', px + 60, py, -1);
    const foeN = normal.spawnEnemy('scavenger', px + 60, py, -1);
    const hp = foe.health;
    story.damageEnemy(foe, 100, 'melee', false, 0);
    normal.damageEnemy(foeN, 100, 'melee', false, 0);
    expect(hp - foe.health).toBeGreaterThan(hp - foeN.health);
  });

  it('nightmare sharpens incoming blows and thickens enemy hides', () => {
    const hard = diffWorld('nightmare');
    const normal = diffWorld('normal');
    hard.player.invulnerable = 0;
    normal.player.invulnerable = 0;
    const px = hard.player.x;
    hard.damagePlayer(30, px + 10, hard.player.y, 0);
    normal.damagePlayer(30, px + 10, normal.player.y, 0);
    expect(hard.player.health).toBeLessThan(normal.player.health);
    const foe = hard.spawnEnemy('scavenger', px + 60, hard.player.y, -1);
    const foeN = normal.spawnEnemy('scavenger', px + 60, normal.player.y, -1);
    expect(foe.maxHealth).toBeGreaterThan(foeN.maxHealth);
  });

  it('defaults old saves without a difficulty to normal', () => {
    const run = createRun(7, []);
    delete (run as { difficulty?: unknown }).difficulty;
    const restored = restoreRun(JSON.parse(JSON.stringify(run)))!;
    expect(restored.difficulty).toBe('normal');
  });
});
