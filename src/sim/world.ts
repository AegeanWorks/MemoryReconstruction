/**
 * One dungeon floor in play. `step` advances the simulation by a fixed time
 * step and returns the events that happened; nothing here touches the DOM or
 * the renderer, so tests and bots can drive a World headlessly.
 */
import { circlesTouch, type Arena, type DamageSource } from './combat';
import { enemyDef, fragmentsForFloor, floorPlan, FINAL_DEPTH, type FloorPlan } from './content';
import { generateFloor, roomAt, roomCentrePx, type FloorMap, type Room } from './dungeon';
import { createEnemy, killEnemy, staggerEnemy, updateBossPhase, updateEnemy } from './enemies';
import type { Enemy, InputFrame, Interactable, Pickup, Projectile } from './entities';
import type { SimEvent } from './events';
import { FlowField } from './pathing';
import { moveAndCollide, separate } from './physics';
import { updatePlayer } from './player';
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
  readonly rng: Rng;
  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectile[] = [];
  readonly pickups: Pickup[] = [];
  readonly interactables: Interactable[] = [];
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

  constructor(readonly run: RunState) {
    this.plan = floorPlan(run.depth);
    const seed = floorSeed(run.seed, run.depth);
    this.floor = generateFloor(seed, run.depth, {
      roomCount: this.plan.roomCount,
      finale: this.plan.finale,
    });
    this.rng = new Rng(seed ^ 0x5bd1e995);
    this.rooms = this.floor.rooms.map((r) => ({
      phase: r.kind === 'combat' || r.kind === 'boss' ? 'dormant' : 'cleared',
      wavesLeft: 0,
      spawnDelay: 0,
    }));
    this.visited = this.floor.rooms.map(() => false);
    this.flow = new FlowField(this.floor.grid);
    const owned = new Set([...run.knownFragments, ...run.fragmentsFound]);
    this.fragmentQueue = fragmentsForFloor(this.plan.biome, owned);

    const start = roomCentrePx(this.floor.rooms[this.floor.startRoom]);
    run.player.x = start.x;
    run.player.y = start.y + TILE_SIZE * 2;
    run.player.action = 'idle';
    run.player.knockX = 0;
    run.player.knockY = 0;
    this.placeInteractables();
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
    const rooms = this.floor.rooms.filter((r) => r.kind === 'combat' || r.kind === 'boss');
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
      if (room.kind === 'treasure') this.addInteractable('chest', c.x, c.y, 0);
      if (room.kind === 'shrine')
        this.addInteractable('shrine', c.x, c.y, 25 + 15 * this.run.depth);
    }
  }

  private addInteractable(kind: Interactable['kind'], x: number, y: number, cost: number): void {
    this.interactables.push({ id: this.nextId++, kind, x, y, used: false, cost });
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
      this.run.pendingChoices.push({
        source: 'chest',
        options: rollChoices(this.rng, p.upgrades, 3, 'generous'),
      });
      this.dropFragment(target.x + 40, target.y);
      this.dropShards(target.x, target.y, 8 + 4 * this.run.depth);
      this.emit({ type: 'interact', kind: 'chest', x: target.x, y: target.y });
      // The guardian may already be down: the last chest still closes the goal.
      if (this.floorObjectives().complete) this.claimFloorBonus({ x: target.x, y: target.y + 24 });
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
    if (room.kind === 'boss') {
      state.wavesLeft = 1;
      state.spawnDelay = 1.0;
      this.emit({ type: 'bossIntro', name: enemyDef(this.plan.boss).name });
    } else {
      const area = room.w * room.h;
      state.wavesLeft = this.run.depth >= 1 && area >= 150 ? 2 : 1;
      if (this.run.depth >= 3 && area >= 220) state.wavesLeft = 3;
      state.spawnDelay = 0.35;
    }
  }

  private spawnWave(room: Room): void {
    const state = this.rooms[room.id];
    state.wavesLeft--;
    if (room.kind === 'boss') {
      const c = roomCentrePx(room);
      this.spawnEnemy(this.plan.boss, c.x, c.y - TILE_SIZE * 2, room.id, true);
      return;
    }
    const count = 3 + Math.floor(this.run.depth * 0.7) + this.rng.int(0, 2);
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
    this.rooms[room.id].phase = 'cleared';
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
      this.dropFragment(c.x + 40, c.y);
      this.claimFloorBonus(c);
      if (this.run.depth >= FINAL_DEPTH) this.victoryDelay = 2.5;
      else this.addInteractable('portal', c.x, c.y, 0);
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
        if (p.health >= p.stats.maxHealth) return false;
        p.health = Math.min(p.stats.maxHealth, p.health + item.amount);
        break;
      case 'potion':
        if (p.potions >= p.stats.maxPotions) return false;
        p.potions++;
        break;
      case 'fragment':
        if (item.fragmentId) {
          this.run.fragmentsFound.push(item.fragmentId);
          this.emit({ type: 'fragmentFound', fragmentId: item.fragmentId });
        }
        break;
    }
    this.emit({ type: 'pickup', kind: item.kind, x: item.x, y: item.y, amount: item.amount });
    return true;
  }
}
