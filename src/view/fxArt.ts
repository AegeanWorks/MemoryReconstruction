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
  /** Screen-space darkness with a clear centre, stretched over the viewport. */
  vignette: Texture;
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
    vignette: paint(512, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.14, s / 2, s / 2, s * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }),
  };
  return cached;
}
