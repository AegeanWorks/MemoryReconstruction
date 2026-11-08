/**
 * One dungeon floor in play. `step` advances the simulation by a fixed time
 * step and returns the events that happened; nothing here touches the DOM or
 * the renderer, so tests and bots can drive a World headlessly.
 */
import { circlesTouch, inArc, type Arena, type DamageSource } from './combat';
import {
  arenaBossFor,
  ENEMY_COUNT_SCALE,
  ENEMY_DAMAGE_DEPTH_SCALE,
  ENEMY_XP_SCALE,
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
import {
  createEnemy,
  killEnemy,
  MINE_RADIUS,
  staggerEnemy,
  updateBossPhase,
  updateEnemy,
} from './enemies';
import {
  equipmentDef,
  INVENTORY_SLOTS,
  relicSellShards,
  rollEquipment,
  type EquipmentItem,
} from './equipment';
import { FERRYMAN_LINES, NPCS, WAYFARER_LINES } from './quests';
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
  activeModifier,
  applyChoice,
  grantXp,
  resonanceMultiplier,
  RESONANCE_MAX,
  RESONANCE_WINDOW,
  type RunState,
} from './run';
import { Tile, TILE_SIZE } from './tiles';
import { ENGAGEMENT_TUNING, enemyWaveCap } from './tuning';
import { rollChoices } from './upgrades';

export type RoomPhase = 'dormant' | 'active' | 'cleared';

export interface RoomState {
  phase: RoomPhase;
  wavesLeft: number;
  /** Total waves planned for this room encounter. */
  totalWaves?: number;
  /** When true, wave announcements omit the remaining wave count for suspense. */
  hideWaveCount?: boolean;
  /** Seconds until the next wave (or the boss) appears while active. */
  spawnDelay: number;
  /** A room that has already sprung its surprise ambush. */
  ambushed?: boolean;
  /** A room that has already spawned its memory-storm surprise. */
  stormed?: boolean;
}

const INTERACT_RADIUS = 44;
/** Seconds between flow-field refreshes; the player moves under two tiles in that time. */
const FLOW_REFRESH = 0.2;
const HURT_IFRAMES = 0.75;
/** Shards refunded per graze, and dash charge restored (tunable, see tuning.ts). */
const GRAZE_MANA = ENGAGEMENT_TUNING.grazeMana;
const GRAZE_DASH = ENGAGEMENT_TUNING.grazeDash;
/** Near-miss margin for enemy projectiles (tunable). */
const GRAZE_SHOT = ENGAGEMENT_TUNING.grazeShot;
/** Variable-ratio shard rolls: jackpot below this, rich below the second (tunable). */
const SURGE_JACKPOT = ENGAGEMENT_TUNING.surgeJackpot;
const SURGE_RICH = ENGAGEMENT_TUNING.surgeRich;

const isBreakable = (kind: HazardKind): boolean =>
  kind === 'barrel' || kind === 'crate' || kind === 'crystal' || kind === 'urn';

/** Progress of the optional full-clear objective on this floor. */
export interface FloorObjectives {
  roomsCleared: number;
  roomsTotal: number;
  chestFound: boolean;
  chestUsed: boolean;
  wellFound: boolean;
  wellUsed: boolean;
  archiveFound?: boolean;
  archiveUsed?: boolean;
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
  /** True while a stalker is armed and hunting the next room (HUD radar). */
  get isStalked(): boolean {
    return this.stalkerArmed;
  }
  /**
   * Hunter pressure (cyberpulse ADR-016, grid-lite): every third cleared
   * hostile room arms a stalker that joins the next fight as an elite.
   * Resets per floor so each section escalates on its own.
   */
  private stalkerClock = 0;
  private stalkerArmed = false;

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
      phase:
        r.kind === 'combat' || r.kind === 'boss' || r.kind === 'arena' || r.kind === 'colosseum'
          ? 'dormant'
          : 'cleared',
      wavesLeft: 0,
      spawnDelay: 0,
    }));
    this.stalkerClock = 0;
    this.stalkerArmed = false;
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

  /** Interior rectangle of the room containing a pixel point, if any. */
  roomBoundsAt(x: number, y: number): { x: number; y: number; w: number; h: number } | undefined {
    const room = roomAt(this.floor, x, y);
    return room
      ? {
          x: room.x * TILE_SIZE,
          y: room.y * TILE_SIZE,
          w: room.w * TILE_SIZE,
          h: room.h * TILE_SIZE,
        }
      : undefined;
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

    // Behavioral Psychology (Clark et al., 2009): Near-Miss Clutch Surge
    // In critical peril, grazing triggers an adrenaline clutch comeback.
    const isCritical = p.health <= p.stats.maxHealth * ENGAGEMENT_TUNING.clutchThreshold;
    if (isCritical && !p.clutchUsed) {
      p.clutchUsed = true;
      p.dashCharges = Math.min(p.stats.dashCharges, p.dashCharges + 1.0);
      p.resonanceTime = RESONANCE_WINDOW;
      this.hitstop(0.06);
      this.emit({ type: 'clutchGraze', x, y });
    }
  }

  /** Optional full-clear objective, surfaced by the HUD and the map. */
  floorObjectives(): FloorObjectives {
    const rooms = this.floor.rooms.filter(
      (r) =>
        r.kind === 'combat' || r.kind === 'boss' || r.kind === 'arena' || r.kind === 'colosseum'
    );
    const cleared = rooms.filter((r) => this.rooms[r.id].phase === 'cleared').length;
    const chest = this.interactables.filter((i) => i.kind === 'chest');
    const well = this.interactables.filter((i) => i.kind === 'shrine');
    const archive = this.interactables.filter((i) => i.kind === 'archive');
    const chestUsed = chest.length > 0 && chest.every((i) => i.used);
    const wellUsed = well.length > 0 && well.every((i) => i.used);
    const archiveUsed = archive.length > 0 && archive.every((i) => i.used);
    return {
      roomsCleared: cleared,
      roomsTotal: rooms.length,
      chestFound: chest.length > 0,
      chestUsed,
      wellFound: well.length > 0,
      wellUsed,
      archiveFound: archive.length > 0,
      archiveUsed,
      complete: cleared === rooms.length && (!chest.length || chestUsed),
      claimed: this.bonusClaimed,
    };
  }

  /** Shards a choice reroll costs on this floor (tunable). */
  rerollCost(): number {
    return ENGAGEMENT_TUNING.rerollBase + ENGAGEMENT_TUNING.rerollPerDepth * this.run.depth;
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
    // Difficulty sets the walker's edge: story strikes 25% harder, nightmare
    // strikes 10% softer. The Keen Edge twist (daily or omen) sharpens every strike.
    if (activeModifier(this.run) === 'keen_edge') amount = Math.round(amount * 1.15);
    if (this.run.difficulty === 'story') amount = Math.round(amount * 1.25);
    else if (this.run.difficulty === 'nightmare') amount = Math.round(amount * 0.9);
    // Finisher: a melee hit on a wounded enemy (below 30% health) deals +50%
    // damage and restores a sliver of mana, rewarding aggressive cleanup.
    if (source === 'melee' && enemy.health > 0 && enemy.health <= enemy.maxHealth * 0.3) {
      amount = Math.round(amount * 1.5);
      const p = this.player;
      p.mana = Math.min(p.stats.maxMana, p.mana + 4);
    }
    // Critical hit reward: a crit restores mana, lengthens the flow window, and delivers a tactile hitstop.
    if (crit) {
      const p = this.player;
      p.mana = Math.min(p.stats.maxMana, p.mana + 3);
      p.resonanceTime = Math.min(RESONANCE_WINDOW * 2, p.resonanceTime + 0.5);
      this.hitstop(0.05);
    }
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
      if (p.health > p.stats.maxHealth * ENGAGEMENT_TUNING.clutchThreshold) p.clutchUsed = false;
    }
    if (enemy.health <= 0) {
      this.onEnemyKilled(enemy);
      // Overkill carryover: half the excess damage spills to the nearest living
      // enemy within range, so a killing blow is rarely wasted.
      if (source === 'melee') {
        const excess = amount - dealt;
        if (excess > 0) {
          const spill = Math.round(excess * 0.5);
          if (spill > 0) {
            let nearest: Enemy | undefined;
            let best = 120;
            for (const other of this.enemies) {
              if (other === enemy || other.state === 'dying' || other.state === 'spawning')
                continue;
              const d = Math.hypot(other.x - enemy.x, other.y - enemy.y);
              if (d < best) {
                best = d;
                nearest = other;
              }
            }
            if (nearest) this.damageEnemy(nearest, spill, 'shockwave', false, 0);
          }
        }
      }
    } else {
      staggerEnemy(enemy);
      // A single big hit can cross both phase thresholds; announce each one
      // so audio and shake never lag the aura the view already shows.
      for (const phase of updateBossPhase(enemy)) {
        this.emit({ type: 'bossPhase', phase });
        this.emit({ type: 'shake', strength: 8 });
      }
    }
    return dealt;
  }

  damagePlayer(
    amount: number,
    fromX: number,
    fromY: number,
    knockback: number,
    grazeable = false
  ): void {
    const p = this.player;
    if (p.invulnerable > 0 || p.action === 'dead') {
      // A dash that carries the walker through a real attack pays the near
      // miss; i-frames left over after the dash do not.
      if (grazeable && p.dashTime > 0) this.graze(fromX, fromY);
      return;
    }
    // Difficulty sets how much of a blow lands: story softens the world,
    // nightmare sharpens it. The walker hits back with the inverse.
    // The Heavy Air twist (daily or omen) sharpens every blow a little further.
    if (activeModifier(this.run) === 'heavy_air') amount = Math.round(amount * 1.15);
    const incoming =
      this.run.difficulty === 'story' ? 0.7 : this.run.difficulty === 'nightmare' ? 1.35 : 1;
    const taken = Math.max(1, Math.round(amount * incoming * (1 - p.stats.damageReduction)));
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
    // Heavy blows stagger: the swing is interrupted and the walker stumbles.
    // Anything over ~12% of max health, or a hard shove, earns a stagger.
    const heavy = taken >= p.stats.maxHealth * 0.12 || knockback >= 260;
    if (heavy && p.health > 0) {
      p.stagger = Math.max(p.stagger, 0.45);
      p.swingTime = -1;
      p.comboWindow = 0;
      if (p.action === 'attack') p.action = 'idle';
      this.emit({ type: 'notice', text: 'Staggered!' });
      this.hitstop(0.12);
    } else {
      this.hitstop(0.06);
    }
    // Second wind (cyberpulse ADR-033 dead man's switch): a soul anchor
    // shatters instead of the walker, once per anchor, and refuses death.
    if (p.health <= 0 && p.equipment.trinket?.defId === 'soul_anchor') {
      p.equipment.trinket = null;
      refreshStats(p);
      p.health = Math.round(p.stats.maxHealth * 0.4);
      p.invulnerable = Math.max(p.invulnerable, 2);
      p.stagger = 0;
      this.emit({ type: 'soulAnchor', x: p.x, y: p.y });
      this.emit({ type: 'notice', text: 'The soul anchor shatters — death refused.' });
      this.emit({ type: 'shake', strength: 12 });
      this.hitstop(0.2);
      return;
    }
    if (p.health <= 0) {
      p.action = 'dead';
      p.swingTime = -1;
      p.dashTime = 0;
      // Death recap for the legacy screen: where the run fell.
      const room = this.currentRoom();
      if (room) this.run.deathRoom = room.kind;
      this.run.deathSection = this.run.depth + 1;
      this.emit({ type: 'playerDied' });
    }
  }

  spawnProjectile(projectile: Omit<Projectile, 'id' | 'hitIds'>): void {
    this.projectiles.push({ ...projectile, id: this.nextId++, hitIds: [] });
  }

  spawnEnemy(defId: string, x: number, y: number, roomId: number, asBoss = false): Enemy {
    const depth = this.run.depth;
    const nightmare = this.run.difficulty === 'nightmare';
    const story = this.run.difficulty === 'story';
    // Incoming damage is scaled once in damagePlayer; here difficulty only
    // thickens enemy hides (and breeds more elites below).
    const scale = {
      health: (1 + 0.22 * depth) * (nightmare ? 1.25 : story ? 0.85 : 1),
      damage: 1 + ENEMY_DAMAGE_DEPTH_SCALE * depth,
    };
    const elite =
      !asBoss && depth > 0 && this.rng.chance(0.06 + 0.03 * depth + (nightmare ? 0.08 : 0));
    const enemy = createEnemy(this.nextId++, enemyDef(defId, asBoss), x, y, roomId, scale, elite);
    // The mirror fights with your numbers: it has watched you grow. The cap
    // keeps a three-swing combo from deleting a fresh checkpoint player.
    if (defId === 'mirror_self')
      enemy.def.damage = Math.round(enemy.def.damage * Math.min(1.4, 1 + this.player.level * 0.03));
    this.enemies.push(enemy);
    this.emit({ type: 'enemySpawned', id: enemy.id, x, y });
    return enemy;
  }

  // ----- floor flow -----

  /**
   * Clamps a desired pixel to a walkable tile inside the room. Fixed offsets
   * (cache, merchant, library furniture) can otherwise land in walls or
   * outside small/non-rect rooms; this spirals out to the nearest open floor.
   */
  private clampToRoomInterior(room: Room, x: number, y: number): { x: number; y: number } {
    const loX = room.x + 1;
    const hiX = room.x + room.w - 2;
    const loY = room.y + 1;
    const hiY = room.y + room.h - 2;
    let tx = Math.max(loX, Math.min(hiX, Math.floor(x / TILE_SIZE)));
    let ty = Math.max(loY, Math.min(hiY, Math.floor(y / TILE_SIZE)));
    if (!this.grid.isSolid(tx, ty)) return { x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE };
    for (let r = 1; r <= 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const cx = tx + dx;
          const cy = ty + dy;
          if (cx < loX || cx > hiX || cy < loY || cy > hiY) continue;
          if (!this.grid.isSolid(cx, cy))
            return { x: (cx + 0.5) * TILE_SIZE, y: (cy + 0.5) * TILE_SIZE };
        }
      }
    }
    const c = roomCentrePx(room);
    return { x: c.x, y: c.y };
  }

  private placeInteractables(): void {
    for (const room of this.floor.rooms) {
      const c = roomCentrePx(room);
      if (room.kind === 'treasure') {
        const chest = this.addInteractable('chest', c.x, c.y, 0);
        // A mimic is a chest that fights back; the chance is visible as a risk.
        if (this.rng.chance(0.12)) chest.mimic = true;
        // Every vault keeps a sealed cache beside its chest: double loot for
        // whoever dares break it, so the gamble is always on the table.
        const cache = this.clampToRoomInterior(room, c.x + 76, c.y - 20);
        this.addInteractable('cache', cache.x, cache.y, 0, { roomId: room.id });
        if (this.rng.chance(0.35)) {
          const merchant = this.clampToRoomInterior(room, c.x - 72, c.y + 24);
          this.addInteractable('merchant', merchant.x, merchant.y, 35 + 8 * this.run.depth);
        }
      }
      if (room.kind === 'shrine')
        this.addInteractable('shrine', c.x, c.y, 25 + 15 * this.run.depth);
      if (room.kind === 'start') this.addInteractable('fountain', c.x, c.y, 0);
      if (room.kind === 'library') {
        this.addInteractable('archive', c.x, c.y, 0);
        const shelfL = this.clampToRoomInterior(room, c.x - 64, c.y - 52);
        const shelfR = this.clampToRoomInterior(room, c.x + 64, c.y - 52);
        const table = this.clampToRoomInterior(room, c.x, c.y + 64);
        this.decor.push(
          { x: shelfL.x, y: shelfL.y, prop: 'furn_shelf', size: 56 },
          { x: shelfR.x, y: shelfR.y, prop: 'furn_shelf', size: 56 },
          { x: table.x, y: table.y, prop: 'furn_table', size: 54 }
        );
      }
    }
    const start = this.floor.rooms[this.floor.startRoom];
    const startCentre = roomCentrePx(start);
    const waystone = this.clampToRoomInterior(start, startCentre.x - 64, startCentre.y + 48);
    this.addInteractable('waystone', waystone.x, waystone.y, 0, { label: 'Waystone' });
    const wayfarer = this.clampToRoomInterior(start, startCentre.x + 64, startCentre.y - 48);
    this.addInteractable('wayfarer', wayfarer.x, wayfarer.y, 0, { label: 'Wayfarer' });
    const ferryRoom =
      this.floor.rooms.find((r) => r.kind === 'shrine') ??
      this.floor.rooms.find((r) => r.kind === 'treasure');
    if (ferryRoom) {
      const ferryCentre = roomCentrePx(ferryRoom);
      const ferryman = this.clampToRoomInterior(ferryRoom, ferryCentre.x + 64, ferryCentre.y + 24);
      this.addInteractable('ferryman', ferryman.x, ferryman.y, 40 + 12 * this.run.depth, {
        label: 'Ferryman',
      });
    }
    const vault = this.floor.rooms.find((r) => r.kind === 'vault');
    if (vault) {
      // The lever lives in a room the walker has to reach, not at the entrance.
      const host =
        this.floor.rooms.find(
          (r) => r.id !== vault.id && r.kind !== 'vault' && r.kind !== 'boss' && r.distance >= 1
        ) ?? start;
      const hostCentre = roomCentrePx(host);
      const lever = this.findWallLeverSpot(host) ?? {
        x: hostCentre.x,
        y: hostCentre.y + TILE_SIZE * 2,
      };
      this.addInteractable('lever', lever.x, lever.y, 0, {
        roomId: vault.id,
        label: 'Sealed vault',
      });
    }
  }

  /** Shared chest loot: caches pay it double when their seal is broken. */
  private giveChestLoot(target: Interactable, mult: number): void {
    const surge = this.rollSurge();
    const baseShards = (8 + 4 * this.run.depth) * mult;
    const shards = Math.round(baseShards * surge.factor);
    this.dropFragment(target.x + 40, target.y);
    this.dropShards(target.x, target.y, shards);
    if (surge.kind) {
      this.run.stats.surges++;
      this.emit({
        type: 'lootSurge',
        x: target.x,
        y: target.y,
        kind: surge.kind,
        amount: shards,
      });
    }
    this.dropPickup('bomb', target.x - 38, target.y + 10, mult);
    if (this.rng.chance(0.5)) this.dropPickup('trap', target.x - 46, target.y - 8, mult);
    if (this.rng.chance(0.6)) this.dropEquipment(target.x - 30, target.y);
    if (mult > 1 && this.rng.chance(0.6)) this.dropEquipment(target.x + 30, target.y);
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
    // A later interactable (the boss portal, for one) must not sit under a prop.
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (Math.hypot(h.x - x, h.y - y) < 44) this.hazards.splice(i, 1);
    }
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
  /** Scatters traps and breakables; every room gets breakable crystals. */
  private placeHazards(): void {
    if (this.plan.bossOnly) return;
    for (const room of this.floor.rooms) {
      const hostile =
        room.kind === 'combat' ||
        room.kind === 'boss' ||
        room.kind === 'arena' ||
        room.kind === 'colosseum';
      // The lever goes in first so props can keep their distance from it.
      // Levers are mounted on walls away from doorways and gates.
      if (hostile && this.rng.chance(0.45)) {
        const spot = this.findWallLeverSpot(room);
        if (spot) this.addInteractable('lever', spot.x, spot.y, 0, { roomId: room.id });
      }
      if (hostile) {
        const count = 1 + (this.run.depth >= 4 ? 1 : 0) + this.rng.int(0, 1);
        const kinds: HazardKind[] = ['spike', 'flame', 'poison', 'rockfall', 'barrel'];
        for (let i = 0; i < count; i++) this.spawnHazard(room, this.rng.pick(kinds));
      }

      // Every crystal in every room is breakable: guaranteed crystal
      // clusters (more in crystal caverns and the colosseum), plus a few
      // assorted breakables in rooms that see fighting.
      let crystals = 2 + this.rng.int(0, 1);
      if (this.plan.biome === 'crystal') crystals += 2;
      if (room.kind === 'colosseum') crystals += 2;
      for (let i = 0; i < crystals; i++) this.spawnHazard(room, 'crystal');
      if (hostile) {
        const breakableCount = this.rng.int(2, 4);
        const breakables: HazardKind[] = ['crate', 'crystal', 'urn', 'barrel'];
        for (let i = 0; i < breakableCount; i++) {
          this.spawnHazard(room, this.rng.pick(breakables));
        }
      } else if (room.kind !== 'start') {
        this.spawnHazard(room, this.rng.pick(['crate', 'crystal', 'urn'] as const));
      }
    }
  }

  private findWallLeverSpot(room: Room): { x: number; y: number } | undefined {
    const margin = 2;
    const candidates: Array<{ x: number; y: number }> = [];
    // North wall
    for (let tx = room.x + margin; tx <= room.x + room.w - margin - 1; tx++) {
      const ty = room.y;
      if (this.grid.isSolid(tx, ty - 1) && !this.grid.isSolid(tx, ty)) {
        const px = (tx + 0.5) * TILE_SIZE;
        const py = ty * TILE_SIZE + 14;
        if (this.isAwayFromDoorsAndGates(room, px, py)) candidates.push({ x: px, y: py });
      }
    }
    // South wall
    for (let tx = room.x + margin; tx <= room.x + room.w - margin - 1; tx++) {
      const ty = room.y + room.h - 1;
      if (this.grid.isSolid(tx, ty + 1) && !this.grid.isSolid(tx, ty)) {
        const px = (tx + 0.5) * TILE_SIZE;
        const py = (ty + 1) * TILE_SIZE - 14;
        if (this.isAwayFromDoorsAndGates(room, px, py)) candidates.push({ x: px, y: py });
      }
    }
    // West wall
    for (let ty = room.y + margin; ty <= room.y + room.h - margin - 1; ty++) {
      const tx = room.x;
      if (this.grid.isSolid(tx - 1, ty) && !this.grid.isSolid(tx, ty)) {
        const px = tx * TILE_SIZE + 14;
        const py = (ty + 0.5) * TILE_SIZE;
        if (this.isAwayFromDoorsAndGates(room, px, py)) candidates.push({ x: px, y: py });
      }
    }
    // East wall
    for (let ty = room.y + margin; ty <= room.y + room.h - margin - 1; ty++) {
      const tx = room.x + room.w - 1;
      if (this.grid.isSolid(tx + 1, ty) && !this.grid.isSolid(tx, ty)) {
        const px = (tx + 1) * TILE_SIZE - 14;
        const py = (ty + 0.5) * TILE_SIZE;
        if (this.isAwayFromDoorsAndGates(room, px, py)) candidates.push({ x: px, y: py });
      }
    }
    return candidates.length > 0 ? this.rng.pick(candidates) : undefined;
  }

  private isAwayFromDoorsAndGates(room: Room, px: number, py: number): boolean {
    for (const d of room.doors) {
      for (const t of d.tiles) {
        if (Math.hypot(px - (t.x + 0.5) * TILE_SIZE, py - (t.y + 0.5) * TILE_SIZE) < 64)
          return false;
      }
    }
    if (room.gates) {
      for (const g of room.gates) {
        for (const t of g.tiles) {
          if (Math.hypot(px - (t.x + 0.5) * TILE_SIZE, py - (t.y + 0.5) * TILE_SIZE) < 64)
            return false;
        }
      }
    }
    return true;
  }

  private spawnHazard(room: Room, kind: HazardKind): void {
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx = this.rng.int(room.x + 1, room.x + room.w - 2);
      const ty = this.rng.int(room.y + 1, room.y + room.h - 2);
      if (this.grid.isSolid(tx, ty)) continue;
      const x = (tx + 0.5) * TILE_SIZE;
      const y = (ty + 0.5) * TILE_SIZE;
      if (this.hazards.some((h) => Math.hypot(h.x - x, h.y - y) < 46)) continue;
      // Props must not bury a chest, fountain, lever, merchant or archive.
      if (this.interactables.some((i) => Math.hypot(i.x - x, i.y - y) < 44)) continue;
      if (Math.hypot(x - this.player.x, y - this.player.y) < 60) continue;
      const breakable = isBreakable(kind);
      const radius =
        kind === 'barrel'
          ? 16
          : kind === 'crystal'
            ? 15
            : kind === 'crate'
              ? 14
              : kind === 'urn'
                ? 12
                : kind === 'poison'
                  ? 38
                  : 44;
      const hp =
        kind === 'barrel'
          ? 14
          : kind === 'crystal'
            ? 12
            : kind === 'crate'
              ? 10
              : kind === 'urn'
                ? 8
                : 0;
      this.hazards.push({
        id: this.nextId++,
        kind,
        x,
        y,
        radius,
        roomId: room.id,
        phase: 'idle',
        timer: this.rng.range(0.4, 2.4),
        period: kind === 'spike' ? 2.6 : kind === 'flame' ? 3.4 : 0.8,
        damage: breakable ? 0 : Math.round(8 + this.run.depth * 1.4),
        hp,
        maxHp: hp,
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
      this.giveChestLoot(target, 1);
      this.emit({ type: 'interact', kind: 'chest', x: target.x, y: target.y });
      // The guardian may already be down: the last chest still closes the goal.
      if (this.floorObjectives().complete) this.claimFloorBonus({ x: target.x, y: target.y + 24 });
    } else if (target.kind === 'cache') {
      // Push-your-luck (cyberpulse ADR-002/019): the seal strains on the
      // first touch with the price stated up front. Walking away is free;
      // breaking it pays double and something in the dark notices.
      if (!target.armed) {
        target.armed = true;
        this.emit({
          type: 'notice',
          text: 'The seal strains. Break it (E) for double loot — it will cost blood and company.',
        });
        this.emit({ type: 'shake', strength: 3 });
        return;
      }
      target.used = true;
      const cost = Math.max(1, Math.round(p.stats.maxHealth * ENGAGEMENT_TUNING.cacheHealthCost));
      p.health = Math.max(1, p.health - cost);
      p.invulnerable = Math.max(p.invulnerable, 0.5);
      this.giveChestLoot(target, 2);
      this.emit({ type: 'interact', kind: 'chest', x: target.x, y: target.y });
      for (let i = 0; i < 2; i++) {
        const elite = this.spawnEnemy(
          this.rng.pick(this.plan.roster),
          target.x,
          target.y,
          target.roomId ?? -1
        );
        elite.state = 'chase';
        elite.elite = true;
        elite.health = elite.maxHealth = Math.round(elite.maxHealth * 1.5);
      }
      this.emit({ type: 'notice', text: 'The seal breaks. The dark sends collectors.' });
      this.emit({ type: 'shake', strength: 10 });
      if (this.floorObjectives().complete) this.claimFloorBonus({ x: target.x, y: target.y + 24 });
    } else if (target.kind === 'lever') {
      target.used = true;
      const room = target.roomId === undefined ? undefined : this.floor.rooms[target.roomId];
      if (room?.kind === 'vault' && room.sealed) {
        this.openVault(room);
      } else {
        this.disableHazards(target.roomId);
        this.emit({ type: 'notice', text: 'The old lever answers. The room falls quiet.' });
      }
      this.emit({ type: 'interact', kind: 'lever', x: target.x, y: target.y });
    } else if (target.kind === 'wayfarer') {
      target.used = true;
      this.run.pendingChoices.push({
        source: 'wayfarer',
        options: rollChoices(this.rng, p.upgrades, 3, 'generous'),
      });
      this.emit({ type: 'notice', text: this.rng.pick(WAYFARER_LINES) });
      this.emit({ type: 'interact', kind: 'wayfarer', x: target.x, y: target.y });
    } else if (target.kind === 'waystone') {
      this.useWaystone(target);
    } else if (target.kind === 'ferryman') {
      const boss = this.floor.rooms[this.floor.bossRoom];
      if (this.currentRoom()?.id === boss.id) {
        this.emit({ type: 'notice', text: 'The Ferryman is already at the far bank.' });
        return;
      }
      if (p.shards < target.cost) {
        this.emit({ type: 'notice', text: `The Ferryman wants ${target.cost} shards` });
        return;
      }
      p.shards -= target.cost;
      target.used = true;
      const centre = roomCentrePx(boss);
      const spot = this.clampToRoomInterior(boss, centre.x, centre.y + TILE_SIZE * 2);
      const fromX = p.x;
      const fromY = p.y;
      p.x = spot.x;
      p.y = spot.y;
      p.invulnerable = Math.max(p.invulnerable, 1);
      this.visited[boss.id] = true;
      this.emit({ type: 'blink', x: fromX, y: fromY, toX: spot.x, toY: spot.y });
      this.emit({ type: 'notice', text: this.rng.pick(FERRYMAN_LINES) });
      this.emit({ type: 'interact', kind: 'ferryman', x: target.x, y: target.y });
    } else if (target.kind === 'fountain') {
      target.used = true;
      p.health = Math.min(p.stats.maxHealth, p.health + p.stats.maxHealth * 0.35);
      if (p.health > p.stats.maxHealth * ENGAGEMENT_TUNING.clutchThreshold) p.clutchUsed = false;
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
      if (p.health > p.stats.maxHealth * ENGAGEMENT_TUNING.clutchThreshold) p.clutchUsed = false;
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
      if (state.wavesLeft > 0) {
        state.spawnDelay = 0.65;
        const c = roomCentrePx(r);
        this.emit({ type: 'shockwave', x: c.x, y: c.y, radius: 110 });
        this.emit({ type: 'shake', strength: 5 });
        const waveNum = (state.totalWaves ?? 2) - state.wavesLeft + 1;
        const text = state.hideWaveCount
          ? `Wave ${waveNum}`
          : `Wave ${waveNum} of ${state.totalWaves ?? 2}`;
        this.emit({
          type: 'notice',
          text,
        });
      } else {
        this.clearRoom(r);
      }
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
      state.totalWaves = 1;
      state.spawnDelay = 1.0;
      const boss = room.kind === 'boss' ? this.plan.boss : arenaBossFor(this.run.depth);
      this.emit({ type: 'bossIntro', name: enemyDef(boss).name });
      if (room.kind === 'arena')
        this.emit({ type: 'notice', text: 'An echo guardian holds the arena alone.' });
    } else if (room.kind === 'colosseum') {
      // The colosseum is the floor's centrepiece: six-plus waves with the
      // count always shown, so the crowd knows how long the show runs.
      state.wavesLeft = Math.min(
        10,
        6 + (this.run.depth >= 3 ? 1 : 0) + (this.rng.chance(0.5) ? 1 : 0)
      );
      state.totalWaves = state.wavesLeft;
      state.hideWaveCount = false;
      state.spawnDelay = 0.5;
      this.emit({ type: 'notice', text: 'The colosseum hungers for a champion.' });
    } else {
      const area = room.w * room.h;
      const depth = this.run.depth;
      // Multi-wave encounters scale with chamber area and expedition depth:
      // Smaller chambers (< 140): 1 wave.
      // Medium chambers (140-199): 1 wave on depth 0, 2 waves on depth >= 1.
      // Large chambers (200-239): 2 waves on depth 0-2, 3 waves on depth >= 3.
      // Grand halls (>= 240): 2 waves on depth 0, 3 waves on depth 1-5, 4 waves on depth >= 6.
      let waves = 1;
      if (area >= 140 && depth >= 1) waves = 2;
      if (area >= 180) {
        waves = depth >= 3 ? 3 : 2;
      }
      if (area >= 210 && depth >= 4) {
        waves = depth >= 6 ? 4 : 3;
      }
      if (area >= 240) {
        waves = depth >= 7 ? 4 : depth >= 1 ? 3 : 2;
      }
      // Rooms can have up to 10 waves; chance drops with each wave increase
      let extraChance = 0.52;
      while (waves < 10 && this.rng.chance(extraChance)) {
        waves++;
        extraChance *= 0.62;
      }
      state.wavesLeft = waves;
      state.totalWaves = waves;
      state.hideWaveCount = this.rng.chance(0.42);
      state.spawnDelay = 0.35;
      // The stalker cashes in here: an elite joins the opening wave.
      this.spawnStalker(room);
    }
  }

  private spawnWave(room: Room): void {
    const state = this.rooms[room.id];
    state.wavesLeft--;
    if (state.wavesLeft === 0 && (state.totalWaves ?? 1) > 1) {
      this.emit({ type: 'notice', text: 'Final wave approaching!' });
    }
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
      if (boss === 'mirror_self') {
        this.emit({ type: 'notice', text: 'It moves the way you move.' });
        this.emit({ type: 'shake', strength: 5 });
      }
      // A guardian is still a fight: the armed stalker joins it instead of
      // being silently dropped at the boss door.
      this.spawnStalker(room);
      return;
    }
    // Wave size grows with the section, so late rooms are crowded rather than
    // just longer. Colosseum waves pour in at more than double the rate to
    // fill a chamber six times the size of a grand hall.
    // The Restless Dead twist (daily or omen) sends one extra enemy with every wave.
    const restless = activeModifier(this.run) === 'restless_dead' ? 1 : 0;
    const baseCount =
      room.kind === 'colosseum'
        ? 7 + Math.floor(this.run.depth * 1.6) + this.rng.int(0, 3)
        : 3 + Math.floor(this.run.depth * 0.85) + this.rng.int(0, 2);
    const cap = enemyWaveCap(room.w * room.h, room.kind === 'colosseum');
    const count = Math.min(cap, Math.max(1, Math.round(baseCount * ENEMY_COUNT_SCALE) + restless));
    for (let i = 0; i < count; i++) {
      let spot: { x: number; y: number } | undefined;
      const enemyDefId = this.rng.pick(this.plan.roster);
      // Enemies can teleport into the chamber directly with a void rift
      const isTeleportSpawn = this.rng.chance(0.38);
      if (!isTeleportSpawn && room.gates && room.gates.length > 0 && this.rng.chance(0.65)) {
        spot = this.gateSpawn(room);
      }
      if (!spot) spot = this.spawnPoint(room);
      if (spot) {
        const enemy = this.spawnEnemy(enemyDefId, spot.x, spot.y, room.id);
        if (isTeleportSpawn || enemy.def.archetype === 'teleporter') {
          this.emit({ type: 'blink', x: spot.x, y: spot.y - 20, toX: spot.x, toY: spot.y });
        }
      }
    }
  }

  /** Spends the armed hunter pressure: an elite stalker joins this fight. */
  private spawnStalker(room: Room): void {
    if (!this.stalkerArmed) return;
    this.stalkerArmed = false;
    if (this.plan.roster.length === 0) return;
    const spot = this.spawnPoint(room);
    if (!spot) return;
    const stalker = this.spawnEnemy(this.rng.pick(this.plan.roster), spot.x, spot.y, room.id);
    stalker.elite = true;
    stalker.maxHealth = Math.round(stalker.maxHealth * 1.5);
    stalker.health = stalker.maxHealth;
    stalker.state = 'chase';
    this.emit({ type: 'notice', text: 'A stalker has picked up your scent.' });
    this.emit({ type: 'shake', strength: 6 });
  }

  /**
   * A gate mouth the player is not standing next to. Gates are fixed points, so
   * without this check a wave could materialise on top of a player camping one.
   */
  private gateSpawn(room: Room): { x: number; y: number } | undefined {
    const p = this.player;
    const open = room.gates?.filter((g) => Math.hypot(g.spawnX - p.x, g.spawnY - p.y) >= 140);
    if (!open || open.length === 0) return undefined;
    const gate = this.rng.pick(open);
    return { x: gate.spawnX, y: gate.spawnY };
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
    if (
      !state.ambushed &&
      (room.kind === 'combat' || room.kind === 'colosseum') &&
      this.run.depth >= 1 &&
      this.rng.chance(room.kind === 'colosseum' ? 0.35 : 0.12)
    ) {
      state.ambushed = true;
      state.wavesLeft = 1;
      state.totalWaves = (state.totalWaves ?? 1) + 1;
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
    // Surprise: a late room can break into a short memory storm after its
    // last wave. The pack is capped at three so the room stays readable.
    if (
      !state.stormed &&
      this.run.depth >= 10 &&
      (room.kind === 'combat' || room.kind === 'colosseum') &&
      this.plan.roster.length > 0 &&
      this.rng.chance(0.08)
    ) {
      state.stormed = true;
      state.wavesLeft = 0;
      state.spawnDelay = 0;
      const pack = Math.min(3, this.plan.roster.length);
      for (let i = 0; i < pack; i++) {
        const spot = this.spawnPoint(room);
        if (!spot) continue;
        const enemy = this.spawnEnemy(this.rng.pick(this.plan.roster), spot.x, spot.y, room.id);
        enemy.state = 'chase';
        enemy.elite = i === 0;
      }
      this.emit({ type: 'notice', text: 'A memory storm breaks over the room.' });
      this.emit({ type: 'shake', strength: 7 });
      return;
    }
    state.phase = 'cleared';
    this.setRoomLocked(room, false);
    this.run.stats.roomsCleared++;
    // Flow carry: a streak earned in this room survives the walk to the next
    // one. Tops a decayed window back to the graze floor (1.5s) without
    // extending a fresh one.
    if (this.player.resonance > 0)
      this.player.resonanceTime = Math.max(this.player.resonanceTime, RESONANCE_WINDOW * 0.5);
    this.run.stats.onboarding |= 32;
    if (room.kind === 'colosseum') this.run.stats.colosseumsWon++;
    // Hunter pressure: every third cleared fighting room arms a stalker for
    // the next one, so loud runs escalate on their own (cyberpulse ADR-016).
    if (room.kind === 'combat' || room.kind === 'colosseum') {
      this.stalkerClock++;
      if (this.stalkerClock % 3 === 0) this.stalkerArmed = true;
    }
    this.emit({ type: 'roomCleared', roomId: room.id });
    const c = roomCentrePx(room);
    // Untouched health is its own reward: finishing a room clean pays extra.
    if (this.roomDamage === 0) {
      const shards =
        ENGAGEMENT_TUNING.flawlessBase + ENGAGEMENT_TUNING.flawlessPerDepth * this.run.depth;
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
    if (room.kind === 'colosseum') {
      // Surviving six-plus waves pays like a boss: a relic, a shard cache
      // scaled to the fight, and a potion for the road.
      this.dropEquipment(c.x, c.y - 20);
      this.dropShards(c.x, c.y, 50 + this.run.depth * 8);
      this.dropPickup('potion', c.x, c.y + 24, 1);
      this.emit({ type: 'notice', text: 'Champion of the colosseum! The crowd showers you.' });
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
    const shards =
      ENGAGEMENT_TUNING.floorBonusBase + ENGAGEMENT_TUNING.floorBonusPerDepth * this.run.depth;
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
    // Near-miss comeback (cyberpulse ADR-019): a kill landed while the walker
    // is near death pays guts bonus shards on the spot.
    if (
      this.player.health > 0 &&
      this.player.health < this.player.stats.maxHealth * ENGAGEMENT_TUNING.clutchKillThreshold
    ) {
      run.stats.clutchKills++;
      const bonus =
        ENGAGEMENT_TUNING.clutchBase + this.run.depth * ENGAGEMENT_TUNING.clutchPerDepth;
      this.dropShards(enemy.x, enemy.y, bonus);
      this.emit({ type: 'notice', text: `Clutch! +${bonus} shards` });
    }
    this.emit({
      type: 'enemyDied',
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      boss: enemy.isBoss,
      defId: enemy.def.id,
    });
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

    const xp = Math.round(
      enemy.def.xp * (1 + 0.1 * run.depth) * (enemy.elite ? 2 : 1) * flow * ENEMY_XP_SCALE
    );
    const levels = grantXp(run, xp, () => rollChoices(this.rng, p.upgrades));
    if (levels > 0) this.emit({ type: 'levelUp', level: p.level });

    const base = enemy.isBoss ? 30 : this.rng.int(1, 3) + (enemy.elite ? 5 : 0);
    const surge = this.rollSurge();
    const shards = Math.round(base * flow * surge.factor);
    const dropPos = this.safeDropPosition(enemy.x, enemy.y);
    this.dropShards(dropPos.x, dropPos.y, shards);
    if (surge.kind) {
      run.stats.surges++;
      // Only a jackpot is worth a potion; a rich vein is just extra shards.
      if (surge.kind === 'jackpot') {
        const potionPos = this.safeDropPosition(
          dropPos.x,
          dropPos.y + (this.grid.isSolidAtPixel(dropPos.x, dropPos.y - 20, 'player') ? 20 : -20)
        );
        this.dropPickup('potion', potionPos.x, potionPos.y, 1);
      }
      this.emit({
        type: 'lootSurge',
        x: dropPos.x,
        y: dropPos.y,
        kind: surge.kind,
        amount: shards,
      });
    }
    if (!enemy.isBoss && this.rng.chance(0.07)) this.dropPickup('health', dropPos.x, dropPos.y, 12);
    if (!enemy.isBoss && this.rng.chance(0.025)) this.dropPickup('potion', dropPos.x, dropPos.y, 1);
    // Bosses always leave a relic; elites sometimes do.
    if (enemy.isBoss || (enemy.elite && this.rng.chance(0.4)))
      this.dropEquipment(dropPos.x, dropPos.y);
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
    this.run.stats.onboarding |= 16;
    return true;
  }

  unequip(slot: 'weapon' | 'armor' | 'trinket'): boolean {
    const p = this.player;
    const item = p.equipment[slot];
    if (!item) return false;
    if (p.inventory.length >= INVENTORY_SLOTS) return false;
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

  /** Sells a carried relic for shards; returns the price, or undefined when not carried. */
  sellItem(uid: number): number | undefined {
    const p = this.player;
    const index = p.inventory.findIndex((item) => item.uid === uid);
    if (index < 0) return undefined;
    const [item] = p.inventory.splice(index, 1);
    const price = relicSellShards(equipmentDef(item.defId));
    p.shards += price;
    return price;
  }

  /**
   * Ensures dropped loot never falls inside gates or solid walls where the player cannot reach it.
   */
  safeDropPosition(x: number, y: number): { x: number; y: number } {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    // If the point is on an open floor tile not solid to the player,
    // ensure it is also pushed inwards away from any adjacent solid tiles (walls, gates).
    if (this.grid.inBounds(tx, ty) && !this.grid.isSolid(tx, ty, 'player')) {
      let px = x;
      let py = y;
      const margin = 16;
      if (this.grid.isSolid(tx - 1, ty, 'player')) px = Math.max(px, tx * TILE_SIZE + margin);
      if (this.grid.isSolid(tx + 1, ty, 'player')) px = Math.min(px, (tx + 1) * TILE_SIZE - margin);
      if (this.grid.isSolid(tx, ty - 1, 'player')) py = Math.max(py, ty * TILE_SIZE + margin);
      if (this.grid.isSolid(tx, ty + 1, 'player')) py = Math.min(py, (ty + 1) * TILE_SIZE - margin);
      return { x: px, y: py };
    }
    // Otherwise (e.g. enemy died on a Gate tile or outside room), find the nearest
    // accessible player-walkable tile that has open space around it.
    let best: { x: number; y: number } | undefined;
    let bestDist = Infinity;
    let bestOpenNeighbors = -1;
    for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (this.grid.inBounds(nx, ny) && !this.grid.isSolid(nx, ny, 'player')) {
            const distSq = dx * dx + dy * dy;
            let open = 0;
            if (!this.grid.isSolid(nx - 1, ny, 'player')) open++;
            if (!this.grid.isSolid(nx + 1, ny, 'player')) open++;
            if (!this.grid.isSolid(nx, ny - 1, 'player')) open++;
            if (!this.grid.isSolid(nx, ny + 1, 'player')) open++;
            if (open > bestOpenNeighbors || (open === bestOpenNeighbors && distSq < bestDist)) {
              bestOpenNeighbors = open;
              bestDist = distSq;
              best = {
                x: (nx + 0.5) * TILE_SIZE,
                y: (ny + 0.5) * TILE_SIZE,
              };
            }
          }
        }
      }
      if (best && bestOpenNeighbors >= 2) break;
    }
    return best ?? { x, y };
  }

  private dropEquipment(x: number, y: number): void {
    const at = this.safeDropPosition(x, y);
    const p = this.player;
    const def = rollEquipment(this.rng, this.run.depth);
    const item: EquipmentItem = { uid: p.nextEquipmentId++, defId: def.id };
    this.pickups.push({
      id: this.nextId++,
      kind: 'equipment',
      x: at.x,
      y: at.y,
      amount: 1,
      equipment: item,
      age: 0,
      vx: this.rng.range(-30, 30),
      vy: this.rng.range(-30, 30),
    });
  }

  /** One variable-ratio roll: mostly normal, sometimes rich, rarely a jackpot. */
  private rollSurge(): { kind?: 'rich' | 'jackpot'; factor: number } {
    const roll = this.rng.next();
    if (roll < SURGE_JACKPOT) return { kind: 'jackpot', factor: ENGAGEMENT_TUNING.jackpotFactor };
    if (roll < SURGE_RICH) return { kind: 'rich', factor: ENGAGEMENT_TUNING.richFactor };
    return { factor: 1 };
  }

  private dropShards(x: number, y: number, total: number): void {
    // Ember Tide (daily or omen) fences every drop a little richer.
    if (activeModifier(this.run) === 'ember_tide') total = Math.round(total * 1.25);
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
    const pos = this.safeDropPosition(x, y);
    const angle = this.rng.range(0, Math.PI * 2);
    const speed = kind === 'fragment' ? 0 : this.rng.range(60, 170);
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    if (vx > 0 && this.grid.isSolidAtPixel(pos.x + 18, pos.y, 'player')) vx = -Math.abs(vx);
    else if (vx < 0 && this.grid.isSolidAtPixel(pos.x - 18, pos.y, 'player')) vx = Math.abs(vx);
    if (vy > 0 && this.grid.isSolidAtPixel(pos.x, pos.y + 18, 'player')) vy = -Math.abs(vy);
    else if (vy < 0 && this.grid.isSolidAtPixel(pos.x, pos.y - 18, 'player')) vy = Math.abs(vy);

    this.pickups.push({
      id: this.nextId++,
      kind,
      x: pos.x,
      y: pos.y,
      amount,
      fragmentId,
      age: 0,
      vx,
      vy,
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
      if (h.hitFlash !== undefined) h.hitFlash = Math.max(0, h.hitFlash - dt);
      // A primed prop cooks off a beat after the blast that lit it, so a
      // cluster detonates as a visible chain rather than one instant.
      if (h.ignite !== undefined && !h.disabled) {
        h.ignite -= dt;
        if (h.ignite <= 0) {
          this.damageHazard(h, h.maxHp + h.hp);
          continue;
        }
      }
      if (h.disabled || isBreakable(h.kind)) continue;
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
      this.damagePlayer(
        Math.round(b.damage * (b.owner === 'player' ? 0.65 : 1)),
        b.x,
        b.y,
        260,
        b.owner === 'enemy'
      );
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
    this.igniteBreakables(b.x, b.y, b.radius * 0.9);
  }

  /** Player attacks break barrels, crates, urns and crystals; traps are not destructible. */
  hitHazards(
    x: number,
    y: number,
    radius: number,
    damage: number,
    angle?: number,
    halfArc?: number
  ): number {
    let hits = 0;
    for (const h of [...this.hazards]) {
      if (!isBreakable(h.kind) || h.disabled) continue;
      // A swing only breaks what it faces; a dash or a radial art passes no arc.
      if (angle !== undefined && halfArc !== undefined) {
        if (!inArc(x, y, angle, radius, halfArc, h.x, h.y, h.radius)) continue;
      } else if (Math.hypot(h.x - x, h.y - y) > radius + h.radius) continue;
      this.damageHazard(h, damage);
      hits++;
    }
    return hits;
  }

  private damageHazard(h: Hazard, amount: number): void {
    if (!isBreakable(h.kind) || h.disabled) return;
    h.hp -= amount;
    if (h.hp > 0) {
      h.hitFlash = 0.18;
      this.emit({ type: 'hazardHit', kind: h.kind, x: h.x, y: h.y });
      return;
    }
    const index = this.hazards.indexOf(h);
    if (index >= 0) this.hazards.splice(index, 1);
    const at = this.safeDropPosition(h.x, h.y);
    if (h.kind === 'barrel') this.breakBarrel(h, at);
    else if (h.kind === 'crystal') this.breakCrystal(h, at);
    else if (h.kind === 'urn') this.breakUrn(h, at);
    else this.breakCrate(h, at);
  }

  /** A blast lights nearby breakables; each gets a short fuse, so chains cascade. */
  private igniteBreakables(x: number, y: number, radius: number, except?: Hazard): void {
    for (const other of this.hazards) {
      if (other === except || other.disabled || !isBreakable(other.kind)) continue;
      if (other.ignite !== undefined) continue;
      const dist = Math.hypot(other.x - x, other.y - y);
      if (dist > radius + other.radius) continue;
      other.ignite = 0.16 + dist / 420;
      other.hitFlash = 0.18;
      this.emit({ type: 'hazardHit', kind: other.kind, x: other.x, y: other.y });
    }
  }

  /** A barrel detonates and hurts everyone, the player included. */
  private breakBarrel(h: Hazard, at: { x: number; y: number }): void {
    const radius = 96;
    this.emit({ type: 'hazardBurst', kind: 'barrel', x: h.x, y: h.y, radius });
    this.emit({ type: 'shake', strength: 7 });
    for (const e of this.enemies)
      if (e.state !== 'dying' && Math.hypot(e.x - h.x, e.y - h.y) <= radius + e.radius)
        this.damageEnemy(e, 50, 'hazard', false, 220);
    const p = this.player;
    if (Math.hypot(p.x - h.x, p.y - h.y) <= radius + p.radius) this.damagePlayer(20, h.x, h.y, 260);
    this.igniteBreakables(h.x, h.y, radius, h);
    const surge = this.rollSurge();
    const baseShards = 4 + this.run.depth;
    const shards = Math.round(baseShards * surge.factor);
    this.dropShards(at.x, at.y, shards);
    if (surge.kind) {
      this.run.stats.surges++;
      this.emit({ type: 'lootSurge', x: at.x, y: at.y, kind: surge.kind, amount: shards });
    }
    if (this.rng.chance(0.4)) this.dropPickup('bomb', at.x + 18, at.y, 1);
    if (this.rng.chance(0.35)) this.dropPickup('trap', at.x - 18, at.y, 1);
  }

  /** A crate spills stored shards and sometimes a tool. */
  private breakCrate(h: Hazard, at: { x: number; y: number }): void {
    this.emit({ type: 'hazardBurst', kind: 'crate', x: h.x, y: h.y, radius: 54 });
    this.emit({ type: 'shake', strength: 2 });
    const surge = this.rollSurge();
    const baseShards = 2 + Math.round(this.run.depth * 0.6) + this.rng.int(0, 1);
    const shards = Math.round(baseShards * surge.factor);
    this.dropShards(at.x, at.y, shards);
    if (surge.kind) {
      this.run.stats.surges++;
      this.emit({ type: 'lootSurge', x: at.x, y: at.y, kind: surge.kind, amount: shards });
    }
    if (this.rng.chance(0.3)) this.dropPickup('bomb', at.x + 16, at.y, 1);
    else if (this.rng.chance(0.2)) this.dropPickup('trap', at.x - 16, at.y, 1);
  }

  /** A crystal shatters into a memory flare that sears nearby enemies but never the player. */
  private breakCrystal(h: Hazard, at: { x: number; y: number }): void {
    const radius = 86;
    this.emit({ type: 'hazardBurst', kind: 'crystal', x: h.x, y: h.y, radius });
    this.emit({ type: 'shake', strength: 3 });
    for (const e of this.enemies)
      if (e.state !== 'dying' && Math.hypot(e.x - h.x, e.y - h.y) <= radius + e.radius)
        this.damageEnemy(e, 24 + this.run.depth * 2, 'hazard', false, 120);
    // The flare cracks adjacent clay, crystal and wood, so clusters chain apart.
    for (const other of [...this.hazards]) {
      if (!isBreakable(other.kind) || other.kind === 'barrel' || other.disabled) continue;
      if (Math.hypot(other.x - h.x, other.y - h.y) <= radius + other.radius)
        this.damageHazard(other, 12);
    }
    const surge = this.rollSurge();
    const baseShards = 3 + Math.round(this.run.depth * 0.75);
    const shards = Math.round(baseShards * surge.factor);
    this.dropShards(at.x, at.y, shards);
    if (surge.kind) {
      this.run.stats.surges++;
      this.emit({ type: 'lootSurge', x: at.x, y: at.y, kind: surge.kind, amount: shards });
    }
    if (this.rng.chance(0.22)) this.dropPickup('potion', at.x, at.y, 1);
  }

  /** An urn hides a small healing draught or a few shards. */
  private breakUrn(h: Hazard, at: { x: number; y: number }): void {
    this.emit({ type: 'hazardBurst', kind: 'urn', x: h.x, y: h.y, radius: 46 });
    const surge = this.rollSurge();
    const baseShards = 1 + this.rng.int(0, 2);
    const shards = Math.round(baseShards * surge.factor);
    this.dropShards(at.x, at.y, shards);
    if (surge.kind) {
      this.run.stats.surges++;
      this.emit({ type: 'lootSurge', x: at.x, y: at.y, kind: surge.kind, amount: shards });
    }
    if (this.rng.chance(0.25)) this.dropPickup('health', at.x, at.y, 10 + this.run.depth);
    if (this.rng.chance(0.15)) this.dropPickup('potion', at.x, at.y, 1);
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
        this.damagePlayer(b.damage, b.x, b.y, 200, true);
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
      this.emit({ type: 'blast', x: m.x, y: m.y, radius: MINE_RADIUS });
      if (Math.hypot(p.x - m.x, p.y - m.y) <= MINE_RADIUS + p.radius)
        this.damagePlayer(m.damage, m.x, m.y, 180, true);
      for (const e of this.enemies)
        if (e.state !== 'dying' && Math.hypot(e.x - m.x, e.y - m.y) <= MINE_RADIUS + e.radius)
          this.damageEnemy(e, Math.round(m.damage * 0.5), 'hazard', false, 60);
    }
  }

  /** A lever disables every trap in its room; breakables keep their contents. */
  disableHazards(roomId?: number): void {
    for (const h of this.hazards)
      if (!isBreakable(h.kind) && (roomId === undefined || h.roomId === roomId)) {
        h.disabled = true;
        // A hazard disarmed mid-warning must not leave a dead telegraph ring.
        h.phase = 'idle';
        h.timer = 0;
      }
  }

  /** Opens a sealed vault: its doorway becomes a real door and the room is revealed. */
  private openVault(room: Room): void {
    if (!room.sealed) return;
    room.sealed = false;
    for (const t of room.secretTiles ?? []) this.grid.set(t.x, t.y, t.tile);
    room.secretTiles = undefined;
    for (const door of room.doors)
      for (const t of door.tiles) {
        this.grid.set(t.x, t.y, Tile.Door);
        this.grid.setDoorLocked(t.x, t.y, false);
      }
    const centre = roomCentrePx(room);
    this.addInteractable('chest', centre.x, centre.y, 0);
    this.emit({ type: 'secretOpened', roomId: room.id });
    this.emit({ type: 'notice', text: 'The wall remembers a door. A sealed vault opens.' });
    this.emit({ type: 'shake', strength: 5 });
  }

  /** One-way fast travel: return to the entrance, or from the entrance to the deep. */
  private useWaystone(target: Interactable): void {
    const start = this.floor.rooms[this.floor.startRoom];
    const current = this.currentRoom();
    const visited = this.floor.rooms
      .filter((r) => this.visited[r.id] && r.id !== start.id && r.kind !== 'vault')
      .sort((a, b) => b.distance - a.distance);
    const targetRoom = current && current.id !== start.id ? start : visited[0];
    if (!targetRoom || targetRoom.id === current?.id) {
      this.emit({ type: 'notice', text: 'The waystone has nowhere to lead yet.' });
      return;
    }
    const centre = roomCentrePx(targetRoom);
    const spot = this.clampToRoomInterior(targetRoom, centre.x, centre.y + TILE_SIZE);
    const fromX = this.player.x;
    const fromY = this.player.y;
    this.player.x = spot.x;
    this.player.y = spot.y;
    this.player.invulnerable = Math.max(this.player.invulnerable, 1);
    this.visited[targetRoom.id] = true;
    target.used = true;
    this.emit({ type: 'blink', x: fromX, y: fromY, toX: spot.x, toY: spot.y });
    this.emit({
      type: 'notice',
      text:
        current?.id === start.id
          ? 'The waystone remembers the deep road.'
          : 'The waystone carries you back to the entrance.',
    });
    this.emit({ type: 'interact', kind: 'waystone', x: target.x, y: target.y });
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    const currentRoom = this.currentRoom();
    const currentRoomCleared = currentRoom && this.rooms[currentRoom.id]?.phase === 'cleared';

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const item = this.pickups[i];
      item.age += dt;

      // Nudge out any pickup trapped inside a solid tile
      if (this.grid.isSolidAtPixel(item.x, item.y, 'player')) {
        const safe = this.safeDropPosition(item.x, item.y);
        item.x = safe.x;
        item.y = safe.y;
      }
      const dist = Math.hypot(p.x - item.x, p.y - item.y);

      // In a cleared room, magnetism expands so no items remain stranded in corners/doors
      const inSameClearedRoom = Boolean(
        currentRoomCleared &&
        currentRoom &&
        item.x >= currentRoom.x * TILE_SIZE - 8 &&
        item.x <= (currentRoom.x + currentRoom.w) * TILE_SIZE + 8 &&
        item.y >= currentRoom.y * TILE_SIZE - 8 &&
        item.y <= (currentRoom.y + currentRoom.h) * TILE_SIZE + 8
      );

      const homingRange = inSameClearedRoom
        ? Math.max(p.stats.pickupRadius * 3, 260)
        : item.kind === 'shard'
          ? p.stats.pickupRadius * 2.2
          : p.stats.pickupRadius;

      const homing = item.age > 0.35 && p.action !== 'dead' && dist < homingRange;
      if (homing && item.kind !== 'fragment') {
        const pull = inSameClearedRoom ? 620 : 520;
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

      // When settled, ensure item remains on walkable floor away from solid margins
      if (Math.hypot(item.vx, item.vy) < 15 && this.grid.isSolidAtPixel(item.x, item.y, 'player')) {
        const safe = this.safeDropPosition(item.x, item.y);
        item.x = safe.x;
        item.y = safe.y;
      }

      const canCollect =
        item.age > 0.2 &&
        p.action !== 'dead' &&
        (dist < p.radius + 24 || (homing && dist < p.stats.pickupRadius * 0.85 && item.age > 0.45));
      if (canCollect && this.collect(item)) this.pickups.splice(i, 1);
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
        if (p.health > p.stats.maxHealth * ENGAGEMENT_TUNING.clutchThreshold) p.clutchUsed = false;
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
        let auto = false;
        let sold: number | undefined;
        if (!p.equipment[slot]) {
          p.equipment[slot] = relic;
          refreshStats(p);
          auto = true;
        } else if (p.inventory.length < INVENTORY_SLOTS) {
          p.inventory.push(relic);
        } else {
          sold = relicSellShards(def);
          p.shards += sold;
        }
        this.emit({
          type: 'equipment',
          name: def.name,
          rarity: def.rarity,
          slot,
          auto,
          sold,
        });
        break;
      }
    }
    this.emit({ type: 'pickup', kind: item.kind, x: item.x, y: item.y, amount: item.amount });
    return true;
  }
}
