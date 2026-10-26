/**
 * Transient visual effects driven by sim events: particles, slash arcs,
 * shockwave rings, damage numbers and camera shake. Everything is pooled or
 * short-lived, and nothing here feeds back into the simulation.
 */
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { SimEvent } from '../sim/events';
import { fxTextures } from './fxArt';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  drag: number;
  grow: number;
}

interface Slash {
  x: number;
  y: number;
  angle: number;
  combo: number;
  weapon: 'sword' | 'spear' | 'greatsword';
  age: number;
}

interface Ring {
  sprite: Sprite;
  age: number;
  life: number;
  radius: number;
}

interface FloatingText {
  text: Text;
  vy: number;
  age: number;
  life: number;
}

const MAX_PARTICLES = 500;
const SLASH_LIFE = 0.16;
const MOTES = 40;

export class Effects {
  /** World-space layer above actors. */
  readonly layer = new Container();
  private readonly slashGfx = new Graphics();
  private readonly particles: Particle[] = [];
  private readonly free: Sprite[] = [];
  private readonly slashes: Slash[] = [];
  private readonly rings: Ring[] = [];
  private readonly texts: FloatingText[] = [];
  private readonly motes: Particle[] = [];
  private shake = 0;
  /** 0..1 strength of the red screen flash after taking damage. */
  hurtFlash = 0;

  constructor(
    private readonly accent: number,
    private readonly random: () => number = Math.random
  ) {
    this.layer.addChild(this.slashGfx);
  }

  handle(events: readonly SimEvent[], playerX: number, playerY: number): void {
    for (const e of events) {
      switch (e.type) {
        case 'swing':
          this.slashes.push({
            x: e.x,
            y: e.y,
            angle: e.angle,
            combo: e.combo,
            weapon: e.weapon,
            age: 0,
          });
          break;
        case 'dash':
          this.burst(e.x, e.y, 0x6fe7ff, 10, 60, 0.35, 5);
          break;
        case 'bolt':
          this.burst(
            e.x + Math.cos(e.angle) * 16,
            e.y + Math.sin(e.angle) * 16,
            0x6fe7ff,
            5,
            90,
            0.2,
            3
          );
          break;
        case 'hit':
          if (e.target === 'enemy') {
            this.directionalSparks(
              e.x,
              e.y,
              Math.atan2(e.y - playerY, e.x - playerX),
              e.crit ? 14 : 7
            );
            this.number(e.x, e.y, `${e.amount}`, e.crit ? 0xffd34a : 0xffffff, e.crit ? 22 : 16);
          } else {
            this.burst(e.x, e.y, 0xff3b3b, 12, 140, 0.4, 4);
            this.number(e.x, e.y, `-${e.amount}`, 0xff5a5a, 18);
          }
          break;
        case 'shockwave':
          this.ring(e.x, e.y, e.radius, 0x6fe7ff, 0.3);
          break;
        case 'enemyAttack':
          if (e.attack === 'slam') this.ring(e.x, e.y, 120, 0xff6a3a, 0.35);
          break;
        case 'enemyDied':
          this.burst(
            e.x,
            e.y - 16,
            this.accent,
            e.boss ? 80 : 18,
            e.boss ? 260 : 150,
            e.boss ? 1.2 : 0.6,
            e.boss ? 8 : 5
          );
          if (e.boss) this.ring(e.x, e.y, 260, 0xffffff, 0.6);
          break;
        case 'enemySpawned':
          this.burst(e.x, e.y, this.accent, 8, 50, 0.5, 4);
          break;
        case 'pickup':
          this.burst(
            e.x,
            e.y,
            e.kind === 'shard' ? 0xb89cff : e.kind === 'fragment' ? 0xffd98a : 0xff5a6a,
            5,
            60,
            0.3,
            3
          );
          break;
        case 'fragmentFound':
          this.ring(playerX, playerY, 140, 0xffd98a, 0.7);
          break;
        case 'potion':
          this.burst(playerX, playerY, 0x7dff9a, 16, 80, 0.6, 4);
          this.number(playerX, playerY - 30, `+${e.healed}`, 0x7dff9a, 18);
          break;
        case 'levelUp':
          this.ring(playerX, playerY, 120, 0xffd98a, 0.6);
          this.number(playerX, playerY - 40, 'LEVEL UP', 0xffd98a, 20);
          break;
        case 'graze':
          this.ring(e.x, e.y, 26, 0x6fe7ff, 0.22);
          this.burst(e.x, e.y, 0x9df3ff, 6, 80, 0.22, 3);
          this.number(e.x, e.y - 8, 'GRAZE', 0x9df3ff, 12);
          break;
        case 'resonance':
          if (e.count === 3 || e.count === 6 || e.count === 10)
            this.ring(playerX, playerY, 60 + e.count * 4, 0x6fe7ff, 0.45);
          break;
        case 'resonanceBreak':
          this.ring(playerX, playerY, 70, 0xff5a5a, 0.4);
          break;
        case 'lootSurge':
          this.ring(e.x, e.y, e.kind === 'jackpot' ? 100 : 70, 0xffd98a, 0.5);
          this.number(
            e.x,
            e.y - 24,
            e.kind === 'jackpot' ? `JACKPOT +${e.amount}` : `RICH +${e.amount}`,
            0xffd98a,
            e.kind === 'jackpot' ? 20 : 15
          );
          break;
        case 'flawlessRoom':
          this.number(playerX, playerY - 30, `FLAWLESS +${e.shards}`, 0x9df3ff, 15);
          break;
        case 'objectiveComplete':
          this.ring(playerX, playerY, 200, 0xffd98a, 0.8);
          this.number(playerX, playerY - 46, `FLOOR RESTORED +${e.shards}`, 0xffd98a, 18);
          break;
        case 'equipment':
          this.ring(playerX, playerY, 90, 0xffd98a, 0.5);
          this.number(
            playerX,
            playerY - 40,
            `${e.rarity.toUpperCase()} ${e.slot}`,
            0xffd98a,
            e.rarity === 'epic' ? 18 : 14
          );
          break;
        case 'hazardBurst': {
          const color =
            e.kind === 'poison'
              ? 0x9ef06a
              : e.kind === 'barrel'
                ? 0xffa040
                : e.kind === 'spike'
                  ? 0xe0e0ff
                  : 0xff8a5a;
          this.ring(e.x, e.y, e.radius, color, 0.35);
          this.burst(e.x, e.y, color, e.kind === 'poison' ? 6 : 14, 140, 0.35, 4);
          if (e.kind === 'barrel') this.number(e.x, e.y - 18, 'BOOM', color, 18);
          break;
        }
        case 'blast':
          this.ring(e.x, e.y, e.radius, 0xffa060, 0.4);
          this.burst(e.x, e.y, 0xffb070, 12, 160, 0.32, 4);
          break;
        case 'bombExploded':
          this.ring(e.x, e.y, e.radius, 0xffb060, 0.55);
          this.ring(e.x, e.y, e.radius * 0.6, 0xfff0c0, 0.35);
          this.burst(e.x, e.y, 0xffa040, 24, 220, 0.45, 5);
          this.number(e.x, e.y - 26, 'BOOM', 0xffd98a, 18);
          break;
        case 'bombThrown':
          this.burst(e.x, e.y, e.owner === 'player' ? 0x9df3ff : 0xff8a6a, 4, 50, 0.2, 3);
          break;
        case 'weaponArt': {
          const color =
            e.weapon === 'greatsword' ? 0xffd98a : e.weapon === 'spear' ? 0x9df3ff : 0xd8f6ff;
          if (e.weapon === 'spear' && e.angle !== undefined) {
            const length = e.length ?? 150;
            const ex = e.x + Math.cos(e.angle) * length;
            const ey = e.y + Math.sin(e.angle) * length;
            this.ring(ex, ey, 34, color, 0.45);
          }
          // The art uses the stance's own slash shape plus an impact ring.
          this.slashes.push({
            x: e.x,
            y: e.y,
            angle: e.angle ?? 0,
            combo: e.weapon === 'greatsword' ? 1 : 2,
            weapon: e.weapon,
            age: 0,
          });
          this.ring(e.x, e.y, e.radius, color, 0.6);
          this.ring(e.x, e.y, e.radius * 0.72, 0xffffff, 0.4);
          this.ring(e.x, e.y, e.radius * 0.42, color, 0.5);
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            this.burst(
              e.x + Math.cos(a) * e.radius * 0.35,
              e.y + Math.sin(a) * e.radius * 0.35,
              color,
              3,
              160,
              0.35,
              4
            );
          }
          this.burst(e.x, e.y, color, 26, 260, 0.55, 6);
          break;
        }
        case 'beam':
          this.ring(e.x, e.y, 26, 0xffd0d0, 0.25);
          this.ring(
            e.x + Math.cos(e.angle) * e.length * 0.5,
            e.y + Math.sin(e.angle) * e.length * 0.5,
            40,
            0xff6a6a,
            0.3
          );
          break;
        case 'blink':
          this.ring(e.x, e.y, 50, 0xbfa0ff, 0.4);
          this.ring(e.toX, e.toY, 50, 0xbfa0ff, 0.4);
          break;
        case 'hook':
          this.ring(e.toX, e.toY, 46, 0x9df3ff, 0.35);
          this.burst(e.toX, e.toY, 0x9df3ff, 8, 90, 0.3, 3);
          break;
        case 'interact':
          this.burst(e.x, e.y, 0xffd98a, 24, 120, 0.8, 5);
          break;
        case 'playerHurt':
          this.hurtFlash = 1;
          break;
        case 'shake':
          this.shake = Math.min(18, Math.max(this.shake, e.strength));
          break;
        default:
          break;
      }
    }
  }

  /** Camera offset for this frame's shake. */
  shakeOffset(): { x: number; y: number } {
    if (this.shake < 0.2) return { x: 0, y: 0 };
    return { x: (this.random() * 2 - 1) * this.shake, y: (this.random() * 2 - 1) * this.shake };
  }

  update(dt: number, view: { x: number; y: number; w: number; h: number }): void {
    this.shake *= Math.exp(-14 * dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.updateParticles(dt);
    this.updateSlashes(dt);
    this.updateRings(dt);
    this.updateTexts(dt);
    this.updateMotes(dt, view);
  }

  private spawn(
    x: number,
    y: number,
    color: number,
    size: number,
    vx: number,
    vy: number,
    life: number,
    drag = 4
  ): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const sprite = this.free.pop() ?? new Sprite(fxTextures().spark);
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    sprite.tint = color;
    sprite.position.set(x, y);
    sprite.width = sprite.height = size;
    sprite.alpha = 1;
    sprite.visible = true;
    if (!sprite.parent) this.layer.addChild(sprite);
    this.particles.push({ sprite, vx, vy, life, maxLife: life, drag, grow: 0 });
  }

  private burst(
    x: number,
    y: number,
    color: number,
    count: number,
    speed: number,
    life: number,
    size: number
  ): void {
    for (let i = 0; i < count; i++) {
      const a = this.random() * Math.PI * 2;
      const s = speed * (0.3 + this.random() * 0.7);
      this.spawn(
        x,
        y,
        color,
        size * (0.6 + this.random() * 0.8),
        Math.cos(a) * s,
        Math.sin(a) * s,
        life * (0.6 + this.random() * 0.6)
      );
    }
  }

  private directionalSparks(x: number, y: number, angle: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = angle + (this.random() - 0.5) * 1.4;
      const s = 120 + this.random() * 220;
      this.spawn(
        x,
        y,
        i % 3 === 0 ? 0xffffff : 0xffc46a,
        3 + this.random() * 3,
        Math.cos(a) * s,
        Math.sin(a) * s,
        0.25 + this.random() * 0.2,
        7
      );
    }
  }

  private ring(x: number, y: number, radius: number, color: number, life: number): void {
    const sprite = new Sprite(fxTextures().ring);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.tint = color;
    sprite.blendMode = 'add';
    this.layer.addChild(sprite);
    this.rings.push({ sprite, age: 0, life, radius });
  }

  private number(x: number, y: number, label: string, color: number, size: number): void {
    const text = new Text({
      text: label,
      style: {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: size,
        fontWeight: '700',
        fill: color,
        stroke: { color: 0x000000, width: 4 },
      },
    });
    text.anchor.set(0.5);
    // Stack labels that land together instead of drawing them on top of each other.
    let lift = 0;
    for (const other of this.texts)
      if (other.age < 0.4 && Math.abs(other.text.x - x) < 90 && Math.abs(other.text.y - y) < 34)
        lift += 17;
    const lane = Math.min(6, Math.round(lift / 17));
    text.position.set(x + (this.random() - 0.5) * 14 + (lane % 2) * 30, y - lane * 17);
    text.resolution = 2;
    this.layer.addChild(text);
    this.texts.push({ text, vy: -70, age: 0, life: 0.8 });
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.free.push(p.sprite);
        this.particles.splice(i, 1);
        continue;
      }
      const decay = Math.exp(-p.drag * dt);
      p.vx *= decay;
      p.vy *= decay;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.alpha = p.life / p.maxLife;
    }
  }

  private updateSlashes(dt: number): void {
    const g = this.slashGfx;
    g.clear();
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.age += dt;
      if (s.age >= SLASH_LIFE) {
        this.slashes.splice(i, 1);
        continue;
      }
      const t = s.age / SLASH_LIFE;
      const alpha = 1 - t;
      // Spear: a fast forward thrust line. Greatsword: a wider, heavier arc.
      if (s.weapon === 'spear') {
        const tip = 30 + 78 * Math.min(1, t * 2.6);
        const ex = s.x + Math.cos(s.angle) * tip;
        const ey = s.y + Math.sin(s.angle) * tip;
        g.moveTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10)
          .lineTo(ex, ey)
          .stroke({ width: 6 * alpha + 1, color: 0xd8f6ff, alpha });
        g.circle(ex, ey, 5 + 4 * alpha).fill({ color: 0xffffff, alpha: alpha * 0.8 });
        g.moveTo(ex - Math.cos(s.angle + 1.4) * 12, ey - Math.sin(s.angle + 1.4) * 12)
          .lineTo(ex, ey)
          .lineTo(ex - Math.cos(s.angle - 1.4) * 12, ey - Math.sin(s.angle - 1.4) * 12)
          .stroke({ width: 2, color: 0x9df3ff, alpha: alpha * 0.7 });
        continue;
      }
      const finisher = s.combo === (s.weapon === 'greatsword' ? 1 : 2);
      const reach = s.weapon === 'greatsword' ? (finisher ? 82 : 70) : finisher ? 68 : 58;
      const half = s.weapon === 'greatsword' ? (finisher ? 1.75 : 1.4) : finisher ? 1.45 : 1.0;
      // Keep the crescent centred on the aim and expand it outward. The old
      // sweep started behind the player, so the arc read as a tail rather than
      // a strike toward the target.
      const spread = Math.min(1, t * 2.6);
      const from = s.angle - half * spread;
      const to = s.angle + half * spread;
      const steps = 10;
      const outer: number[] = [];
      const inner: number[] = [];
      for (let k = 0; k <= steps; k++) {
        const a = from + ((to - from) * k) / steps;
        const thickBase = s.weapon === 'greatsword' ? 16 : 6;
        const thickness = thickBase + 14 * Math.sin((k / steps) * Math.PI);
        outer.push(s.x + Math.cos(a) * reach, s.y + Math.sin(a) * reach);
        inner.push(
          s.x + Math.cos(a) * (reach - thickness),
          s.y + Math.sin(a) * (reach - thickness)
        );
      }
      const points = [...outer];
      for (let k = inner.length - 2; k >= 0; k -= 2) points.push(inner[k], inner[k + 1]);
      const color = s.weapon === 'greatsword' ? 0xffe9a8 : finisher ? 0xfff3c4 : 0xc8f7ff;
      g.poly(points).fill({ color, alpha: 0.85 * alpha });
      g.poly(outer, false).stroke({ width: 2, color: 0xffffff, alpha });
    }
  }

  private updateRings(dt: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) {
        r.sprite.destroy();
        this.rings.splice(i, 1);
        continue;
      }
      const size = r.radius * 2 * (0.3 + 0.7 * Math.sqrt(t));
      r.sprite.width = r.sprite.height = size;
      r.sprite.alpha = 1 - t;
    }
  }

  private updateTexts(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const f = this.texts[i];
      f.age += dt;
      if (f.age >= f.life) {
        f.text.destroy();
        this.texts.splice(i, 1);
        continue;
      }
      f.vy *= Math.exp(-3 * dt);
      f.text.y += f.vy * dt;
      const t = f.age / f.life;
      f.text.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      f.text.scale.set(t < 0.1 ? 0.6 + 4 * t : 1);
    }
  }

  /** Slow drifting dust around the camera for atmosphere. */
  private updateMotes(dt: number, view: { x: number; y: number; w: number; h: number }): void {
    while (this.motes.length < MOTES) {
      const sprite = new Sprite(fxTextures().spark);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.tint = this.accent;
      this.layer.addChildAt(sprite, 0);
      const mote: Particle = { sprite, vx: 0, vy: 0, life: 0, maxLife: 1, drag: 0, grow: 0 };
      this.resetMote(mote, view);
      mote.life = this.random() * mote.maxLife;
      this.motes.push(mote);
    }
    for (const m of this.motes) {
      m.life -= dt;
      const s = m.sprite;
      s.x += m.vx * dt;
      s.y += m.vy * dt;
      const outside =
        s.x < view.x - 40 ||
        s.x > view.x + view.w + 40 ||
        s.y < view.y - 40 ||
        s.y > view.y + view.h + 40;
      if (m.life <= 0 || outside) this.resetMote(m, view);
      const t = m.life / m.maxLife;
      s.alpha = 0.35 * Math.sin(t * Math.PI);
    }
  }

  private resetMote(m: Particle, view: { x: number; y: number; w: number; h: number }): void {
    m.sprite.position.set(view.x + this.random() * view.w, view.y + this.random() * view.h);
    m.vx = (this.random() - 0.5) * 14;
    m.vy = -6 - this.random() * 12;
    m.maxLife = 3 + this.random() * 4;
    m.life = m.maxLife;
    m.sprite.width = m.sprite.height = 2 + this.random() * 3;
  }

  destroy(): void {
    this.layer.destroy({ children: true });
  }
}
