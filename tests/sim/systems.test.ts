import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../../src/sim/entities';
import { generateFloor } from '../../src/sim/dungeon';
import { createRun } from '../../src/sim/run';
import { World } from '../../src/sim/world';
import {
  applyEquipment,
  emptyEquipment,
  EQUIPMENT,
  equipmentDef,
  rollEquipment,
} from '../../src/sim/equipment';
import { computeStats } from '../../src/sim/upgrades';
import { Rng } from '../../src/sim/rng';
import { questProgress, questSnapshot, QUESTS } from '../../src/sim/quests';
import { restoredLevels } from '../../src/sim/hub';
import {
  SANCTUARY_DECOR,
  SANCTUARY_GATE,
  SANCTUARY_NPCS,
  SANCTUARY_STRUCTURES,
} from '../../src/sim/sanctuary';

const DT = 1 / 60;

function world(depth = 0, seed = 7): World {
  const run = createRun(seed, []);
  run.depth = depth;
  return new World(run);
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

  it('builds a walkable sanctuary with structures, NPCs and a gate', () => {
    const run = createRun(1, []);
    const w = new World(run, { sanctuary: true });
    expect(w.mode).toBe('sanctuary');
    expect(w.enemies).toHaveLength(0);
    expect(w.hazards).toHaveLength(0);
    expect(w.interactables.filter((i) => i.kind === 'structure')).toHaveLength(10);
    expect(w.interactables.filter((i) => i.kind === 'npc')).toHaveLength(5);
    expect(w.interactables.some((i) => i.kind === 'gate')).toBe(true);
    expect(w.decor.length).toBeGreaterThan(10);
  });

  it('emits a sanctuary event when interacting with a structure or NPC', () => {
    const run = createRun(1, []);
    const w = new World(run, { sanctuary: true });
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
      [10, 'hollow_behemoth'],
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

  it('keeps all sanctuary structures, NPCs, gate and above-ground decor on distinct tiles and blocks combat consumables', () => {
    const occupied = new Set<string>();
    const spots = [
      ...SANCTUARY_STRUCTURES,
      ...SANCTUARY_NPCS,
      SANCTUARY_GATE,
      ...SANCTUARY_DECOR.filter((d) => d.layer !== 'ground'),
    ];
    for (const s of spots) {
      const key = `${s.tx},${s.ty}`;
      expect(occupied.has(key)).toBe(false);
      occupied.add(key);
    }

    const w = new World(createRun(12, []), { sanctuary: true });
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

  it('uses all four structural layouts across the sections', () => {
    const layouts = new Set(
      Array.from({ length: 16 }, (_, depth) => world(depth, 5 + depth).plan.layout)
    );
    expect(layouts).toEqual(new Set(['branch', 'ring', 'spine', 'grid', 'diamond', 'cross']));
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
