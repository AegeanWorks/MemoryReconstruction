/**
 * Draws everything that moves: player, enemies (with attack telegraphs),
 * projectiles, pickups and interactables. Sprites are keyed by sim entity id
 * and created or destroyed as entities come and go.
 *
 * Positions are interpolated between the last two sim steps so motion stays
 * smooth on displays faster than the 60 Hz simulation.
 */
import { AnimatedSprite, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import type { Enemy, Interactable, Pickup, Projectile } from '../sim/entities';
import { slamRadius } from '../sim/enemies';
import type { World } from '../sim/world';
import { fxTextures } from './fxArt';
import { BIOME_ART, hex } from './palette';
import type { ActorSheet, Animation, SpriteLibrary } from './sheets';

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
  if (it.kind === 'archive') return { prop: 'furn_shelf', size: 70, glow: 0xb8a4ff };
  if (it.kind === 'merchant') return { prop: 'npc_smith', size: 58, glow: 0xffb060 };
  if (it.kind === 'gate') return { prop: 'ruins_door', size: 82, glow: 0xffd98a };
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

  private readonly telegraphs = new Graphics();
  private readonly hazardsG = new Graphics();
  private readonly bars = new Graphics();
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

  constructor(
    private readonly sprites: SpriteLibrary,
    private readonly world: World
  ) {
    this.actors.sortableChildren = true;
    this.accent = hex(BIOME_ART[world.plan.biome].accent);
    this.ground.addChild(this.telegraphs, this.hazardsG);
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

  update(dt: number, alpha: number): void {
    this.time += dt;
    this.telegraphs.clear();
    this.hazardsG.clear();
    this.bars.clear();
    this.drawHazards();
    this.drawBlasts();
    this.drawBombs();
    this.updateLabels();
    this.updatePlayer(alpha);
    this.syncEnemies(dt, alpha);
    this.syncProjectiles(alpha);
    this.syncPickups();
    this.syncInteractables();
  }

  private updatePlayer(alpha: number): void {
    const p = this.world.player;
    const a = this.player;
    const sheet = this.sprites.player;
    const pos = this.playerPosition(alpha);
    a.root.position.set(pos.x, pos.y);
    a.root.zIndex = pos.y;
    this.playerLight.position.set(pos.x, pos.y);

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
    const facing = Math.cos(p.aim) < 0 ? -1 : 1;
    const squash = p.action === 'dash' ? 0.88 : 1;
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
        const sheet = this.sprites.enemies[e.def.sprite] ?? this.sprites.enemies.scavenger;
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
    }
  }

  private drawEnemy(e: Enemy, a: ActorSprite, _dt: number, alpha: number): void {
    const sheet = this.sprites.enemies[e.def.sprite] ?? this.sprites.enemies.scavenger;
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
    // Windup: crouch and tremble; spawning: grow in.
    const windup = e.state === 'windup';
    const tremble = windup ? Math.sin(this.time * 60) * 1.2 : 0;
    const grow = e.state === 'spawning' ? Math.max(0.1, 1 - e.stateTime / 0.7) : 1;
    a.body.scale.set(
      a.baseScale * facing * grow * (windup ? 1.08 : 1),
      a.baseScale * grow * (1 + bob) * (windup ? 0.92 : 1)
    );
    a.body.x = tremble;
    a.flash.scale.copyFrom(a.body.scale);
    a.flash.x = a.body.x;
    a.flash.textures = a.body.textures;
    a.flash.currentFrame = a.body.currentFrame;
    a.flash.tint = windup ? 0xff6a3a : 0xffffff;
    a.flash.alpha = e.flash > 0 ? 0.9 : windup ? 0.25 + 0.25 * Math.sin(this.time * 30) : 0;
    a.body.alpha =
      e.state === 'spawning' ? grow : e.state === 'dying' ? Math.max(0, e.stateTime / 0.5) : 1;
    a.shadow.alpha = a.body.alpha;

    if (e.state === 'spawning') this.drawSpawnRune(e, pos.x, pos.y);
    if (e.state === 'windup') this.drawTelegraph(e, pos.x, pos.y);
    if (!e.isBoss && e.health < e.maxHealth && e.state !== 'dying')
      this.drawHealthBar(e, pos.x, pos.y);
  }

  /** Traps, poison pools and barrels, under the actors. */
  private drawHazards(): void {
    const g = this.hazardsG;
    const t = this.time;
    for (const h of this.world.hazards) {
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
      if (h.kind === 'barrel') {
        g.ellipse(h.x, h.y, 15, 12).fill({ color: 0x8a5a2a, alpha: 0.95 });
        g.ellipse(h.x, h.y, 15, 12).stroke({ width: 2, color: 0xffb060, alpha: 0.5 });
        if (h.hp < h.maxHp)
          g.circle(h.x, h.y, 22).stroke({ width: 2, color: 0xff6a4a, alpha: 0.7 });
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
          .fill({ color: TELEGRAPH_COLOR, alpha: urgency * 0.5 });
        break;
      }
      case 'slam': {
        const r = slamRadius(e);
        g.circle(x, y, r).fill({ color: TELEGRAPH_COLOR, alpha: urgency * 0.35 });
        g.circle(x, y, r).stroke({ width: 2, color: TELEGRAPH_COLOR, alpha: 0.8 });
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
        break;
      }
      case 'shot':
      case 'spread':
      case 'volley': {
        const offsets = e.attack === 'spread' ? [-0.32, 0, 0.32] : [0];
        for (const o of offsets) {
          g.moveTo(x, y)
            .lineTo(x + Math.cos(angle + o) * 260, y + Math.sin(angle + o) * 260)
            .stroke({ width: 2, color: TELEGRAPH_COLOR, alpha: urgency * 0.8 });
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
    }
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
    const glowTex = fxTextures().glow;
    this.sync(
      this.projectiles,
      this.world.projectiles,
      this.overlay,
      (b: Projectile) => {
        const root = new Container();
        const color = b.owner === 'player' ? PLAYER_COLOR : ENEMY_SHOT_COLOR;
        const halo = new Sprite(glowTex);
        halo.anchor.set(0.5);
        halo.width = halo.height = b.radius * 7;
        halo.tint = color;
        halo.blendMode = 'add';
        const core = new Graphics().circle(0, 0, b.radius * 0.75).fill({ color: 0xffffff });
        root.addChild(halo, core);
        return root;
      },
      (b, root) => {
        const pos = this.lerp(b.id, b.x, b.y, alpha);
        root.position.set(pos.x, pos.y);
        root.alpha = Math.min(1, b.life * 4);
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
        const bob = item.kind === 'fragment' ? Math.sin(this.time * 3) * 4 : 0;
        root.position.set(item.x, item.y + bob);
        if (item.kind === 'fragment')
          root.children[0].alpha = 0.45 + 0.25 * Math.sin(this.time * 4);
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
          label.position.set(0, it.kind === 'structure' ? -78 : it.kind === 'gate' ? -70 : -52);
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

  /** Only stations near the walker keep a floating name, which prevents edge clipping. */
  private updateLabels(): void {
    const p = this.world.player;
    for (const label of this.labels) {
      const distance = Math.hypot(label.x - p.x, label.y - p.y);
      // Keep the radius tight enough that the top row's labels are not shown
      // while the player is still at the spawn and they would clip the viewport.
      // Right next to a station the interaction prompt already names it, so the
      // floating label would only overlap the player.
      const near = this.labelsEnabled && distance > 62 && distance < 200;
      label.text.visible = near;
      if (near) label.text.alpha = Math.min(1, (200 - distance) / 45);
    }
  }

  destroy(): void {
    for (const layer of [this.ground, this.actors, this.overlay]) layer.destroy({ children: true });
  }
}
