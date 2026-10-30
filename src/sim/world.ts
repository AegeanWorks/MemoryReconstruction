/**
 * One dungeon floor in play. `step` advances the simulation by a fixed time
 * step and returns the events that happened; nothing here touches the DOM or
 * the renderer, so tests and bots can drive a World headlessly.
 */
import { circlesTouch, type Arena, type DamageSource } from './combat';
import {
  arenaBossFor,
  enemyDef,
  fragmentsForFloor,
  floorPlan,
  FINAL_DEPTH,
  type FloorPlan,
} from './content';
import { generateFloor, roomAt, roomCentrePx, type FloorMap, type Room } from './dungeon';
import {
  buildingById,
  buildBuildingFloor,
  INTERIOR_EXIT,
  INTERIOR_RESIDENT,
  INTERIOR_SPAWN,
  spotToPixels,
  type SanctuaryBuilding,
} from './sanctuary';
import { createEnemy, killEnemy, staggerEnemy, updateBossPhase, updateEnemy } from './enemies';
import { equipmentDef, rollEquipment, type EquipmentItem } from './equipment';
import { NPCS } from './quests';
import type {
  Blast,
  Bomb,
  Enemy,
  Hazard,
  HazardKind,
  InputFrame,
  Interactable,
  Mine,
  Pickup,
  Projectile,
} from './entities';
import type { SimEvent } from './events';
import { FlowField } from './pathing';
import { moveAndCollide, separate } from './physics';
import { refreshStats, updatePlayer } from './player';
import { Rng, floorSeed } from './rng';
import {
  applyChoice,
  grantXp,
  resonanceMultiplier,
  RESONANCE_MAX,
  RESONANCE_WINDOW,
  type RunState,
} from './run';
import { TILE_SIZE } from './tiles';
import { rollChoices } from './upgrades';

export type RoomPhase = 'dormant' | 'active' | 'cleared';

export interface RoomState {
  phase: RoomPhase;
  wavesLeft: number;
  /** Seconds until the next wave (or the boss) appears while active. */
  spawnDelay: number;
  /** A room that has already sprung its surprise ambush. */
  ambushed?: boolean;
}

const INTERACT_RADIUS = 44;
/** Seconds between flow-field refreshes; the player moves under two tiles in that time. */
const FLOW_REFRESH = 0.2;
const HURT_IFRAMES = 0.75;
/** Shards refunded per graze, and dash charge restored. */
const GRAZE_MANA = 8;
const GRAZE_DASH = 0.25;
/** Near-miss margin for enemy projectiles. */
const GRAZE_SHOT = 18;
/** Variable-ratio shard rolls: jackpot below this, rich below the second. */
const SURGE_JACKPOT = 0.06;
const SURGE_RICH = 0.24;

/** Progress of the optional full-clear objective on this floor. */
export interface FloorObjectives {
  roomsCleared: number;
  roomsTotal: number;
  chestFound: boolean;
  chestUsed: boolean;
  wellFound: boolean;
  wellUsed: boolean;
  /** Every combat room cleared and every chest opened. */
  complete: boolean;
  /** The bonus has already been paid for this floor. */
  claimed: boolean;
}

export class World implements Arena {
  readonly floor: FloorMap;
  readonly plan: FloorPlan;
  /** 'sanctuary' worlds are a quiet home base with no combat. */
  readonly mode: 'dungeon' | 'sanctuary';
  get roster(): readonly string[] {
    return this.plan.roster;
  }
  get depth(): number {
    return this.run.depth;
  }
  readonly rng: Rng;
  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectile[] = [];
  readonly pickups: Pickup[] = [];
  readonly interactables: Interactable[] = [];
  readonly hazards: Hazard[] = [];
  /** Non-interactive furniture in the Sanctuary. */
  readonly decor: Array<{
    x: number;
    y: number;
    prop: string;
    size: number;
    layer?: 'ground';
  }> = [];
  /**
   * The building whose interior this world is, if any. A Sanctuary interior
   * world is always exactly one room, so this is fixed at construction.
   */
  readonly activeBuilding: string | undefined;
  readonly blasts: Blast[] = [];
  readonly mines: Mine[] = [];
  readonly bombs: Bomb[] = [];
  readonly rooms: RoomState[];
  readonly visited: boolean[];
  /** Seconds of play on this floor. */
  time = 0;
  exited = false;
  victory = false;
  private nextId = 1;
  private freeze = 0;
  private events: SimEvent[] = [];
  private fragmentQueue: string[];
  private victoryDelay = -1;
  private readonly flow: FlowField;
  private flowTimer = 0;
  private bonusClaimed = false;
  /** Damage taken since the active room was locked, for the flawless bonus. */
  private roomDamage = 0;

  constructor(
    readonly run: RunState,
    options: { sanctuary?: boolean; building?: string } = {}
  ) {
    if (options.sanctuary) {
      const building = buildingById(options.building ?? '');
      if (!building) throw new Error(`Unknown Sanctuary building: ${options.building ?? ''}`);
      this.mode = 'sanctuary';
      this.activeBuilding = building.id;
      this.plan = {
        depth: 0,
        biome: building.theme,
        roster: [],
        boss: 'keeper',
        roomCount: 1,
        finale: false,
        layout: 'branch',
      };
      this.floor = buildBuildingFloor(building);
      this.rng = new Rng(0x5a17c0de);
      this.rooms = [{ phase: 'cleared', wavesLeft: 0, spawnDelay: 0 }];
      this.visited = [true];
      this.flow = new FlowField(this.floor.grid);
      this.fragmentQueue = [];
      const spawn = spotToPixels(INTERIOR_SPAWN);
      run.player.x = spawn.x;
      run.player.y = spawn.y;
      run.player.action = 'idle';
      run.player.knockX = 0;
      run.player.knockY = 0;
      this.placeBuilding(building);
      return;
    }
    this.mode = 'dungeon';
    this.activeBuilding = undefined;
    this.plan = floorPlan(run.depth);
    const seed = floorSeed(run.seed, run.depth);
    this.floor = generateFloor(seed, run.depth, {
      roomCount: this.plan.roomCount,
      finale: this.plan.finale,
      layout: this.plan.layout,
      bossOnly: this.plan.bossOnly,
    });
    this.rng = new Rng(seed ^ 0x5bd1e995);
    this.rooms = this.floor.rooms.map((r) => ({
      phase: r.kind === 'combat' || r.kind === 'boss' || r.kind === 'arena' ? 'dormant' : 'cleared',
      wavesLeft: 0,
      spawnDelay: 0,
    }));
    this.visited = this.floor.rooms.map((_, i) => i === this.floor.startRoom);
    this.flow = new FlowField(this.floor.grid);
    const owned = new Set([...run.knownFragments, ...run.fragmentsFound]);
    this.fragmentQueue = fragmentsForFloor(this.plan.biome, owned);

    const start = roomCentrePx(this.floor.rooms[this.floor.startRoom]);
    run.player.x = start.x;
    run.player.y = start.y + TILE_SIZE * (this.plan.bossOnly ? 3.5 : 2);
    run.player.action = 'idle';
    run.player.knockX = 0;
    run.player.knockY = 0;
    this.placeInteractables();
    this.placeHazards();
  }

  get grid(): FloorMap['grid'] {
    return this.floor.grid;
  }

  get player(): RunState['player'] {
    return this.run.player;
  }

  get dead(): boolean {
    return this.run.player.action === 'dead';
  }

  /** True while the sim waits for the player to pick an upgrade. */
  get awaitingChoice(): boolean {
    return this.run.pendingChoices.length > 0;
  }

  /** The room the player is standing in, if any. */
  currentRoom(): Room | undefined {
    return roomAt(this.floor, this.player.x, this.player.y);
  }

  /** The interactable in reach, for the UI's prompt. */
  nearbyInteractable(): Interactable | undefined {
    const p = this.player;
    return this.interactables.find(
      (i) => !i.used && Math.hypot(i.x - p.x, i.y - p.y) <= INTERACT_RADIUS
    );
  }

  /** Living boss of the current floor, for the boss health bar. */
  activeBoss(): Enemy | undefined {
    return this.enemies.find((e) => e.isBoss && e.state !== 'dying');
  }

  chooseUpgrade(upgradeId: string): void {
    applyChoice(this.run, upgradeId);
  }

  /**
   * Advances one fixed step and returns every event queued since the last
   * call, including any raised between steps (e.g. by tests or debug tools).
   */
  step(input: InputFrame, dt: number): SimEvent[] {
    this.advance(input, dt);
    const events = this.events;
    this.events = [];
    return events;
  }

  private advance(input: InputFrame, dt: number): void {
    if (this.exited || this.awaitingChoice) return;
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    this.time += dt;
    if (this.mode === 'sanctuary') {
      updatePlayer(this, { ...input, bolt: false, bomb: false, trap: false, potion: false }, dt);
      if (input.interact) this.interact();
      return;
    }
    this.run.stats.elapsed += dt;

    updatePlayer(this, input, dt);
    if (input.interact) this.interact();
    this.updateRooms(dt);
    this.flowTimer -= dt;
    if (this.flowTimer <= 0 && this.enemies.length > 0) {
      this.flowTimer = FLOW_REFRESH;
      this.flow.update(this.player.x, this.player.y);
    }
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateBlasts(dt);
    this.updateMines(dt);
    this.updateBombs(dt);
    this.separateBodies();
    this.updatePickups(dt);
    if (this.victoryDelay > 0) {
      this.victoryDelay -= dt;
      if (this.victoryDelay <= 0) {
        this.victory = true;
        this.emit({ type: 'victory' });
      }
    }
  }

  // ----- Arena -----

  emit(event: SimEvent): void {
    this.events.push(event);
  }

  chaseDirection(x: number, y: number): { x: number; y: number } | undefined {
    return this.flow.direction(x, y);
  }

  hitstop(seconds: number): void {
    this.freeze = Math.max(this.freeze, seconds);
  }

  /** Rewards a near miss: mana, a sliver of dash charge and a longer flow window. */
  graze(x: number, y: number): void {
    const p = this.player;
    if (p.action === 'dead') return;
    p.mana = Math.min(p.stats.maxMana, p.mana + GRAZE_MANA);
    p.dashCharges = Math.min(p.stats.dashCharges, p.dashCharges + GRAZE_DASH);
    p.resonanceTime = Math.max(p.resonanceTime, RESONANCE_WINDOW * 0.5);
    this.run.stats.grazes++;
    this.emit({ type: 'graze', x, y });
  }

  /** Optional full-clear objective, surfaced by the HUD and the map. */
  floorObjectives(): FloorObjectives {
    const rooms = this.floor.rooms.filter(
      (r) => r.kind === 'combat' || r.kind === 'boss' || r.kind === 'arena'
    );
    const cleared = rooms.filter((r) => this.rooms[r.id].phase === 'cleared').length;
    const chest = this.interactables.filter((i) => i.kind === 'chest');
    const well = this.interactables.filter((i) => i.kind === 'shrine');
    const chestUsed = chest.length > 0 && chest.every((i) => i.used);
    const wellUsed = well.length > 0 && well.every((i) => i.used);
    return {
      roomsCleared: cleared,
      roomsTotal: rooms.length,
      chestFound: chest.length > 0,
      chestUsed,
      wellFound: well.length > 0,
      wellUsed,
      complete: cleared === rooms.length && (!chest.length || chestUsed),
      claimed: this.bonusClaimed,
    };
  }

  /** Shards a choice reroll costs on this floor. */
  rerollCost(): number {
    return 20 + 10 * this.run.depth;
  }

  /** Buys a fresh set of options for the pending choice. Returns false when unaffordable. */
  rerollChoices(): boolean {
    const choice = this.run.pendingChoices[0];
    if (!choice || choice.options.length === 0) return false;
    const cost = this.rerollCost();
    if (this.player.shards < cost) return false;
    // Chest and shrine offers keep their better odds; only a level-up is a plain roll.
    const luck = choice.source === 'level' ? 'normal' : 'generous';
    const options = rollChoices(this.rng, this.player.upgrades, 3, luck);
    if (options.length === 0) return false;
    this.player.shards -= cost;
    choice.options = options;
    return true;
  }

  damageEnemy(
    enemy: Enemy,
    amount: number,
    source: DamageSource,
    crit: boolean,
    knockback: number
  ): number {
    if (enemy.state === 'spawning' || enemy.state === 'dying') return 0;
    const dealt = Math.min(enemy.health, amount);
    enemy.health -= dealt;
    enemy.flash = 0.1;
    const p = this.player;
    const away = Math.atan2(enemy.y - p.y, enemy.x - p.x);
    const resist = enemy.isBoss ? 0.15 : enemy.def.archetype === 'brute' ? 0.4 : 1;
    enemy.knockX += Math.cos(away) * knockback * resist;
    enemy.knockY += Math.sin(away) * knockback * resist;
    this.run.stats.damageDealt += dealt;
    this.emit({
      type: 'hit',
      x: enemy.x,
      y: enemy.y - enemy.radius,
      amount: dealt,
      crit,
      target: 'enemy',
    });
    if (source === 'melee' && p.stats.lifesteal > 0) {
      p.health = Math.min(p.stats.maxHealth, p.health + dealt * p.stats.lifesteal);
    }
    if (enemy.health <= 0) this.onEnemyKilled(enemy);
    else {
      staggerEnemy(enemy);
      if (updateBossPhase(enemy)) {
        this.emit({ type: 'bossPhase', phase: enemy.phase });
        this.emit({ type: 'shake', strength: 8 });
      }
    }
    return dealt;
  }

  damagePlayer(amount: number, fromX: number, fromY: number, knockback: number): void {
    const p = this.player;
    if (p.invulnerable > 0 || p.action === 'dead') return;
    const taken = Math.max(1, Math.round(amount * (1 - p.stats.damageReduction)));
    p.health = Math.max(0, p.health - taken);
    p.invulnerable = HURT_IFRAMES;
    p.hurtFlash = 0.25;
    const room = this.currentRoom();
    if (room && this.rooms[room.id].phase === 'active') this.roomDamage += taken;
    if (p.resonance > 0) this.emit({ type: 'resonanceBreak', count: p.resonance });
    p.resonance = 0;
    p.resonanceTime = 0;
    const away = Math.atan2(p.y - fromY, p.x - fromX);
    p.knockX += Math.cos(away) * knockback;
    p.knockY += Math.sin(away) * knockback;
    this.emit({
      type: 'hit',
      x: p.x,
      y: p.y - p.radius,
      amount: taken,
      crit: false,
      target: 'player',
    });
    this.emit({ type: 'playerHurt', amount: taken });
    this.emit({ type: 'shake', strength: 6 });
    this.hitstop(0.06);
    if (p.health <= 0) {
      p.action = 'dead';
      p.swingTime = -1;
      p.dashTime = 0;
      this.emit({ type: 'playerDied' });
    }
  }

  spawnProjectile(projectile: Omit<Projectile, 'id' | 'hitIds'>): void {
    this.projectiles.push({ ...projectile, id: this.nextId++, hitIds: [] });
  }

  spawnEnemy(defId: string, x: number, y: number, roomId: number, asBoss = false): Enemy {
    const depth = this.run.depth;
    const scale = { health: 1 + 0.22 * depth, damage: 1 + 0.08 * depth };
    const elite = !asBoss && depth > 0 && this.rng.chance(0.06 + 0.03 * depth);
    const enemy = createEnemy(this.nextId++, enemyDef(defId, asBoss), x, y, roomId, scale, elite);
    this.enemies.push(enemy);
    this.emit({ type: 'enemySpawned', id: enemy.id, x, y });
    return enemy;
  }

  // ----- floor flow -----

  private placeInteractables(): void {
    for (const room of this.floor.rooms) {
      const c = roomCentrePx(room);
      if (room.kind === 'treasure') {
        const chest = this.addInteractable('chest', c.x, c.y, 0);
        // A mimic is a chest that fights back; the chance is visible as a risk.
        if (this.rng.chance(0.12)) chest.mimic = true;
        if (this.rng.chance(0.35))
          this.addInteractable('merchant', c.x - 72, c.y + 24, 35 + 8 * this.run.depth);
      }
      if (room.kind === 'shrine')
        this.addInteractable('shrine', c.x, c.y, 25 + 15 * this.run.depth);
      if (room.kind === 'start' && this.rng.chance(0.7))
        this.addInteractable('fountain', c.x + 72, c.y + 24, 0);
      if (room.kind === 'library') {
        this.addInteractable('archive', c.x, c.y, 0);
        this.decor.push(
          { x: c.x - 64, y: c.y - 52, prop: 'furn_shelf', size: 56 },
          { x: c.x + 64, y: c.y - 52, prop: 'furn_shelf', size: 56 },
          { x: c.x, y: c.y + 64, prop: 'furn_table', size: 54 }
        );
      }
    }
  }

  private addInteractable(
    kind: Interactable['kind'],
    x: number,
    y: number,
    cost: number,
    extra: Partial<Interactable> = {}
  ): Interactable {
    const item: Interactable = {
      id: this.nextId++,
      kind,
      x,
      y,
      used: false,
      cost,
      ...extra,
    };
    this.interactables.push(item);
    return item;
  }

  /** Places the resident and the doorway back to the hub in this one room. */
  private placeBuilding(building: SanctuaryBuilding): void {
    for (const item of building.decor) {
      const p = spotToPixels(item);
      this.decor.push({
        x: p.x,
        y: p.y,
        prop: item.prop,
        size: item.size,
        layer: item.layer,
      });
    }
    const resident = spotToPixels(INTERIOR_RESIDENT);
    this.addInteractable('npc', resident.x, resident.y, 0, {
      npcId: building.id,
      label: NPCS[building.id]?.name.replace(/^The /, ''),
    });
    const exit = spotToPixels(INTERIOR_EXIT);
    this.addInteractable('door', exit.x, exit.y, 0, {
      buildingId: building.id,
      interior: true,
    });
  }
  /** Scatters traps and barrels through combat rooms, plus levers to disarm them. */
  private placeHazards(): void {
    if (this.plan.bossOnly) return;
    for (const room of this.floor.rooms) {
      if (room.kind !== 'combat' && room.kind !== 'boss') continue;
      const count = 1 + (this.run.depth >= 4 ? 1 : 0) + this.rng.int(0, 1);
      const kinds: HazardKind[] = ['spike', 'flame', 'poison', 'rockfall', 'barrel'];
      for (let i = 0; i < count; i++) this.spawnHazard(room, this.rng.pick(kinds));
      if (this.rng.chance(0.45)) {
        const c = roomCentrePx(room);
        this.addInteractable('lever', c.x - 52, c.y + 44, 0, { roomId: room.id });
      }
    }
  }

  private spawnHazard(room: Room, kind: HazardKind): void {
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx = this.rng.int(room.x + 1, room.x + room.w - 2);
      const ty = this.rng.int(room.y + 1, room.y + room.h - 2);
      if (this.grid.isSolid(tx, ty)) continue;
      const x = (tx + 0.5) * TILE_SIZE;
      const y = (ty + 0.5) * TILE_SIZE;
      if (this.hazards.some((h) => Math.hypot(h.x - x, h.y - y) < 46)) continue;
      if (Math.hypot(x - this.player.x, y - this.player.y) < 60) continue;
      const barrel = kind === 'barrel';
      this.hazards.push({
        id: this.nextId++,
        kind,
        x,
        y,
        radius: barrel ? 16 : kind === 'poison' ? 38 : 44,
        roomId: room.id,
        phase: 'idle',
        timer: this.rng.range(0.4, 2.4),
        period: kind === 'spike' ? 2.6 : kind === 'flame' ? 3.4 : 0.8,
        damage: Math.round(8 + this.run.depth * 1.4),
        hp: barrel ? 14 : 0,
        maxHp: barrel ? 14 : 0,
        disabled: false,
      });
      return;
    }
  }

  private interact(): void {
    const target = this.nearbyInteractable();
    if (!target) return;
    const p = this.player;
    if (target.kind === 'portal') {
      target.used = true;
      this.exited = true;
      this.emit({ type: 'floorExit' });
    } else if (target.kind === 'chest') {
      target.used = true;
      if (target.mimic) {
        // Surprise: the chest was a mimic. It wakes as an elite of this section.
        const enemy = this.spawnEnemy(this.rng.pick(this.plan.roster), target.x, target.y, -1);
        enemy.state = 'chase';
        enemy.elite = true;
        this.emit({ type: 'notice', text: 'The chest was a mimic!' });
        this.emit({ type: 'shake', strength: 8 });
        return;
      }
      this.run.pendingChoices.push({
        source: 'chest',
        options: rollChoices(this.rng, p.upgrades, 3, 'generous'),
      });
      this.dropFragment(target.x + 40, target.y);
      this.dropShards(target.x, target.y, 8 + 4 * this.run.depth);
      this.dropPickup('bomb', target.x - 38, target.y + 10, 1);
      if (this.rng.chance(0.5)) this.dropPickup('trap', target.x - 46, target.y - 8, 1);
      if (this.rng.chance(0.6)) this.dropEquipment(target.x - 30, target.y);
      this.emit({ type: 'interact', kind: 'chest', x: target.x, y: target.y });
      // The guardian may already be down: the last chest still closes the goal.
      if (this.floorObjectives().complete) this.claimFloorBonus({ x: target.x, y: target.y + 24 });
    } else if (target.kind === 'lever') {
      target.used = true;
      this.disableHazards(target.roomId);
      this.emit({ type: 'notice', text: 'The old lever answers. The room falls quiet.' });
      this.emit({ type: 'interact', kind: 'lever', x: target.x, y: target.y });
    } else if (target.kind === 'fountain') {
      target.used = true;
      p.health = Math.min(p.stats.maxHealth, p.health + p.stats.maxHealth * 0.35);
      this.emit({ type: 'notice', text: 'The fountain still remembers clean water.' });
      this.emit({ type: 'interact', kind: 'fountain', x: target.x, y: target.y });
    } else if (target.kind === 'merchant') {
      if (p.shards < target.cost) {
        this.emit({ type: 'notice', text: `The merchant wants ${target.cost} shards` });
        return;
      }
      p.shards -= target.cost;
      target.used = true;
      this.dropEquipment(target.x, target.y + 16);
      this.emit({ type: 'notice', text: 'The merchant trades a relic for your shards.' });
      this.emit({ type: 'interact', kind: 'merchant', x: target.x, y: target.y });
    } else if (target.kind === 'archive') {
      target.used = true;
      const fragment = this.fragmentQueue.shift();
      if (fragment) {
        this.run.fragmentsFound.push(fragment);
        this.emit({ type: 'fragmentFound', fragmentId: fragment });
      } else {
        this.dropShards(target.x, target.y, 20 + this.run.depth * 5);
      }
      this.emit({ type: 'notice', text: 'You read a page that was not meant to survive.' });
      this.emit({ type: 'interact', kind: 'archive', x: target.x, y: target.y });
    } else if (target.kind === 'structure' || target.kind === 'npc' || target.kind === 'gate') {
      this.emit({
        type: 'sanctuary',
        kind: target.kind,
        id: target.structureId ?? target.npcId ?? '',
      });
      this.emit({ type: 'interact', kind: target.kind, x: target.x, y: target.y });
    } else if (target.kind === 'door' && target.buildingId) {
      if (!target.interior) return;
      this.emit({ type: 'buildingExit', id: target.buildingId });
      this.emit({ type: 'interact', kind: 'door', x: target.x, y: target.y });
    } else if (target.kind === 'shrine') {
      if (p.shards < target.cost) {
        this.emit({ type: 'notice', text: `The well asks for ${target.cost} shards` });
        return;
      }
      p.shards -= target.cost;
      target.used = true;
      p.health = Math.min(p.stats.maxHealth, p.health + p.stats.maxHealth * 0.5);
      p.potions = p.stats.maxPotions;
      this.run.pendingChoices.push({
        source: 'shrine',
        options: rollChoices(this.rng, p.upgrades, 3, 'generous'),
      });
      this.emit({ type: 'interact', kind: 'shrine', x: target.x, y: target.y });
    }
  }

  private updateRooms(dt: number): void {
    const room = this.currentRoom();
    if (room) this.visited[room.id] = true;
    if (room && this.rooms[room.id].phase === 'dormant' && this.isDeepInside(room))
      this.activateRoom(room);

    this.floor.rooms.forEach((r, id) => {
      const state = this.rooms[id];
      if (state.phase !== 'active') return;
      if (state.spawnDelay > 0) {
        state.spawnDelay -= dt;
        if (state.spawnDelay <= 0) this.spawnWave(r);
        return;
      }
      const alive = this.enemies.some((e) => e.roomId === id && e.state !== 'dying');
      if (alive) return;
      if (state.wavesLeft > 0) state.spawnDelay = 0.6;
      else this.clearRoom(r);
    });
  }

  /** The player is clear of the doorway ring, so closing the doors can't trap them in a wall. */
  private isDeepInside(room: Room): boolean {
    const p = this.player;
    const margin = TILE_SIZE + p.radius;
    return (
      p.x > room.x * TILE_SIZE + margin &&
      p.y > room.y * TILE_SIZE + margin &&
      p.x < (room.x + room.w) * TILE_SIZE - margin &&
      p.y < (room.y + room.h) * TILE_SIZE - margin
    );
  }

  private activateRoom(room: Room): void {
    const state = this.rooms[room.id];
    state.phase = 'active';
    this.roomDamage = 0;
    this.setRoomLocked(room, true);
    this.emit({ type: 'roomLocked', roomId: room.id });
    if (room.kind === 'boss' || room.kind === 'arena') {
      state.wavesLeft = 1;
      state.spawnDelay = 1.0;
      const boss = room.kind === 'boss' ? this.plan.boss : arenaBossFor(this.run.depth);
      this.emit({ type: 'bossIntro', name: enemyDef(boss).name });
      if (room.kind === 'arena')
        this.emit({ type: 'notice', text: 'An echo guardian holds the arena alone.' });
    } else {
      const area = room.w * room.h;
      const depth = this.run.depth;
      state.wavesLeft = depth >= 1 && area >= 150 ? 2 : 1;
      if (depth >= 3 && area >= 220) state.wavesLeft = 3;
      // Later sections keep the pressure up with an extra wave in big rooms.
      if (depth >= 6 && area >= 200) state.wavesLeft = 3;
      if (depth >= 7 && area >= 260) state.wavesLeft = 4;
      state.spawnDelay = 0.35;
    }
  }

  private spawnWave(room: Room): void {
    const state = this.rooms[room.id];
    state.wavesLeft--;
    if (room.kind === 'boss' || room.kind === 'arena') {
      const c = roomCentrePx(room);
      const boss = room.kind === 'boss' ? this.plan.boss : arenaBossFor(this.run.depth);
      const enemy = this.spawnEnemy(
        boss,
        c.x,
        c.y - TILE_SIZE * (this.plan.bossOnly ? 2.5 : 2),
        room.id,
        true
      );
      if (room.kind === 'arena' || this.plan.bossOnly) {
        // Solo bosses are considerably tougher; they deal damage through their
        // own patterns, not through a stat multiplier on every hit.
        enemy.maxHealth = Math.round(enemy.maxHealth * 1.5);
        enemy.health = enemy.maxHealth;
        if (room.kind === 'arena') enemy.elite = true;
      }
      return;
    }
    // Wave size grows with the section, so late rooms are crowded rather than
    // just longer.
    const count = 3 + Math.floor(this.run.depth * 0.85) + this.rng.int(0, 2);
    for (let i = 0; i < count; i++) {
      const spot = this.spawnPoint(room);
      if (spot) this.spawnEnemy(this.rng.pick(this.plan.roster), spot.x, spot.y, room.id);
    }
  }

  /** A random open spot in the room, kept away from the player. */
  private spawnPoint(room: Room): { x: number; y: number } | undefined {
    const p = this.player;
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx = this.rng.int(room.x + 1, room.x + room.w - 2);
      const ty = this.rng.int(room.y + 1, room.y + room.h - 2);
      const x = (tx + 0.5) * TILE_SIZE;
      const y = (ty + 0.5) * TILE_SIZE;
      if (this.grid.isSolid(tx, ty) || Math.hypot(x - p.x, y - p.y) < 140) continue;
      return { x, y };
    }
    return undefined;
  }

  private clearRoom(room: Room): void {
    const state = this.rooms[room.id];
    // Surprise: a cleared room occasionally reveals a second, elite wave.
    if (!state.ambushed && room.kind === 'combat' && this.run.depth >= 1 && this.rng.chance(0.12)) {
      state.ambushed = true;
      state.wavesLeft = 1;
      state.spawnDelay = 0.6;
      for (let i = 0; i < 3; i++) {
        const spot = this.spawnPoint(room);
        if (!spot) continue;
        const enemy = this.spawnEnemy(this.rng.pick(this.plan.roster), spot.x, spot.y, room.id);
        enemy.elite = true;
      }
      this.emit({ type: 'notice', text: 'The memory is not finished with you.' });
      this.emit({ type: 'shake', strength: 6 });
      return;
    }
    state.phase = 'cleared';
    this.setRoomLocked(room, false);
    this.run.stats.roomsCleared++;
    this.emit({ type: 'roomCleared', roomId: room.id });
    const c = roomCentrePx(room);
    // Untouched health is its own reward: finishing a room clean pays extra.
    if (this.roomDamage === 0) {
      const shards = 6 + 3 * this.run.depth;
      this.dropShards(c.x, c.y, shards);
      this.emit({ type: 'flawlessRoom', roomId: room.id, shards });
    }
    if (room.kind === 'boss') {
      if (this.plan.bossOnly) this.dropEquipment(c.x - 28, c.y);
      this.dropFragment(c.x + 40, c.y);
      this.claimFloorBonus(c);
      if (this.run.depth >= FINAL_DEPTH) this.victoryDelay = 2.5;
      else this.addInteractable('portal', c.x, c.y, 0);
      return;
    }
    if (room.kind === 'arena') {
      // Solo boss, rich payoff: two relics and a shard cache.
      this.dropEquipment(c.x - 28, c.y);
      this.dropEquipment(c.x + 28, c.y);
      this.dropShards(c.x, c.y, 40 + this.run.depth * 6);
      this.dropPickup('potion', c.x, c.y - 24, 1);
      this.emit({ type: 'notice', text: 'The echo guardian falls. The arena yields.' });
      return;
    }
    if (this.rng.chance(0.35)) this.dropPickup('health', c.x, c.y, 15);
  }

  /**
   * Pays the optional full-clear bonus when the boss falls. Leaving rooms
   * unvisited is the player's choice, but the closed loop is worth chasing.
   */
  private claimFloorBonus(c: { x: number; y: number }): void {
    const goal = this.floorObjectives();
    if (!goal.complete || this.bonusClaimed) {
      if (!this.bonusClaimed) {
        const missing = goal.roomsTotal - goal.roomsCleared;
        this.emit({
          type: 'notice',
          text:
            missing > 0
              ? `${missing} room${missing === 1 ? '' : 's'} still echo unanswered`
              : 'A chest lies unopened',
        });
      }
      return;
    }
    this.bonusClaimed = true;
    this.run.stats.floorsRestored++;
    const shards = 40 + 10 * this.run.depth;
    this.dropShards(c.x, c.y, shards);
    this.dropPickup('potion', c.x - 30, c.y, 1);
    this.emit({ type: 'objectiveComplete', shards });
  }

  private setRoomLocked(room: Room, locked: boolean): void {
    for (const door of room.doors)
      for (const t of door.tiles) this.grid.setDoorLocked(t.x, t.y, locked);
  }

  private onEnemyKilled(enemy: Enemy): void {
    killEnemy(enemy);
    const run = this.run;
    run.stats.kills++;
    this.emit({ type: 'enemyDied', id: enemy.id, x: enemy.x, y: enemy.y, boss: enemy.isBoss });
    this.emit({ type: 'shake', strength: enemy.isBoss ? 14 : 3 });
    if (enemy.isBoss) {
      this.hitstop(0.25);
      // The boss's summons crumble with it.
      for (const e of this.enemies)
        if (e !== enemy && e.roomId === enemy.roomId && e.state !== 'dying') killEnemy(e);
    }
    const p = this.player;
    p.mana = Math.min(p.stats.maxMana, p.mana + p.stats.manaOnKill);
    // A kill inside the flow window builds a streak that raises rewards;
    // taking a hit drops it, so keeping it alive is a risk the player owns.
    p.resonance = p.resonanceTime > 0 ? Math.min(RESONANCE_MAX, p.resonance + 1) : 1;
    p.resonanceTime = RESONANCE_WINDOW;
    run.stats.bestResonance = Math.max(run.stats.bestResonance, p.resonance);
    if (enemy.isBoss) run.stats.bossKills++;
    // Surprise: some memories destabilise when broken and leave a short-fused
    // blast behind. The delay gives the player a chance to step out.
    if (!enemy.isBoss && this.rng.chance(0.07)) {
      this.spawnBlast(enemy.x, enemy.y, 72, 0.42, 18 + this.run.depth * 2);
      this.emit({ type: 'notice', text: 'The memory destabilises!' });
    }
    const flow = resonanceMultiplier(p.resonance);
    this.emit({ type: 'resonance', count: p.resonance, multiplier: flow });

    const xp = Math.round(enemy.def.xp * (1 + 0.1 * run.depth) * (enemy.elite ? 2 : 1) * flow);
    const levels = grantXp(run, xp, () => rollChoices(this.rng, p.upgrades));
    if (levels > 0) this.emit({ type: 'levelUp', level: p.level });

    const base = enemy.isBoss ? 30 : this.rng.int(1, 3) + (enemy.elite ? 5 : 0);
    const surge = this.rollSurge();
    const shards = Math.round(base * flow * surge.factor);
    this.dropShards(enemy.x, enemy.y, shards);
    if (surge.kind) {
      run.stats.surges++;
      // Only a jackpot is worth a potion; a rich vein is just extra shards.
      if (surge.kind === 'jackpot') this.dropPickup('potion', enemy.x, enemy.y - 20, 1);
      this.emit({
        type: 'lootSurge',
        x: enemy.x,
        y: enemy.y,
        kind: surge.kind,
        amount: shards,
      });
    }
    if (!enemy.isBoss && this.rng.chance(0.07)) this.dropPickup('health', enemy.x, enemy.y, 12);
    if (!enemy.isBoss && this.rng.chance(0.025)) this.dropPickup('potion', enemy.x, enemy.y, 1);
    // Bosses always leave a relic; elites sometimes do.
    if (enemy.isBoss || (enemy.elite && this.rng.chance(0.4))) this.dropEquipment(enemy.x, enemy.y);
  }

  /** Equips a carried relic, swapping out whatever was in its slot. */
  equipItem(uid: number): boolean {
    const p = this.player;
    const index = p.inventory.findIndex((item) => item.uid === uid);
    if (index < 0) return false;
    const item = p.inventory[index];
    const def = equipmentDef(item.defId);
    const previous = p.equipment[def.slot];
    p.inventory.splice(index, 1);
    p.equipment[def.slot] = item;
    if (previous) p.inventory.push(previous);
    refreshStats(p);
    return true;
  }

  unequip(slot: 'weapon' | 'armor' | 'trinket'): boolean {
    const p = this.player;
    const item = p.equipment[slot];
    if (!item) return false;
    p.equipment[slot] = null;
    p.inventory.push(item);
    refreshStats(p);
    return true;
  }

  discardItem(uid: number): boolean {
    const p = this.player;
    const index = p.inventory.findIndex((item) => item.uid === uid);
    if (index < 0) return false;
    p.inventory.splice(index, 1);
    return true;
  }

  private dropEquipment(x: number, y: number): void {
    const p = this.player;
    const def = rollEquipment(this.rng, this.run.depth);
    const item: EquipmentItem = { uid: p.nextEquipmentId++, defId: def.id };
    this.pickups.push({
      id: this.nextId++,
      kind: 'equipment',
      x,
      y,
      amount: 1,
      equipment: item,
      age: 0,
      vx: this.rng.range(-40, 40),
      vy: this.rng.range(-40, 40),
    });
  }

  /** One variable-ratio roll: mostly normal, sometimes rich, rarely a jackpot. */
  private rollSurge(): { kind?: 'rich' | 'jackpot'; factor: number } {
    const roll = this.rng.next();
    if (roll < SURGE_JACKPOT) return { kind: 'jackpot', factor: 5 };
    if (roll < SURGE_RICH) return { kind: 'rich', factor: 2.5 };
    return { factor: 1 };
  }

  private dropShards(x: number, y: number, total: number): void {
    // Several small shards scatter and then home in, which reads better than one big drop.
    const pieces = Math.min(total, 8);
    for (let i = 0; i < pieces; i++) {
      const share = Math.floor(total / pieces) + (i < total % pieces ? 1 : 0);
      this.dropPickup('shard', x, y, share);
    }
  }

  private dropPickup(
    kind: Pickup['kind'],
    x: number,
    y: number,
    amount: number,
    fragmentId?: string
  ): void {
    const angle = this.rng.range(0, Math.PI * 2);
    const speed = kind === 'fragment' ? 0 : this.rng.range(60, 170);
    this.pickups.push({
      id: this.nextId++,
      kind,
      x,
      y,
      amount,
      fragmentId,
      age: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }

  private dropFragment(x: number, y: number): void {
    const id = this.fragmentQueue.shift();
    if (id) this.dropPickup('fragment', x, y, 1, id);
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!updateEnemy(this, this.enemies[i], dt)) this.enemies.splice(i, 1);
    }
  }

  private updateProjectiles(dt: number): void {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let dead = b.life <= 0 || this.grid.isSolidAtPixel(b.x, b.y);
      if (!dead && b.owner === 'enemy') {
        const touch = circlesTouch(b.x, b.y, b.radius, p.x, p.y, p.radius - 2);
        if (p.action !== 'dead' && touch) {
          if (p.invulnerable <= 0) {
            this.damagePlayer(b.damage, b.x - b.vx, b.y - b.vy, 180);
            dead = true;
          } else if (p.dashTime > 0 && !b.grazed) {
            b.grazed = true;
            this.graze(b.x, b.y);
          }
        } else if (
          p.action !== 'dead' &&
          p.dashTime > 0 &&
          !b.grazed &&
          circlesTouch(b.x, b.y, b.radius, p.x, p.y, p.radius + GRAZE_SHOT)
        ) {
          // Dashing through the edge of a shot pays off instead of only avoiding it.
          b.grazed = true;
          this.graze(b.x, b.y);
        }
      } else if (!dead) {
        // Player shots can detonate a bomb early — including your own.
        for (const bomb of this.bombs) {
          if (circlesTouch(b.x, b.y, b.radius, bomb.x, bomb.y, 14)) {
            bomb.fuse = Math.min(bomb.fuse, 0.03);
            dead = true;
            break;
          }
        }
        if (dead) {
          this.projectiles.splice(i, 1);
          continue;
        }
        for (const e of this.enemies) {
          if (e.state === 'spawning' || e.state === 'dying' || b.hitIds.includes(e.id)) continue;
          if (!circlesTouch(b.x, b.y, b.radius, e.x, e.y, e.radius)) continue;
          b.hitIds.push(e.id);
          const crit = this.rng.chance(p.stats.critChance);
          const amount = Math.round(b.damage * (crit ? p.stats.critMultiplier : 1));
          this.damageEnemy(e, amount, 'bolt', crit, 90);
          if (b.pierce-- <= 0) {
            dead = true;
            break;
          }
        }
      }
      if (dead) this.projectiles.splice(i, 1);
    }
  }

  private separateBodies(): void {
    const p = this.player;
    const living = this.enemies.filter((e) => e.state !== 'dying' && e.state !== 'spawning');
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) separate(this.grid, living[i], living[j]);
      // The player phases through enemies while dashing.
      if (p.dashTime <= 0 && p.action !== 'dead')
        separate(this.grid, p, living[i], living[i].isBoss ? 0.9 : 0.35);
    }
  }

  /** Passive dangers: periodic traps, proximity rockfall and poison pools. */
  private updateHazards(dt: number): void {
    const p = this.player;
    for (const h of [...this.hazards]) {
      if (h.disabled || h.kind === 'barrel') continue;
      if (h.kind === 'trap') {
        h.timer -= dt;
        if (h.timer > 0) continue;
        const armed = this.enemies.some(
          (e) => e.state !== 'dying' && Math.hypot(e.x - h.x, e.y - h.y) <= h.radius + e.radius
        );
        const playerInside = Math.hypot(p.x - h.x, p.y - h.y) <= h.radius + p.radius;
        if (!playerInside) h.safePlayer = false;
        if (!armed && !(playerInside && !h.safePlayer)) continue;
        this.hazardBurst(h, true);
        const index = this.hazards.indexOf(h);
        if (index >= 0) this.hazards.splice(index, 1);
        continue;
      }
      h.timer -= dt;
      if (h.timer > 0) continue;
      if (h.kind === 'poison') {
        h.timer = h.period;
        this.hazardBurst(h, true);
        continue;
      }
      if (h.kind === 'rockfall' && h.phase === 'idle') {
        if (Math.hypot(p.x - h.x, p.y - h.y) > 150) {
          h.timer = 0.5;
          continue;
        }
      }
      if (h.phase === 'idle') {
        h.phase = 'warning';
        h.timer = h.kind === 'rockfall' ? 0.7 : 0.55;
      } else if (h.phase === 'warning') {
        h.phase = 'active';
        h.timer = 0.4;
        this.hazardBurst(h, true);
      } else {
        h.phase = 'idle';
        h.timer = h.period;
      }
    }
  }

  /** Applies a hazard's damage (optionally) and emits its burst for the view. */
  private hazardBurst(h: Hazard, damage: boolean): void {
    this.emit({ type: 'hazardBurst', kind: h.kind, x: h.x, y: h.y, radius: h.radius });
    if (!damage) return;
    const p = this.player;
    if (Math.hypot(p.x - h.x, p.y - h.y) <= h.radius + p.radius)
      this.damagePlayer(h.damage, h.x, h.y, 140);
    for (const e of this.enemies)
      if (e.state !== 'dying' && Math.hypot(e.x - h.x, e.y - h.y) <= h.radius + e.radius)
        this.damageEnemy(e, h.damage, 'hazard', false, 60);
  }

  spawnBlast(x: number, y: number, radius: number, delay: number, damage: number): void {
    this.blasts.push({ id: this.nextId++, x, y, radius, delay, damage });
  }

  spawnMine(x: number, y: number, damage: number): void {
    this.mines.push({ id: this.nextId++, x, y, damage, arm: 0.8, life: 8 });
  }

  spawnBomb(
    x: number,
    y: number,
    vx: number,
    vy: number,
    owner: 'player' | 'enemy',
    damage: number,
    fuse: number
  ): void {
    this.bombs.push({
      id: this.nextId++,
      x,
      y,
      vx,
      vy,
      fuse,
      radius: owner === 'player' ? 74 : 62,
      damage,
      owner,
    });
    this.emit({ type: 'bombThrown', x, y, owner });
  }

  placePlayerTrap(x: number, y: number): void {
    const room = this.currentRoom();
    this.hazards.push({
      id: this.nextId++,
      kind: 'trap',
      x,
      y,
      radius: 44,
      roomId: room?.id ?? -1,
      phase: 'idle',
      timer: 0.65,
      period: 0,
      damage: 48,
      hp: 0,
      maxHp: 0,
      disabled: false,
      safePlayer: true,
    });
  }

  /** Bombs bounce off walls, chain with each other, and hurt both sides. */
  private updateBombs(dt: number): void {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.fuse -= dt;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;
      if (this.grid.isSolidAtPixel(nx, b.y)) b.vx *= -0.55;
      else b.x = nx;
      if (this.grid.isSolidAtPixel(b.x, ny)) b.vy *= -0.55;
      else b.y = ny;
      const drag = Math.exp(-1.9 * dt);
      b.vx *= drag;
      b.vy *= drag;
      if (b.fuse > 0) continue;
      this.bombs.splice(i, 1);
      this.explodeBomb(b);
    }
  }

  private explodeBomb(b: Bomb): void {
    const p = this.player;
    this.emit({ type: 'bombExploded', x: b.x, y: b.y, radius: b.radius });
    this.emit({ type: 'shake', strength: 8 });
    if (Math.hypot(p.x - b.x, p.y - b.y) <= b.radius + p.radius)
      this.damagePlayer(Math.round(b.damage * (b.owner === 'player' ? 0.65 : 1)), b.x, b.y, 260);
    for (const e of this.enemies)
      if (e.state !== 'dying' && Math.hypot(e.x - b.x, e.y - b.y) <= b.radius + e.radius)
        this.damageEnemy(
          e,
          Math.round(b.damage * (b.owner === 'player' ? 1 : 0.7)),
          'hazard',
          false,
          240
        );
    // Chain reaction: nearby bombs light off almost immediately.
    for (const other of this.bombs)
      if (Math.hypot(other.x - b.x, other.y - b.y) <= b.radius * 1.2)
        other.fuse = Math.min(other.fuse, 0.06);
  }

  /** Player attacks break barrels; traps are not destructible. */
  hitHazards(x: number, y: number, radius: number, damage: number): number {
    let hits = 0;
    for (const h of [...this.hazards]) {
      if (h.kind !== 'barrel' || h.disabled) continue;
      if (Math.hypot(h.x - x, h.y - y) > radius + h.radius) continue;
      this.damageHazard(h, damage);
      hits++;
    }
    return hits;
  }

  private damageHazard(h: Hazard, amount: number): void {
    if (h.kind !== 'barrel' || h.disabled) return;
    h.hp -= amount;
    if (h.hp > 0) return;
    const index = this.hazards.indexOf(h);
    if (index >= 0) this.hazards.splice(index, 1);
    this.emit({ type: 'hazardBurst', kind: 'barrel', x: h.x, y: h.y, radius: 96 });
    this.emit({ type: 'shake', strength: 7 });
    for (const e of this.enemies)
      if (e.state !== 'dying' && Math.hypot(e.x - h.x, e.y - h.y) <= 96 + e.radius)
        this.damageEnemy(e, 50, 'hazard', false, 220);
    const p = this.player;
    if (Math.hypot(p.x - h.x, p.y - h.y) <= 96 + p.radius) this.damagePlayer(20, h.x, h.y, 260);
    this.dropShards(h.x, h.y, 4 + this.run.depth);
    if (this.rng.chance(0.4)) this.dropPickup('bomb', h.x + 18, h.y, 1);
    if (this.rng.chance(0.35)) this.dropPickup('trap', h.x - 18, h.y, 1);
  }
  private updateBlasts(dt: number): void {
    const p = this.player;
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.delay -= dt;
      if (b.delay > 0) continue;
      this.blasts.splice(i, 1);
      this.emit({ type: 'blast', x: b.x, y: b.y, radius: b.radius });
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.radius + p.radius)
        this.damagePlayer(b.damage, b.x, b.y, 200);
      for (const e of this.enemies)
        if (e.state !== 'dying' && Math.hypot(e.x - b.x, e.y - b.y) <= b.radius + e.radius)
          this.damageEnemy(e, Math.round(b.damage * 0.6), 'hazard', false, 80);
    }
  }

  private updateMines(dt: number): void {
    const p = this.player;
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.arm -= dt;
      m.life -= dt;
      const close = m.arm <= 0 && Math.hypot(p.x - m.x, p.y - m.y) < 58;
      if (!close && m.life > 0) continue;
      this.mines.splice(i, 1);
      this.emit({ type: 'blast', x: m.x, y: m.y, radius: 62 });
      if (Math.hypot(p.x - m.x, p.y - m.y) <= 62 + p.radius)
        this.damagePlayer(m.damage, m.x, m.y, 180);
      for (const e of this.enemies)
        if (e.state !== 'dying' && Math.hypot(e.x - m.x, e.y - m.y) <= 62 + e.radius)
          this.damageEnemy(e, Math.round(m.damage * 0.5), 'hazard', false, 60);
    }
  }

  /** A lever disables every trap in its room. */
  disableHazards(roomId?: number): void {
    for (const h of this.hazards)
      if (roomId === undefined || h.roomId === roomId) h.disabled = true;
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const item = this.pickups[i];
      item.age += dt;
      const dist = Math.hypot(p.x - item.x, p.y - item.y);
      const homing =
        item.age > 0.35 &&
        p.action !== 'dead' &&
        (item.kind === 'shard' ? dist < p.stats.pickupRadius * 2.2 : dist < p.stats.pickupRadius);
      if (homing && item.kind !== 'fragment') {
        const pull = 520;
        item.vx = ((p.x - item.x) / (dist || 1)) * pull;
        item.vy = ((p.y - item.y) / (dist || 1)) * pull;
      } else {
        const decay = Math.exp(-5 * dt);
        item.vx *= decay;
        item.vy *= decay;
      }
      const body = { x: item.x, y: item.y, radius: 4 };
      moveAndCollide(this.grid, body, item.vx * dt, item.vy * dt);
      item.x = body.x;
      item.y = body.y;
      if (item.age > 0.2 && dist < p.radius + 10 && p.action !== 'dead' && this.collect(item))
        this.pickups.splice(i, 1);
    }
  }

  /** Applies a pickup; returns false to leave it on the floor (e.g. full health). */
  private collect(item: Pickup): boolean {
    const p = this.player;
    switch (item.kind) {
      case 'shard':
        p.shards += item.amount;
        break;
      case 'health':
        if (p.health >= p.stats.maxHealth) {
          // Never leave a full-health heart orbiting the player: convert it
          // into a few shards instead.
          p.shards += Math.max(1, Math.round(item.amount));
          break;
        }
        p.health = Math.min(p.stats.maxHealth, p.health + item.amount);
        break;
      case 'potion':
        if (p.potions >= p.stats.maxPotions) {
          p.shards += 2;
          break;
        }
        p.potions++;
        break;
      case 'bomb':
        p.bombs += item.amount;
        break;
      case 'trap':
        p.traps += item.amount;
        break;
      case 'fragment':
        if (item.fragmentId) {
          this.run.fragmentsFound.push(item.fragmentId);
          this.emit({ type: 'fragmentFound', fragmentId: item.fragmentId });
        }
        break;
      case 'equipment': {
        const relic = item.equipment;
        if (!relic) return false;
        const def = equipmentDef(relic.defId);
        const slot = def.slot;
        p.inventory.push(relic);
        let auto = false;
        if (!p.equipment[slot]) {
          p.equipment[slot] = relic;
          p.inventory.splice(p.inventory.indexOf(relic), 1);
          refreshStats(p);
          auto = true;
        }
        this.emit({
          type: 'equipment',
          name: def.name,
          rarity: def.rarity,
          slot,
          auto,
        });
        break;
      }
    }
    this.emit({ type: 'pickup', kind: item.kind, x: item.x, y: item.y, amount: item.amount });
    return true;
  }
}
