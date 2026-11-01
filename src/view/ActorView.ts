/**
 * Draws everything that moves: player, enemies (with attack telegraphs),
 * projectiles, pickups and interactables. Sprites are keyed by sim entity id
 * and created or destroyed as entities come and go.
 *
 * Positions are interpolated between the last two sim steps so motion stays
 * smooth on displays faster than the 60 Hz simulation.
 */
import { AnimatedSprite, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import type { Enemy, Hazard, Interactable, Pickup, Projectile } from '../sim/entities';
import { dashStrikeRange, slamRadius } from '../sim/enemies';
import type { WeaponId } from '../sim/weapons';
import { TILE_SIZE } from '../sim/tiles';
import type { World } from '../sim/world';
import { fxTextures } from './fxArt';
import { BIOME_ART, hex } from './palette';
import { mirrorSheet, type ActorSheet, type Animation, type SpriteLibrary } from './sheets';

interface ActorSprite {
  root: Container;
  body: AnimatedSprite;
  /** Add-blended copy of the body for hit flashes. */
  flash: AnimatedSprite;
  shadow: Graphics;
  current: Animation | undefined;
  baseScale: number;
}

interface Tracked {
  root: Container;
  seen: boolean;
}

const PLAYER_COLOR = 0x6fe7ff;
const ENEMY_SHOT_COLOR = 0xff5a7a;
const TELEGRAPH_COLOR = 0xff3b3b;

function makeShadow(width: number): Graphics {
  return new Graphics().ellipse(0, 0, width, width * 0.38).fill({ color: 0x000000, alpha: 0.38 });
}

function makeActor(sheet: ActorSheet, displayHeight: number): ActorSprite {
  const root = new Container();
  const shadow = makeShadow(displayHeight * 0.28);
  const body = new AnimatedSprite(sheet.idle.frames);
  body.anchor.set(sheet.originX, sheet.originY);
  const flash = new AnimatedSprite(sheet.idle.frames);
  flash.anchor.set(sheet.originX, sheet.originY);
  flash.blendMode = 'add';
  flash.alpha = 0;
  root.addChild(shadow, body, flash);
  const baseScale = displayHeight / sheet.frameHeight;
  return { root, body, flash, shadow, current: undefined, baseScale };
}

function play(actor: ActorSprite, anim: Animation): void {
  if (actor.current === anim) return;
  actor.current = anim;
  for (const s of [actor.body, actor.flash]) {
    s.textures = anim.frames;
    s.animationSpeed = anim.fps / 60;
    s.loop = anim.loop;
    s.gotoAndPlay(0);
  }
}

/** Which prop sheet (and glow) an interactable uses. */
function interactableLook(it: Interactable): { prop: string; size: number; glow: number } {
  if (it.kind === 'chest') return { prop: 'memory_chest', size: 64, glow: 0xffd98a };
  if (it.kind === 'lever') return { prop: 'lever', size: 48, glow: 0x9fd8ff };
  if (it.kind === 'shrine') return { prop: 'shrine', size: 76, glow: 0xffd98a };
  if (it.kind === 'archive') return { prop: 'furn_shelf', size: 70, glow: 0xb8a4ff };
  if (it.kind === 'merchant') return { prop: 'npc_smith', size: 58, glow: 0xffb060 };
  if (it.kind === 'gate') return { prop: 'ruins_door', size: 168, glow: 0xffd98a };
  // The doorway back out to the Sanctuary hub.
  if (it.kind === 'door') return { prop: 'ruins_door', size: 84, glow: 0xffd98a };
  if (it.kind === 'npc') {
    const NPC_PROPS: Record<string, string> = {
      archivist: 'npc_archivist',
      smith: 'npc_smith',
      gardener: 'npc_gardener',
      warden: 'npc_warden',
      lamplighter: 'npc_lamplighter',
    };
    return { prop: NPC_PROPS[it.npcId ?? ''] ?? 'npc_smith', size: 58, glow: 0x9df3ff };
  }
  if (it.kind === 'structure') {
    // Every restored station has its own silhouette, so the hall reads as a
    // rebuilt place rather than ten copies of the same plinth.
    const STATION_PROPS: Record<string, string> = {
      hearth: 'station_hearth',
      armory: 'station_armory',
      infirmary: 'station_infirmary',
      wellspring: 'station_wellspring',
      watchtower: 'station_watchtower',
      bulwark: 'station_bulwark',
      vault: 'station_vault',
      training: 'station_training',
      meditation: 'station_meditation',
      noticeboard: 'station_notice',
    };
    const prop = STATION_PROPS[it.structureId ?? ''] ?? 'memory_fountain';
    const size = it.structureId === 'watchtower' ? 84 : it.structureId === 'vault' ? 80 : 76;
    return { prop, size, glow: 0xffd98a };
  }
  return { prop: 'memory_fountain', size: 78, glow: 0x6fe7ff };
}

export class ActorView {
  /** Under actors: telegraphs, glows, interactables. */
  readonly ground = new Container();
  /** Actors, depth-sorted by feet position. */
  readonly actors = new Container();
  /** Over actors: projectiles and health bars. */
  readonly overlay = new Container();

  private readonly bossAuras = new Graphics();
  private readonly telegraphs = new Graphics();
  private readonly hazardsG = new Graphics();
  private readonly bars = new Graphics();
  private readonly afterimages: Array<{ sprite: Sprite; age: number; life: number }> = [];
  private dashGhostTimer = 0;
  private readonly player: ActorSprite;
  private readonly playerLight: Sprite;
  private readonly enemies = new Map<number, ActorSprite>();
  private readonly projectiles = new Map<number, Tracked>();
  private readonly pickups = new Map<number, Tracked>();
  private readonly interactables = new Map<number, Tracked>();
  private readonly previous = new Map<number, { x: number; y: number }>();
  private previousPlayer = { x: 0, y: 0 };
  private readonly accent: number;
  private readonly labels: Array<{ text: Text; x: number; y: number }> = [];
  private labelsEnabled = true;
  private time = 0;
  /** The player's own strips, cut for the stance the mirror should copy. */
  private mirrorCache: { weapon: WeaponId; sheet: ActorSheet } | undefined;
  /** Per-mob copies, frozen to the stance each hollow self spawned with. */
  private readonly mobSheets = new Map<number, ActorSheet>();

  constructor(
    private readonly sprites: SpriteLibrary,
    private readonly world: World
  ) {
    this.actors.sortableChildren = true;
    this.accent = hex(BIOME_ART[world.plan.biome].accent);
    this.ground.addChild(this.bossAuras, this.telegraphs, this.hazardsG);
    this.player = makeActor(sprites.player, 56);
    this.actors.addChild(this.player.root);
    this.addDecor();
    this.playerLight = this.glow(PLAYER_COLOR, 260, 0.16);
    this.ground.addChild(this.playerLight);
    this.overlay.addChild(this.bars);
    this.capture();
  }

  /** Static furniture in the Sanctuary; no interaction, just a lived-in hall. */
  private addDecor(): void {
    const props = this.sprites.props as unknown as Record<string, Texture>;
    for (const item of this.world.decor) {
      const texture = props[item.prop];
      if (!texture) continue;
      const sprite = new Sprite(texture);
      if (item.layer === 'ground') {
        // Rugs sit on the floor beneath actors and telegraphs.
        sprite.anchor.set(0.5);
        sprite.width = sprite.height = item.size;
        sprite.position.set(item.x, item.y);
        this.ground.addChildAt(sprite, 0);
        continue;
      }
      sprite.anchor.set(0.5, 0.86);
      sprite.width = sprite.height = item.size;
      sprite.position.set(item.x, item.y + 4);
      sprite.zIndex = item.y;
      this.actors.addChild(sprite);
      if (item.prop === 'furn_lantern') {
        const glow = this.glow(0xffd98a, 110, 0.22);
        glow.position.set(item.x, item.y - 28);
        this.ground.addChild(glow);
      }
    }
  }

  /** Records positions before a sim step, for interpolation. */
  capture(): void {
    const p = this.world.player;
    this.previousPlayer = { x: p.x, y: p.y };
    for (const e of this.world.enemies) this.previous.set(e.id, { x: e.x, y: e.y });
    for (const b of this.world.projectiles) this.previous.set(b.id, { x: b.x, y: b.y });
  }

  /** Interpolated player position, also used by the camera. */
  playerPosition(alpha: number): { x: number; y: number } {
    const p = this.world.player;
    const prev = this.previousPlayer;
    return { x: prev.x + (p.x - prev.x) * alpha, y: prev.y + (p.y - prev.y) * alpha };
  }

  private lerp(id: number, x: number, y: number, alpha: number): { x: number; y: number } {
    const prev = this.previous.get(id);
    if (!prev) return { x, y };
    return { x: prev.x + (x - prev.x) * alpha, y: prev.y + (y - prev.y) * alpha };
  }

  private glow(color: number, size: number, alpha: number): Sprite {
    const s = new Sprite(fxTextures().glow);
    s.anchor.set(0.5);
    s.width = s.height = size;
    s.tint = color;
    s.alpha = alpha;
    s.blendMode = 'add';
    return s;
  }

  /**
   * @param view world-space camera rect; hazards outside it are skipped, since
   * only a handful of props can be on screen and the rest cost tessellation.
   */
  update(dt: number, alpha: number, view?: { x: number; y: number; w: number; h: number }): void {
    this.time += dt;
    this.bossAuras.clear();
    this.telegraphs.clear();
    this.hazardsG.clear();
    this.bars.clear();
    this.updateAfterimages(dt);
    this.drawHazards(view);
    this.drawGateWarnings();
    this.drawBlasts();
    this.drawBombs();
    this.updateLabels();
    this.updatePlayer(dt, alpha);
    this.syncEnemies(dt, alpha);
    this.syncProjectiles(alpha);
    this.syncPickups();
    this.syncInteractables();
  }

  private updateAfterimages(dt: number): void {
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const g = this.afterimages[i];
      g.age += dt;
      if (g.age >= g.life) {
        g.sprite.destroy();
        this.afterimages.splice(i, 1);
        continue;
      }
      g.sprite.alpha = 0.55 * (1 - g.age / g.life);
    }
  }

  private updatePlayer(dt: number, alpha: number): void {
    const p = this.world.player;
    const a = this.player;
    const sheet = this.sprites.player;
    const pos = this.playerPosition(alpha);
    a.root.position.set(pos.x, pos.y);
    a.root.zIndex = pos.y;

    // Lantern light flares during dash or flow surge, subtly tinted by the wielded stance
    const surge = p.action === 'dash' ? 1.25 : 1 + Math.min(0.25, (p.resonance / 10) * 0.25);
    this.playerLight.position.set(pos.x, pos.y);
    this.playerLight.width = this.playerLight.height = 260 * surge;
    this.playerLight.alpha = 0.16 * surge;
    this.playerLight.tint =
      p.weapon === 'spear' ? 0xa8f6ff : p.weapon === 'greatsword' ? 0xffdfb0 : 0xffffff;

    const attackAnim =
      p.weapon === 'spear'
        ? (sheet.attackSpear ?? sheet.attack)
        : p.weapon === 'greatsword'
          ? (sheet.attackGreatsword ?? sheet.attack)
          : sheet.attack;
    const idleAnim =
      p.weapon === 'spear'
        ? (sheet.idleSpear ?? sheet.idle)
        : p.weapon === 'greatsword'
          ? (sheet.idleGreatsword ?? sheet.idle)
          : sheet.idle;
    const walkAnim =
      p.weapon === 'spear'
        ? (sheet.walkSpear ?? sheet.walk)
        : p.weapon === 'greatsword'
          ? (sheet.walkGreatsword ?? sheet.walk)
          : sheet.walk;
    const anim =
      p.action === 'dash'
        ? sheet.dash!
        : p.action === 'attack'
          ? attackAnim
          : p.action === 'move'
            ? walkAnim
            : idleAnim;
    if (p.action === 'attack' && a.current === attackAnim && p.swingTime < 0.02)
      a.current = undefined;
    play(a, anim);

    // Dashing ghost afterimages
    if (p.action === 'dash') {
      this.dashGhostTimer -= dt;
      if (this.dashGhostTimer <= 0) {
        this.dashGhostTimer = 0.04;
        const ghost = new Sprite(a.body.texture);
        ghost.anchor.copyFrom(a.body.anchor);
        ghost.position.set(pos.x, pos.y);
        ghost.scale.copyFrom(a.body.scale);
        ghost.tint = 0x6fe7ff;
        ghost.blendMode = 'add';
        ghost.alpha = 0.55;
        ghost.zIndex = pos.y - 1;
        this.actors.addChild(ghost);
        this.afterimages.push({ sprite: ghost, age: 0, life: 0.22 });
      }
    } else {
      this.dashGhostTimer = 0;
    }

    // Dynamic movement lean and idle breathing
    const moving = p.action === 'move';
    const lean = moving ? (pos.x - this.previousPlayer.x) * 0.03 : 0;
    a.body.rotation = Math.max(-0.15, Math.min(0.15, lean));
    a.flash.rotation = a.body.rotation;

    const breathe = p.action === 'idle' ? 1 + Math.sin(this.time * 3.5) * 0.025 : 1;
    const facing = Math.cos(p.aim) < 0 ? -1 : 1;
    const squash = (p.action === 'dash' ? 0.88 : 1) * breathe;
    a.body.scale.set((a.baseScale * facing) / squash, a.baseScale * squash);
    a.flash.scale.copyFrom(a.body.scale);
    a.flash.textures = a.body.textures;
    a.flash.currentFrame = a.body.currentFrame;
    // Hurt flash, then a blink while invulnerable.
    a.flash.alpha = p.hurtFlash > 0 ? 0.8 : 0;
    a.flash.tint = 0xff4040;
    const blinking =
      p.invulnerable > 0 && p.action !== 'dash' && Math.floor(this.time * 20) % 2 === 0;
    a.body.alpha =
      p.action === 'dead'
        ? Math.max(0.15, a.body.alpha - 0.02)
        : blinking
          ? 0.45
          : p.action === 'dash'
            ? 0.7
            : 1;
  }

  private syncEnemies(dt: number, alpha: number): void {
    const alive = new Set<number>();
    for (const e of this.world.enemies) {
      alive.add(e.id);
      let actor = this.enemies.get(e.id);
      if (!actor) {
        const sheet = this.enemySheet(e);
        actor = makeActor(sheet, e.def.displayHeight * (e.elite ? 1.15 : 1));
        if (e.def.tint !== undefined) actor.body.tint = e.def.tint;
        if (e.elite) actor.root.addChildAt(this.glow(0xffc84a, e.radius * 5, 0.35), 0);
        this.enemies.set(e.id, actor);
        this.actors.addChild(actor.root);
      }
      this.drawEnemy(e, actor, dt, alpha);
    }
    for (const [id, actor] of this.enemies) {
      if (alive.has(id)) continue;
      actor.root.destroy({ children: true });
      this.enemies.delete(id);
      this.previous.delete(id);
      this.mobSheets.delete(id);
    }
  }

  /** Sprites per enemy; the mirror copy is cut from the player's live stance. */
  private enemySheet(e: Enemy): ActorSheet {
    if (e.def.sprite !== 'mirror')
      return this.sprites.enemies[e.def.sprite] ?? this.sprites.enemies.scavenger;
    const weapon = this.world.player.weapon;
    // A hollow self keeps the stance it copied when it appeared, so switching
    // weapons mid-fight does not pop its animation frames.
    if (!e.isBoss) {
      let sheet = this.mobSheets.get(e.id);
      if (!sheet) {
        sheet = mirrorSheet(this.sprites.player, weapon);
        this.mobSheets.set(e.id, sheet);
      }
      return sheet;
    }
    // The Waking Mirror follows the live stance: that is its whole trick.
    if (this.mirrorCache?.weapon !== weapon)
      this.mirrorCache = { weapon, sheet: mirrorSheet(this.sprites.player, weapon) };
    return this.mirrorCache.sheet;
  }

  private drawEnemy(e: Enemy, a: ActorSprite, _dt: number, alpha: number): void {
    const sheet = this.enemySheet(e);
    const pos = this.lerp(e.id, e.x, e.y, alpha);
    a.root.position.set(pos.x, pos.y);
    a.root.zIndex = pos.y;

    const moving = e.state === 'chase';
    const anim =
      e.state === 'dying'
        ? sheet.death
        : e.state === 'windup' || e.state === 'attack'
          ? sheet.attack
          : moving
            ? sheet.walk
            : sheet.idle;
    play(a, anim);
    const facing = this.world.player.x < e.x ? -1 : 1;
    const bob = moving ? Math.abs(Math.sin(this.time * 9 + e.id)) * 0.06 : 0;
    // Windup: crouch and tremble; spawning: grow in; attack: lunging stretch.
    const windup = e.state === 'windup';
    const attacking = e.state === 'attack';
    // A forward pop over the first 0.28 s of the active phase. Clamped, so a
    // long attack (sweep, beam) never reverse-stretches halfway through.
    const lunge = attacking
      ? Math.sin(Math.max(0, Math.min(1, 1 - e.stateTime / 0.28)) * Math.PI) * 0.14
      : 0;
    const tremble = windup ? Math.sin(this.time * 60) * 1.2 : 0;
    const grow = e.state === 'spawning' ? Math.max(0.1, 1 - e.stateTime / 0.7) : 1;
    a.body.scale.set(
      a.baseScale * facing * grow * (windup ? 1.08 : 1 + lunge * 0.5),
      a.baseScale * grow * (1 + bob) * (windup ? 0.92 : 1 - lunge * 0.2)
    );
    // Kinetic knockback recoil tilt away from the impact vector
    const knockSpeed = Math.abs(e.knockX) + Math.abs(e.knockY);
    const knockLean = knockSpeed > 2 ? e.knockX * 0.0018 * facing : 0;
    a.body.rotation = Math.max(-0.24, Math.min(0.24, knockLean));
    a.flash.rotation = a.body.rotation;
    const deathProgress = e.state === 'dying' ? Math.max(0, 1 - e.stateTime / 0.5) : 0;
    a.body.x = tremble;
    a.body.y = -deathProgress * 8;
    a.body.tint = e.state === 'dying' ? 0xc8c0dc : (e.def.tint ?? 0xffffff);
    a.flash.scale.copyFrom(a.body.scale);
    a.flash.x = a.body.x;
    a.flash.y = a.body.y;
    a.flash.textures = a.body.textures;
    a.flash.currentFrame = a.body.currentFrame;
    a.flash.tint = windup ? 0xff6a3a : 0xffffff;
    a.flash.alpha = e.flash > 0 ? 0.9 : windup ? 0.25 + 0.25 * Math.sin(this.time * 30) : 0;
    a.body.alpha =
      e.state === 'spawning' ? grow : e.state === 'dying' ? Math.max(0, e.stateTime / 0.5) : 1;
    a.shadow.alpha = a.body.alpha;

    if (e.isBoss && e.state !== 'dying') this.drawBossAura(e, pos.x, pos.y);
    if (e.elite && e.state !== 'dying') {
      this.drawEliteCrown(e, pos.x, pos.y);
      this.drawEliteAura(e, pos.x, pos.y);
    }
    if (e.state === 'spawning') this.drawSpawnRune(e, pos.x, pos.y);
    if (e.state === 'windup') this.drawTelegraph(e, pos.x, pos.y);
    else if (e.state === 'attack' && e.attack === 'sweep') this.drawSweepBeam(e, pos.x, pos.y);
    if (!e.isBoss && e.health < e.maxHealth && e.state !== 'dying')
      this.drawHealthBar(e, pos.x, pos.y);
  }

  /** Rotating runic aura beneath bosses that intensifies across phase transitions. */
  private drawBossAura(e: Enemy, x: number, y: number): void {
    const g = this.bossAuras;
    const hpFrac = e.maxHealth > 0 ? e.health / e.maxHealth : 1;
    const phase = hpFrac < 0.33 ? 3 : hpFrac < 0.66 ? 2 : 1;
    const speed = phase === 3 ? 3.4 : phase === 2 ? 2.2 : 1.2;
    const angle = this.time * speed;
    const radius = e.radius * 2.2;
    // The mirror keeps the player's cyan until it starts to lose its shape.
    const mirror = e.def.id === 'mirror_self';
    const color = mirror
      ? phase === 3
        ? 0xff5aa8
        : phase === 2
          ? 0x9e8cff
          : 0x6fe7ff
      : phase === 3
        ? 0xff3b3b
        : phase === 2
          ? 0xff7a3a
          : 0xb86cff;
    const alpha = (phase === 3 ? 0.65 : phase === 2 ? 0.45 : 0.3) + 0.1 * Math.sin(this.time * 6);

    // Outer and inner concentric runic bands
    g.circle(x, y, radius).stroke({ width: 2, color, alpha });
    g.circle(x, y, radius * 0.72).stroke({ width: 1.5, color, alpha: alpha * 0.7 });

    // Radial notches / spokes
    const count = phase === 3 ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const a = angle + (i * Math.PI * 2) / count;
      g.moveTo(x + Math.cos(a) * (radius * 0.72), y + Math.sin(a) * (radius * 0.72))
        .lineTo(x + Math.cos(a) * (radius + 4), y + Math.sin(a) * (radius + 4))
        .stroke({ width: 1.5, color, alpha });
    }

    // Outer orbital glyphs
    for (let i = 0; i < 4; i++) {
      const a = -angle * 1.5 + (i * Math.PI) / 2;
      const gx = x + Math.cos(a) * (radius + 8);
      const gy = y + Math.sin(a) * (radius + 8);
      g.circle(gx, gy, 3).fill({ color: 0xffffff, alpha: alpha * 0.9 });
    }
  }

  /** Golden crest above elite enemies. */
  private drawEliteCrown(e: Enemy, x: number, y: number): void {
    const g = this.bars;
    const top = y - e.def.displayHeight * 0.95 - 14;
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 4 + e.id);
    // 3-peak golden crown
    g.moveTo(x - 8, top + 6)
      .lineTo(x - 10, top - 2)
      .lineTo(x - 4, top + 2)
      .lineTo(x, top - 6)
      .lineTo(x + 4, top + 2)
      .lineTo(x + 10, top - 2)
      .lineTo(x + 8, top + 6)
      .closePath()
      .fill({ color: 0xffd98a, alpha: pulse })
      .stroke({ width: 1.2, color: 0xffffff, alpha: pulse });
  }

  /** Amber ward sigil beneath elite enemies. */
  private drawEliteAura(e: Enemy, x: number, y: number): void {
    const g = this.bossAuras;
    const pulse = 0.35 + 0.18 * Math.sin(this.time * 3.5 + e.id);
    const r = e.radius * 1.5;
    g.circle(x, y, r).stroke({ width: 1.5, color: 0xffb84a, alpha: pulse });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + this.time * 0.8;
      g.circle(x + Math.cos(a) * r, y + Math.sin(a) * r, 2.5).fill({
        color: 0xffd98a,
        alpha: pulse * 1.3,
      });
    }
  }

  /**
   * Iron gates of a room that still owes waves pulse crimson, so the player can
   * read where reinforcements will pour in and hold the right angle.
   */
  private drawGateWarnings(): void {
    const g = this.telegraphs;
    const t = this.time;
    for (const room of this.world.floor.rooms) {
      if (!room.gates || room.gates.length === 0) continue;
      const state = this.world.rooms[room.id];
      if (!state || state.phase !== 'active' || state.wavesLeft <= 0) continue;
      const pulse = 0.3 + 0.28 * Math.sin(t * 5.5 + room.id);
      for (const gate of room.gates)
        for (const tile of gate.tiles) {
          g.rect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE).stroke({
            width: 2,
            color: 0xff5a3a,
            alpha: pulse,
          });
        }
    }
  }

  /** Traps, poison pools and breakables, under the actors. */
  private drawHazards(view?: { x: number; y: number; w: number; h: number }): void {
    const g = this.hazardsG;
    const t = this.time;
    const margin = 96;
    for (const h of this.world.hazards) {
      if (
        view &&
        (h.x < view.x - margin ||
          h.x > view.x + view.w + margin ||
          h.y < view.y - margin ||
          h.y > view.y + view.h + margin)
      )
        continue;
      if (h.disabled) {
        g.circle(h.x, h.y, h.radius * 0.5).stroke({ width: 1, color: 0x555566, alpha: 0.4 });
        continue;
      }
      if (h.kind === 'trap') {
        const armed = h.timer <= 0;
        g.circle(h.x, h.y, h.radius * 0.8).stroke({
          width: 2,
          color: 0xffd98a,
          alpha: armed ? 0.55 + 0.25 * Math.sin(t * 5) : 0.25,
        });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + t * 0.6;
          g.moveTo(h.x + Math.cos(a) * 8, h.y + Math.sin(a) * 8)
            .lineTo(h.x + Math.cos(a) * 20, h.y + Math.sin(a) * 20)
            .stroke({ width: 2, color: 0xffb060, alpha: armed ? 0.8 : 0.35 });
        }
        continue;
      }
      // A blast has lit this prop: a fast hot pulse reads as a burning fuse.
      if (h.ignite !== undefined && h.ignite > 0) {
        const fuse = Math.min(1, 1 - h.ignite / 0.42);
        g.circle(h.x, h.y, h.radius + 5 + fuse * 4).stroke({
          width: 2,
          color: 0xffb060,
          alpha: 0.55 + 0.35 * Math.sin(t * 34 + h.id),
        });
        g.circle(h.x, h.y - h.radius * 0.4, 3 + fuse * 3).fill({
          color: 0xfff0b0,
          alpha: 0.5 + 0.4 * Math.sin(t * 26 + h.id),
        });
      }
      if (h.kind === 'barrel') {
        this.drawBarrel(g, h, t);
        continue;
      }
      if (h.kind === 'crate') {
        this.drawCrate(g, h);
        continue;
      }
      if (h.kind === 'urn') {
        this.drawUrn(g, h);
        continue;
      }
      if (h.kind === 'crystal') {
        this.drawCrystal(g, h, t);
        continue;
      }
      const warning = h.phase === 'warning';
      const active = h.phase === 'active';
      const pulse = 0.35 + 0.25 * Math.sin(t * 6 + h.id);
      if (h.kind === 'poison') {
        g.circle(h.x, h.y, h.radius).fill({ color: 0x7ad06a, alpha: 0.22 });
        g.circle(h.x, h.y, h.radius).stroke({ width: 2, color: 0xaef090, alpha: pulse });
        for (let i = 0; i < 3; i++) {
          const a = t * 0.8 + i * 2.1;
          g.circle(h.x + Math.cos(a) * h.radius * 0.5, h.y + Math.sin(a) * h.radius * 0.4, 3).fill({
            color: 0xc8ff9a,
            alpha: 0.6,
          });
        }
      } else if (h.kind === 'spike') {
        g.circle(h.x, h.y, h.radius).fill({
          color: 0xff3b3b,
          alpha: (warning ? 0.22 : active ? 0.1 : 0.05) + pulse * 0.08,
        });
        if (warning) g.circle(h.x, h.y, h.radius).stroke({ width: 2, color: 0xff6a6a, alpha: 0.8 });
        if (active) {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const x = h.x + Math.cos(a) * h.radius * 0.6;
            const y = h.y + Math.sin(a) * h.radius * 0.6;
            g.moveTo(x - 5, y + 6)
              .lineTo(x, y - 12)
              .lineTo(x + 5, y + 6)
              .closePath()
              .fill({
                color: 0xd8d8f0,
                alpha: 0.9,
              });
          }
        }
      } else if (h.kind === 'flame') {
        g.circle(h.x, h.y, h.radius).fill({ color: 0xff6a2a, alpha: warning ? 0.24 : 0.08 });
        if (warning) g.circle(h.x, h.y, h.radius).stroke({ width: 2, color: 0xffa060, alpha: 0.9 });
        if (active) {
          g.circle(h.x, h.y, h.radius * 0.7).fill({ color: 0xffa040, alpha: 0.55 });
          g.circle(h.x, h.y, h.radius * 0.4).fill({ color: 0xffe0a0, alpha: 0.75 });
        }
      } else {
        // Rockfall: a shadow crosshair tightens just before the stones land.
        const k = warning ? 1 - Math.max(0, h.timer) / 0.7 : 1;
        g.circle(h.x, h.y, h.radius * (0.4 + k * 0.6)).stroke({
          width: 2,
          color: 0xffb060,
          alpha: 0.7,
        });
        if (warning)
          g.moveTo(h.x, h.y - 90)
            .lineTo(h.x, h.y)
            .stroke({ width: 3, color: 0xffa060, alpha: 0.5 });
      }
    }
  }

  /** A staved barrel with iron hoops, a dark open head and a faint rim pulse. */
  private drawBarrel(g: Graphics, h: Hazard, t: number): void {
    const { x, y } = this.shaken(h);
    g.ellipse(x, y + 11, 14, 5).fill({ color: 0x000000, alpha: 0.35 });
    g.ellipse(x, y, 14, 12).fill({ color: 0x8a5a2a });
    g.ellipse(x, y, 14, 12).stroke({ width: 1.5, color: 0x4a2e16 });
    for (let i = -2; i <= 2; i++) {
      const sx = x + i * 5.4;
      g.moveTo(sx, y - 9)
        .lineTo(sx, y + 9)
        .stroke({ width: 1, color: 0x5e3d1e, alpha: 0.55 });
    }
    g.ellipse(x, y - 5, 14, 4).stroke({ width: 2.5, color: 0x6a5a48, alpha: 0.95 });
    g.ellipse(x, y + 5, 14, 4).stroke({ width: 2.5, color: 0x52443a, alpha: 0.95 });
    for (const bx of [-8, 0, 8]) {
      g.circle(x + bx, y - 5, 0.9).fill({ color: 0x221a14 });
      g.circle(x + bx, y + 5, 0.9).fill({ color: 0x221a14 });
    }
    g.ellipse(x, y - 7, 9, 4).fill({ color: 0x33200f });
    g.ellipse(x, y - 7, 9, 4).stroke({
      width: 1,
      color: 0xffc080,
      alpha: 0.35 + 0.12 * Math.sin(t * 4 + h.id),
    });
    g.arc(x - 4, y - 3, 8, Math.PI * 1.05, Math.PI * 1.45).stroke({
      width: 1.5,
      color: 0xd8a060,
      alpha: 0.4,
    });
    this.drawBreakDamage(g, h, 0xffa040, x, y);
  }

  /** A banded supply crate: plank seams, iron corners and a stamped memory mark. */
  private drawCrate(g: Graphics, h: Hazard): void {
    const { x, y } = this.shaken(h);
    g.ellipse(x, y + 12, 15, 5).fill({ color: 0x000000, alpha: 0.35 });
    g.rect(x - 13, y - 11, 26, 22).fill({ color: 0x8a6236 });
    g.rect(x - 13, y - 11, 26, 22).stroke({ width: 1.5, color: 0x452a12 });
    for (const sy of [-4, 3]) {
      g.moveTo(x - 12, y + sy)
        .lineTo(x + 12, y + sy)
        .stroke({ width: 1, color: 0x5e3f20, alpha: 0.8 });
    }
    g.rect(x - 13, y - 11, 26, 3).fill({ color: 0xb98a52, alpha: 0.8 });
    g.moveTo(x - 10, y + 8)
      .lineTo(x + 10, y - 8)
      .stroke({ width: 2.5, color: 0x6c4a28, alpha: 0.9 });
    for (const [ox, oy] of [
      [-13, -11],
      [7, -11],
      [-13, 5],
      [7, 5],
    ]) {
      g.rect(x + ox, y + oy, 6, 6).fill({ color: 0x7a7a86 });
      g.rect(x + ox, y + oy, 6, 6).stroke({ width: 1, color: 0x3a3a44 });
      g.circle(x + ox + 3, y + oy + 3, 1).fill({ color: 0xc8c8d2 });
    }
    g.poly([x, y - 3, x + 4, y + 1, x, y + 5, x - 4, y + 1]).stroke({
      width: 1,
      color: 0xffd98a,
      alpha: 0.5,
    });
    this.drawBreakDamage(g, h, 0xffb060, x, y);
  }

  /** A terracotta urn with a gilded band and a lipful of old dust. */
  private drawUrn(g: Graphics, h: Hazard): void {
    const { x, y } = this.shaken(h);
    g.ellipse(x, y + 13, 11, 4).fill({ color: 0x000000, alpha: 0.35 });
    g.ellipse(x, y + 2, 11, 13).fill({ color: 0xb06a48 });
    g.ellipse(x, y + 2, 11, 13).stroke({ width: 1.5, color: 0x5e3320 });
    g.rect(x - 4, y - 13, 8, 8).fill({ color: 0xa05e40 });
    g.ellipse(x, y - 13, 7, 3).fill({ color: 0x7a4028 });
    g.ellipse(x, y - 13, 7, 3).stroke({ width: 1, color: 0xd89a70, alpha: 0.7 });
    g.ellipse(x, y - 2, 11, 3.5).stroke({ width: 2, color: 0xffd98a, alpha: 0.75 });
    g.ellipse(x, y - 6, 8, 2.5).stroke({ width: 1, color: 0xffe6a8, alpha: 0.6 });
    g.circle(x - 10, y - 4, 3).stroke({ width: 1.5, color: 0x8a4a32 });
    g.circle(x + 10, y - 4, 3).stroke({ width: 1.5, color: 0x8a4a32 });
    g.circle(x - 4, y, 3).fill({ color: 0xe8b090, alpha: 0.28 });
    this.drawBreakDamage(g, h, 0xffc890, x, y);
  }

  /** A memory crystal cluster: violet facets, a lit core and orbiting motes. */
  private drawCrystal(g: Graphics, h: Hazard, t: number): void {
    const { x, y } = this.shaken(h);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + h.id);
    g.ellipse(x, y + 11, 15, 5).fill({ color: 0x000000, alpha: 0.32 });
    g.circle(x, y + 9, 15).fill({ color: 0xb89cff, alpha: 0.08 + pulse * 0.06 });
    g.poly([x - 13, y + 3, x - 7, y - 10, x - 4, y + 8]).fill({ color: 0x5a44a0 });
    g.poly([x + 14, y + 5, x + 9, y - 6, x + 5, y + 8]).fill({ color: 0x6a52b0 });
    g.poly([x, y - 24, x + 7, y - 8, x + 4, y + 10, x - 5, y + 8, x - 7, y - 6]).fill({
      color: 0x7a5ec8,
    });
    g.poly([x, y - 24, x + 7, y - 8, x + 1, y - 1]).fill({ color: 0xd8c8ff, alpha: 0.9 });
    g.poly([x, y - 16, x + 3, y - 6, x, y + 2, x - 3, y - 6]).fill({
      color: 0xffffff,
      alpha: 0.45 + pulse * 0.35,
    });
    g.poly([x, y - 24, x + 7, y - 8, x + 4, y + 10, x - 5, y + 8, x - 7, y - 6]).stroke({
      width: 1,
      color: 0xe8dcff,
      alpha: 0.75,
    });
    g.circle(x, y - 4, 4 + pulse * 2).fill({ color: 0xfff0ff, alpha: 0.3 + pulse * 0.2 });
    for (let i = 0; i < 3; i++) {
      const a = t * 0.7 + (i / 3) * Math.PI * 2;
      g.circle(x + Math.cos(a) * 16, y - 6 + Math.sin(a) * 9, 1.6).fill({
        color: 0xd8c8ff,
        alpha: 0.35 + pulse * 0.35,
      });
    }
    this.drawBreakDamage(g, h, 0xb89cff, x, y);
  }

  /** A struck prop jitters briefly; the offset rides on the hazard's hit timer. */
  private shaken(h: Hazard): { x: number; y: number } {
    if (!h.hitFlash) return { x: h.x, y: h.y };
    const amp = h.hitFlash * 30;
    return {
      x: h.x + Math.sin(this.time * 110 + h.id) * amp,
      y: h.y + Math.cos(this.time * 90 + h.id * 1.7) * amp * 0.4,
    };
  }

  /** Cracks and a hot rim show a breakable has taken a hit. */
  private drawBreakDamage(g: Graphics, h: Hazard, accent: number, x: number, y: number): void {
    if (h.hp >= h.maxHp) return;
    const wear = 1 - h.hp / h.maxHp;
    g.arc(x, y, h.radius + 5, -Math.PI * 0.85, Math.PI * 0.15).stroke({
      width: 1.5,
      color: accent,
      alpha: 0.3 + wear * 0.5,
    });
    const base = (h.id * 2.399) % (Math.PI * 2);
    for (let i = 0; i < 3; i++) {
      const a = base + i * 2.1;
      const inner = h.radius * 0.15;
      const outer = h.radius * (0.55 + wear * 0.3);
      g.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner)
        .lineTo(x + Math.cos(a + 0.3) * outer, y + Math.sin(a + 0.3) * outer)
        .lineTo(x + Math.cos(a - 0.15) * outer * 0.8, y + Math.sin(a - 0.15) * outer * 0.8)
        .stroke({ width: 1, color: 0x1a1008, alpha: 0.45 + wear * 0.35 });
    }
  }

  private drawBlasts(): void {
    const g = this.hazardsG;
    for (const b of this.world.blasts) {
      const k = 1 - Math.min(1, Math.max(0, b.delay) / 0.7);
      g.circle(b.x, b.y, b.radius).fill({ color: 0xff5a3a, alpha: 0.1 + k * 0.2 });
      g.circle(b.x, b.y, b.radius).stroke({ width: 2, color: 0xff8a5a, alpha: 0.8 });
      g.circle(b.x, b.y, b.radius * k).fill({ color: 0xffb070, alpha: 0.25 });
    }
    for (const m of this.world.mines) {
      const armed = m.arm <= 0;
      const blink = 0.45 + 0.4 * Math.sin(this.time * 12 + m.id);
      g.circle(m.x, m.y, 9).fill({ color: 0x2a1010, alpha: 0.9 });
      g.circle(m.x, m.y, 9).stroke({ width: 2, color: armed ? 0xff4a4a : 0x886655, alpha: blink });
      g.circle(m.x, m.y, 3).fill({ color: armed ? 0xff8a6a : 0x665544, alpha: 0.9 });
    }
  }

  /** Bombs: a dark ball with a sparking fuse; the spark speeds up near zero. */
  private drawBombs(): void {
    const g = this.hazardsG;
    for (const b of this.world.bombs) {
      const urgency = Math.max(0, Math.min(1, 1 - b.fuse / 1.4));
      const blink = 0.4 + 0.6 * Math.abs(Math.sin(this.time * (6 + urgency * 18) + b.id));
      g.ellipse(b.x, b.y + 6, 13, 5).fill({ color: 0x000000, alpha: 0.35 });
      g.circle(b.x, b.y, 11).fill({ color: b.owner === 'player' ? 0x2b2a3a : 0x2a1717 });
      g.circle(b.x, b.y, 11).stroke({
        width: 2,
        color: b.owner === 'player' ? 0x9df3ff : 0xff7a6a,
        alpha: 0.85,
      });
      g.circle(b.x + 5, b.y - 12, 3).fill({ color: 0xffd98a, alpha: blink });
      g.circle(b.x, b.y, 7).fill({ color: 0xffa040, alpha: urgency * 0.25 });
    }
  }

  private drawSpawnRune(e: Enemy, x: number, y: number): void {
    const t = 1 - e.stateTime / 0.7;
    this.telegraphs
      .circle(x, y, e.radius * 2.2 * (0.5 + t * 0.5))
      .stroke({ width: 2, color: this.accent, alpha: 0.8 * (1 - t * 0.5) });
    this.telegraphs.circle(x, y, e.radius * 1.2 * t).fill({ color: this.accent, alpha: 0.18 });
  }

  /** Warning shapes during an enemy's windup; they fill in as the attack nears. */
  private drawTelegraph(e: Enemy, x: number, y: number): void {
    const g = this.telegraphs;
    const angle = Math.atan2(e.dirY, e.dirX);
    const urgency = 0.25 + 0.45 * Math.min(1, 1 - e.stateTime / 0.8);
    switch (e.attack) {
      case 'strike': {
        const reach = e.def.attackRange + 14 + e.radius;
        g.moveTo(x, y)
          .arc(x, y, reach, angle - 0.95, angle + 0.95)
          .lineTo(x, y)
          .fill({ color: TELEGRAPH_COLOR, alpha: urgency * 0.45 });
        // Advancing arc contour as the swing readies
        const progressReach = reach * (0.3 + 0.7 * Math.min(1, 1 - e.stateTime / 0.8));
        g.arc(x, y, progressReach, angle - 0.95, angle + 0.95).stroke({
          width: 2,
          color: 0xffa070,
          alpha: urgency * 0.9,
        });
        break;
      }
      case 'combo': {
        // A player-style three-hit chain: the full arc plus its three lanes.
        const reach = e.def.attackRange + 18 + 12;
        g.moveTo(x, y)
          .arc(x, y, reach, angle - 1, angle + 1)
          .lineTo(x, y)
          .fill({ color: TELEGRAPH_COLOR, alpha: urgency * 0.38 });
        for (let i = 0; i < 3; i++) {
          const a = angle + (i - 1) * 0.4;
          g.moveTo(x + Math.cos(a - 0.9) * reach, y + Math.sin(a - 0.9) * reach)
            .arc(x, y, reach, a - 0.9, a + 0.9)
            .stroke({ width: 1.5, color: 0xffb0c8, alpha: urgency * (0.45 + i * 0.15) });
        }
        break;
      }
      case 'dashStrike': {
        // A committed closing lane: leave it sideways, not backward. The lane
        // matches the real travel distance so it never over-promises danger.
        const length = dashStrikeRange(e.def);
        const w = e.radius * 1.1;
        const nx = -e.dirY * w;
        const ny = e.dirX * w;
        const ex = x + e.dirX * length;
        const ey = y + e.dirY * length;
        g.poly([x + nx, y + ny, ex + nx, ey + ny, ex - nx, ey - ny, x - nx, y - ny]).fill({
          color: TELEGRAPH_COLOR,
          alpha: urgency * 0.34,
        });
        for (let i = 1; i <= 3; i++) {
          const px = x + e.dirX * (length / 3) * i;
          const py = y + e.dirY * (length / 3) * i;
          g.moveTo(px - nx * 0.7, py - ny * 0.7)
            .lineTo(px + e.dirX * 7, py + e.dirY * 7)
            .lineTo(px + nx * 0.7, py + ny * 0.7)
            .stroke({ width: 2, color: 0xffd0e0, alpha: urgency * 0.85 });
        }
        break;
      }
      case 'slam': {
        const r = slamRadius(e);
        g.circle(x, y, r).fill({ color: TELEGRAPH_COLOR, alpha: urgency * 0.35 });
        g.circle(x, y, r).stroke({ width: 2, color: TELEGRAPH_COLOR, alpha: 0.8 });
        // Expanding inner shockwave indicator ring
        const progressR = r * (0.2 + 0.8 * Math.min(1, 1 - e.stateTime / 0.8));
        g.circle(x, y, progressR).stroke({ width: 1.5, color: 0xffe0a0, alpha: urgency * 0.85 });
        break;
      }
      case 'lunge':
      case 'charge': {
        const length = e.attack === 'charge' ? 330 : 140;
        const w = e.radius * 1.6;
        const nx = -e.dirY * w;
        const ny = e.dirX * w;
        const ex = x + e.dirX * length;
        const ey = y + e.dirY * length;
        g.poly([x + nx, y + ny, ex + nx, ey + ny, ex - nx, ey - ny, x - nx, y - ny]).fill({
          color: TELEGRAPH_COLOR,
          alpha: urgency * 0.4,
        });
        g.poly([x + nx, y + ny, ex + nx, ey + ny, ex - nx, ey - ny, x - nx, y - ny]).stroke({
          width: 1.5,
          color: 0xffa070,
          alpha: urgency * 0.8,
        });
        break;
      }
      case 'shot':
      case 'spread':
      case 'volley':
      case 'bolt': {
        const offsets = e.attack === 'spread' ? [-0.32, 0, 0.32] : [0];
        for (const o of offsets) {
          g.moveTo(x, y)
            .lineTo(x + Math.cos(angle + o) * 260, y + Math.sin(angle + o) * 260)
            .stroke({
              width: e.attack === 'bolt' ? 1.5 : 2,
              color: TELEGRAPH_COLOR,
              alpha: urgency * 0.8,
            });
        }
        break;
      }
      case 'ring':
        g.circle(x, y, e.radius + 10 + (1 - e.stateTime) * 30).stroke({
          width: 3,
          color: TELEGRAPH_COLOR,
          alpha: urgency,
        });
        break;
      case 'summon':
        g.circle(x, y, 70).stroke({ width: 2, color: this.accent, alpha: urgency });
        break;
      case 'beam': {
        const length = 600;
        const width = e.isBoss ? 34 : 24;
        // Taper to nothing well before the far end: a lane leaving the screen
        // should read as "danger continues", not as a hard bright border.
        const segments = 8;
        for (let i = 0; i < segments; i++) {
          const a0 = (length / segments) * i;
          const a1 = (length / segments) * (i + 1);
          const fade = Math.pow(1 - i / segments, 1.7);
          g.moveTo(x + Math.cos(angle) * a0, y + Math.sin(angle) * a0)
            .lineTo(x + Math.cos(angle) * a1, y + Math.sin(angle) * a1)
            .stroke({
              width,
              color: TELEGRAPH_COLOR,
              alpha: urgency * 0.34 * fade,
            });
        }
        // The bright core stops early; beyond it only the soft lane remains.
        g.moveTo(x, y)
          .lineTo(x + Math.cos(angle) * length * 0.55, y + Math.sin(angle) * length * 0.55)
          .stroke({ width: 3, color: 0xffd0d0, alpha: urgency * 0.85 });
        break;
      }
      case 'mortar':
        g.circle(x, y, 46).stroke({ width: 2, color: TELEGRAPH_COLOR, alpha: urgency });
        g.circle(x, y, 16 + (1 - urgency) * 20).fill({ color: TELEGRAPH_COLOR, alpha: 0.3 });
        break;
      case 'mines': {
        // Mines land around the player, so the warning must too.
        const p = this.world.player;
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + this.time * 0.8;
          g.circle(p.x + Math.cos(a) * 56, p.y + Math.sin(a) * 56, 28).stroke({
            width: 2,
            color: 0xffb060,
            alpha: urgency,
          });
        }
        break;
      }
      case 'spiral': {
        // Warm danger ring with rotating spokes so it cannot be mistaken for
        // the player's cyan flow effects.
        const radius = e.radius + 24;
        g.circle(x, y, radius).stroke({ width: 3, color: 0xff8a5a, alpha: urgency });
        for (let i = 0; i < 6; i++) {
          const a = this.time * 4 + (i / 6) * Math.PI * 2;
          g.moveTo(x + Math.cos(a) * (radius + 6), y + Math.sin(a) * (radius + 6))
            .lineTo(x + Math.cos(a + 0.5) * (radius + 30), y + Math.sin(a + 0.5) * (radius + 30))
            .stroke({ width: 2, color: 0xffb060, alpha: urgency * 0.9 });
        }
        break;
      }
      case 'blink':
        g.circle(x + e.dirX * 58, y + e.dirY * 58, 86).stroke({
          width: 2,
          color: 0xbfa0ff,
          alpha: urgency,
        });
        break;
      case 'bomb':
        g.circle(x, y, 26).stroke({ width: 2, color: 0xffa060, alpha: urgency });
        break;
      case 'swarm':
        g.circle(x, y, 80).stroke({ width: 2, color: 0xffc070, alpha: urgency });
        break;
      case 'hook': {
        // A tether to the player, not a fixed eastward probe.
        const p = this.world.player;
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.hypot(dx, dy);
        const reach = Math.min(330, dist);
        const hx = x + (dx / (dist || 1)) * reach;
        const hy = y + (dy / (dist || 1)) * reach;
        g.moveTo(x, y).lineTo(hx, hy).stroke({ width: 3, color: 0xff8a8a, alpha: urgency });
        g.circle(hx, hy, 24).stroke({ width: 2, color: 0xffb060, alpha: urgency });
        break;
      }
      case 'quake': {
        // Four delayed eruptions in a line toward the player.
        for (let i = 1; i <= 4; i++) {
          g.circle(x + Math.cos(angle) * 62 * i, y + Math.sin(angle) * 62 * i, 38).stroke({
            width: 2,
            color: 0xff8a5a,
            alpha: urgency * (1 - i * 0.12),
          });
        }
        break;
      }
      case 'fan': {
        for (const o of [-0.5, -0.25, 0, 0.25, 0.5])
          g.moveTo(x, y)
            .lineTo(x + Math.cos(angle + o) * 280, y + Math.sin(angle + o) * 280)
            .stroke({ width: 3, color: 0xff7a5a, alpha: urgency * 0.7 });
        break;
      }
      case 'wall': {
        // A curtain across the lane, with a visible gap to dive through.
        const nx = Math.cos(angle + Math.PI / 2);
        const ny = Math.sin(angle + Math.PI / 2);
        const gap = e.id % 4;
        for (let i = 0; i < 6; i++) {
          if (i === gap || i === gap + 1) continue;
          const ox = x + nx * (-100 + i * 40);
          const oy = y + ny * (-100 + i * 40);
          g.moveTo(ox, oy)
            .lineTo(ox + Math.cos(angle) * 90, oy + Math.sin(angle) * 90)
            .stroke({ width: 10, color: 0xff8a5a, alpha: urgency * 0.35 });
        }
        g.moveTo(x + nx * 40, y + ny * 40)
          .lineTo(x + nx * 80, y + ny * 80)
          .stroke({ width: 2, color: 0x9df3ff, alpha: urgency * 0.8 });
        break;
      }
      case 'pillars': {
        for (let i = 1; i <= 5; i++) {
          const side = i % 2 === 0 ? 44 : -44;
          g.circle(
            x + Math.cos(angle) * 58 * i + Math.cos(angle + Math.PI / 2) * side,
            y + Math.sin(angle) * 58 * i + Math.sin(angle + Math.PI / 2) * side,
            36
          ).stroke({ width: 2, color: 0xff9a5a, alpha: urgency * (1 - i * 0.1) });
        }
        break;
      }
      case 'sweep': {
        const span = 1.8;
        const radius = 220;
        g.moveTo(x, y)
          .arc(x, y, radius, angle - span / 2, angle + span / 2)
          .lineTo(x, y)
          .fill({ color: 0xff6a4a, alpha: urgency * 0.22 });
        g.moveTo(x + Math.cos(angle - span / 2) * radius, y + Math.sin(angle - span / 2) * radius)
          .arc(x, y, radius, angle - span / 2, angle + span / 2)
          .stroke({ width: 3, color: 0xffb060, alpha: urgency });
        break;
      }
    }
  }

  /** The live rotating beam while a sweep resolves. */
  private drawSweepBeam(e: Enemy, x: number, y: number): void {
    const span = 1.8;
    const base = Math.atan2(e.dirY, e.dirX);
    const progress = 1 - e.stateTime / 0.7;
    const angle = base - span / 2 + progress * span;
    const g = this.telegraphs;
    g.moveTo(x, y)
      .lineTo(x + Math.cos(angle) * 520, y + Math.sin(angle) * 520)
      .stroke({ width: e.isBoss ? 30 : 22, color: 0xff7a4a, alpha: 0.4 });
    g.moveTo(x, y)
      .lineTo(x + Math.cos(angle) * 520, y + Math.sin(angle) * 520)
      .stroke({ width: 3, color: 0xffe0c0, alpha: 0.9 });
  }

  private drawHealthBar(e: Enemy, x: number, y: number): void {
    const w = Math.max(24, e.radius * 2.2);
    const top = y - e.def.displayHeight * 0.95 - 6;
    this.bars.rect(x - w / 2 - 1, top - 1, w + 2, 5).fill({ color: 0x000000, alpha: 0.7 });
    this.bars
      .rect(x - w / 2, top, w * (e.health / e.maxHealth), 3)
      .fill({ color: e.elite ? 0xffc84a : 0xff4d5e });
  }

  private syncProjectiles(alpha: number): void {
    const fx = fxTextures();
    this.sync(
      this.projectiles,
      this.world.projectiles,
      this.overlay,
      (b: Projectile) => {
        const root = new Container();
        const color = b.owner === 'player' ? PLAYER_COLOR : ENEMY_SHOT_COLOR;
        const tail = new Sprite(fx.comet);
        tail.anchor.set(0.18, 0.5);
        tail.blendMode = 'add';
        tail.tint = color;
        tail.width = b.radius * 7.5;
        tail.height = b.radius * 3.4;
        const halo = new Sprite(fx.glow);
        halo.anchor.set(0.5);
        halo.width = halo.height = b.radius * 7;
        halo.tint = color;
        halo.blendMode = 'add';
        const core = new Graphics().circle(0, 0, b.radius * 0.8).fill({ color: 0xffffff });
        root.addChild(tail, halo, core);
        return root;
      },
      (b, root) => {
        const pos = this.lerp(b.id, b.x, b.y, alpha);
        root.position.set(pos.x, pos.y);
        root.alpha = Math.min(1, b.life * 4);
        const tail = root.children[0] as Sprite;
        if (tail) {
          tail.rotation = Math.atan2(b.vy, b.vx) + Math.PI;
          tail.alpha = 0.65 + 0.35 * Math.sin(this.time * 24 + b.id);
        }
      }
    );
  }

  private syncPickups(): void {
    const ui = this.sprites.ui;
    this.sync(
      this.pickups,
      this.world.pickups,
      this.ground,
      (item: Pickup) => {
        const root = new Container();
        const color =
          item.kind === 'shard'
            ? 0xb89cff
            : item.kind === 'fragment'
              ? 0xffd98a
              : item.kind === 'bomb'
                ? 0xffa060
                : item.kind === 'trap'
                  ? 0xffe08a
                  : 0xff5a6a;
        root.addChild(
          this.glow(
            color,
            item.kind === 'fragment' ? 120 : 40,
            item.kind === 'fragment' ? 0.6 : 0.45
          )
        );
        if (item.kind === 'bomb' || item.kind === 'trap') {
          const g = new Graphics();
          if (item.kind === 'bomb') {
            g.circle(0, 0, 8).fill({ color: 0x241f2e });
            g.circle(0, 0, 8).stroke({ width: 2, color });
            g.circle(4, -8, 2).fill({ color: 0xffd98a });
          } else {
            g.circle(0, 0, 9).stroke({ width: 2, color });
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2;
              g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3)
                .lineTo(Math.cos(a) * 9, Math.sin(a) * 9)
                .stroke({ width: 1.5, color });
            }
          }
          root.addChild(g);
        } else {
          const texture: Texture | undefined =
            item.kind === 'shard'
              ? ui.fragment_shard
              : item.kind === 'fragment'
                ? ui.memory_fragment
                : ui.health;
          if (texture) {
            const s = new Sprite(texture);
            s.anchor.set(0.5);
            const size =
              item.kind === 'fragment'
                ? 30
                : item.kind === 'shard'
                  ? 14
                  : item.kind === 'potion'
                    ? 22
                    : 16;
            s.width = s.height = size;
            root.addChild(s);
          }
        }
        return root;
      },
      (item, root) => {
        const bob =
          item.kind === 'fragment'
            ? Math.sin(this.time * 3 + item.id) * 4
            : item.kind === 'shard'
              ? Math.sin(this.time * 3.6 + item.id) * 2.5
              : item.kind === 'potion'
                ? Math.sin(this.time * 2.8 + item.id) * 2.2
                : Math.sin(this.time * 2.2 + item.id) * 1.2;
        root.position.set(item.x, item.y + bob);
        if (item.kind === 'shard') {
          root.rotation = Math.sin(this.time * 2.2 + item.id) * 0.12;
        }
        if (root.children[0]) {
          const pulse =
            item.kind === 'fragment'
              ? 0.45 + 0.25 * Math.sin(this.time * 4 + item.id)
              : item.kind === 'shard'
                ? 0.38 + 0.18 * Math.sin(this.time * 4.5 + item.id)
                : 0.35 + 0.15 * Math.sin(this.time * 3 + item.id);
          root.children[0].alpha = pulse;
        }
      }
    );
  }

  private syncInteractables(): void {
    const props = this.sprites.props;
    this.sync(
      this.interactables,
      this.world.interactables,
      this.actors,
      (it: Interactable) => {
        const root = new Container();
        if (it.kind === 'portal') {
          root.addChild(this.glow(this.accent, 220, 0.7));
          const rift = new Sprite(props.void_rift);
          rift.anchor.set(0.5);
          rift.width = rift.height = 84;
          root.addChild(rift);
          const runeOrbit = new Sprite(fxTextures().rune);
          runeOrbit.anchor.set(0.5);
          runeOrbit.width = runeOrbit.height = 110;
          runeOrbit.tint = this.accent;
          runeOrbit.blendMode = 'add';
          runeOrbit.alpha = 0.4;
          root.addChild(runeOrbit);
        } else {
          const look = interactableLook(it);
          root.addChild(makeShadow(26));
          root.addChild(this.glow(look.glow, 140, it.kind === 'chest' ? 0.45 : 0.3));
          const texture = (props as unknown as Record<string, Texture>)[look.prop];
          if (texture) {
            const s = new Sprite(texture);
            s.anchor.set(0.5, 0.82);
            s.width = s.height = look.size;
            root.addChild(s);
          }
        }
        if (it.label) {
          const label = new Text({
            text: it.label,
            style: {
              fontFamily: 'Cinzel, Georgia, serif',
              fontSize: 11,
              fill: 0xffe3a0,
              stroke: { color: 0x000000, width: 3 },
            },
          });
          label.anchor.set(0.5);
          label.resolution = 2;
          // The exit sign sits above its arch so it never covers the doorway.
          label.position.set(0, it.kind === 'npc' ? -70 : -112);
          root.addChild(label);
          this.labels.push({ text: label, x: it.x, y: it.y });
        }
        return root;
      },
      (it, root) => {
        root.position.set(it.x, it.y);
        root.zIndex = it.y;
        if (it.kind === 'portal') {
          root.children[1].rotation = this.time * 0.8;
          root.children[0].alpha = 0.55 + 0.2 * Math.sin(this.time * 3);
          if (root.children[2]) {
            root.children[2].rotation = -this.time * 0.45;
            root.children[2].alpha = 0.3 + 0.15 * Math.sin(this.time * 2.2);
          }
        } else {
          // Spent chests and wells go dark.
          root.children[1].alpha = it.used ? 0 : 0.3 + 0.12 * Math.sin(this.time * 2.5);
          root.children[2].alpha = it.used ? 0.55 : 1;
        }
      }
    );
  }

  /** Creates, updates and removes display objects to mirror an entity list. */
  private sync<T extends { id: number }>(
    tracked: Map<number, Tracked>,
    items: readonly T[],
    layer: Container,
    create: (item: T) => Container,
    update: (item: T, root: Container) => void
  ): void {
    for (const t of tracked.values()) t.seen = false;
    for (const item of items) {
      let t = tracked.get(item.id);
      if (!t) {
        t = { root: create(item), seen: true };
        tracked.set(item.id, t);
        layer.addChild(t.root);
      }
      t.seen = true;
      update(item, t.root);
    }
    for (const [id, t] of tracked) {
      if (t.seen) continue;
      t.root.destroy({ children: true });
      tracked.delete(id);
      this.previous.delete(id);
    }
  }

  /** World labels are hidden while any menu is open, so they cannot bleed through panels. */
  setLabelsVisible(visible: boolean): void {
    this.labelsEnabled = visible;
    if (!visible) for (const label of this.labels) label.text.visible = false;
  }

  /** Names fade in as the walker approaches, and never sit under the prompt. */
  private updateLabels(): void {
    const p = this.world.player;
    for (const label of this.labels) {
      const distance = Math.hypot(label.x - p.x, label.y - p.y);
      const near = this.labelsEnabled && distance > 54 && distance < 260;
      label.text.visible = near;
      if (near) label.text.alpha = Math.min(1, (260 - distance) / 60);
    }
  }

  destroy(): void {
    for (const layer of [this.ground, this.actors, this.overlay]) layer.destroy({ children: true });
  }
}
