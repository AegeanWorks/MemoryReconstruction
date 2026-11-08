/**
 * Small generated textures for lights and particles.
 */
import { Texture } from 'pixi.js';

export interface FxTextures {
  /** Soft white radial falloff; tint and add-blend it for lights. */
  glow: Texture;
  /** Tight bright dot for sparks and projectile cores. */
  spark: Texture;
  /** Thin ring for shockwaves and pickups. */
  ring: Texture;
  /** Six-spoke snowflake and ash grain. */
  flake: Texture;
  /** Soft oval for falling petals and leaves. */
  petal: Texture;
  /** Soft cloud for foundry haze. */
  smoke: Texture;
  /** Small bright ring with a highlight for underwater air. */
  bubble: Texture;
  /** Screen-space darkness with a clear centre, stretched over the viewport. */
  vignette: Texture;
  /** 4-point glittering starburst for critical hits, level up, and rare drops. */
  star: Texture;
  /** Ancient runic ring with radial tick marks, used for boss halos and portal rifts. */
  rune: Texture;
  /** Gradient comet tail for projectile wakes and dash ribbons. */
  comet: Texture;
  /** Soft irregular dust puff for footsteps, landings and breakable debris. */
  dust: Texture;
}

function paint(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): Texture {
  const el = document.createElement('canvas');
  el.width = size;
  el.height = size;
  const ctx = el.getContext('2d');
  if (!ctx)
    throw new Error('Canvas 2D is unavailable; the game needs a browser with canvas support');
  draw(ctx, size);
  return Texture.from(el);
}

let cached: FxTextures | undefined;

export function fxTextures(): FxTextures {
  if (cached) return cached;
  cached = {
    glow: paint(128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }),
    spark: paint(16, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }),
    ring: paint(128, (ctx, s) => {
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
      ctx.stroke();
    }),
    flake: paint(24, (ctx, s) => {
      const c = s / 2;
      const r = s * 0.36;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        ctx.beginPath();
        ctx.moveTo(c - dx, c - dy);
        ctx.lineTo(c + dx, c + dy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(c, c, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }),
    petal: paint(24, (ctx, s) => {
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate(-0.55);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.34, s * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }),
    smoke: paint(64, (ctx, s) => {
      const c = s / 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = c + Math.cos(a) * s * 0.13;
        const y = c + Math.sin(a) * s * 0.11;
        const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.3);
        g.addColorStop(0, 'rgba(255,255,255,0.16)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }
    }),
    bubble: paint(24, (ctx, s) => {
      const c = s / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c, c, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(c - s * 0.08, c - s * 0.08, s * 0.1, 2.4, 4.2);
      ctx.stroke();
    }),
    vignette: paint(512, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.14, s / 2, s / 2, s * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }),
    star: paint(48, (ctx, s) => {
      const c = s / 2;
      // Soft center halo
      const g = ctx.createRadialGradient(c, c, 0, c, c, s * 0.45);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      // Sharp 4-point cross
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(c, 2);
      ctx.quadraticCurveTo(c, c, s - 2, c);
      ctx.quadraticCurveTo(c, c, c, s - 2);
      ctx.quadraticCurveTo(c, c, 2, c);
      ctx.quadraticCurveTo(c, c, c, 2);
      ctx.fill();
    }),
    rune: paint(128, (ctx, s) => {
      const c = s / 2;
      const rOuter = s * 0.44;
      const rInner = s * 0.36;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c, c, rOuter, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(c, c, rInner, 0, Math.PI * 2);
      ctx.stroke();
      // 8 radial runes / tick marks
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(c + cos * (rInner - 2), c + sin * (rInner - 2));
        ctx.lineTo(c + cos * (rOuter + 3), c + sin * (rOuter + 3));
        ctx.stroke();
      }
      // Cardinal diamonds
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const dx = c + Math.cos(a) * (rOuter + 7);
        const dy = c + Math.sin(a) * (rOuter + 7);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.moveTo(dx, dy - 3);
        ctx.lineTo(dx + 3, dy);
        ctx.lineTo(dx, dy + 3);
        ctx.lineTo(dx - 3, dy);
        ctx.closePath();
        ctx.fill();
      }
    }),
    comet: paint(64, (ctx, s) => {
      // Horizontal tapered streak: center at (16, s/2), head radius ~10, tail extending right
      const cy = s / 2;
      const hx = 16;
      const g = ctx.createLinearGradient(hx - 8, cy, s, cy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.18, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(hx, cy - 8);
      ctx.quadraticCurveTo(s * 0.6, cy - 2, s - 2, cy);
      ctx.quadraticCurveTo(s * 0.6, cy + 2, hx, cy + 8);
      ctx.arc(hx, cy, 8, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();
    }),
    dust: paint(32, (ctx, s) => {
      // Three overlapping soft blobs: an irregular puff that never reads as
      // a hard circle at 8-16px gameplay size.
      const c = s / 2;
      const blobs: Array<[number, number, number]> = [
        [c - 4, c + 2, 9],
        [c + 4, c + 1, 7],
        [c, c - 4, 6],
      ];
      for (const [x, y, r] of blobs) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.5)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }),
  };
  return cached;
}
