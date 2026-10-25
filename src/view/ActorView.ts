/**
 * Draws everything that moves: player, enemies (with attack telegraphs),
 * projectiles, pickups and interactables. Sprites are keyed by sim entity id
 * and created or destroyed as entities come and go.
 *
 * Positions are interpolated between the last two sim steps so motion stays
 * smooth on displays faster than the 60 Hz simulation.
 */
import { AnimatedSprite, Container, Graphics, Sprite, type Texture } from 'pixi.js';
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

export class ActorView {
  /** Under actors: telegraphs, glows, interactables. */
  readonly ground = new Container();
  /** Actors, depth-sorted by feet position. */
  readonly actors = new Container();
  /** Over actors: projectiles and health bars. */
  readonly overlay = new Container();

  private readonly telegraphs = new Graphics();
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
  private time = 0;

  constructor(
    private readonly sprites: SpriteLibrary,
    private readonly world: World
  ) {
    this.actors.sortableChildren = true;
    this.accent = hex(BIOME_ART[world.plan.biome].accent);
    this.ground.addChild(this.telegraphs);
    this.player = makeActor(sprites.player, 56);
    this.actors.addChild(this.player.root);
    this.playerLight = this.glow(PLAYER_COLOR, 260, 0.16);
    this.ground.addChild(this.playerLight);
    this.overlay.addChild(this.bars);
    this.capture();
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
    this.bars.clear();
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

    const anim =
      p.action === 'dash'
        ? sheet.dash!
        : p.action === 'attack'
          ? sheet.attack
          : p.action === 'move'
            ? sheet.walk
            : sheet.idle;
    if (p.action === 'attack' && a.current === sheet.attack && p.swingTime < 0.02)
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
          item.kind === 'shard' ? 0xb89cff : item.kind === 'fragment' ? 0xffd98a : 0xff5a6a;
        root.addChild(
          this.glow(
            color,
            item.kind === 'fragment' ? 120 : 40,
            item.kind === 'fragment' ? 0.6 : 0.45
          )
        );
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
          root.addChild(makeShadow(26));
          root.addChild(this.glow(it.kind === 'chest' ? 0xffd98a : this.accent, 140, 0.35));
          const s = new Sprite(it.kind === 'chest' ? props.memory_chest : props.memory_fountain);
          s.anchor.set(0.5, 0.82);
          s.width = s.height = it.kind === 'chest' ? 64 : 84;
          root.addChild(s);
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

  destroy(): void {
    for (const layer of [this.ground, this.actors, this.overlay]) layer.destroy({ children: true });
  }
}
