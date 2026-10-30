/**
 * Procedural top-down tile art, painted with Canvas2D once per floor.
 *
 * Walls read in 3/4 view: a dark cap seen from above, and a lit brick face on
 * every wall whose south neighbour is walkable. Floors next to walls get
 * ambient-occlusion overlays so rooms read as enclosed spaces.
 */
import { Texture } from 'pixi.js';
import type { BiomeId } from '../sim/content';
import { Rng } from '../sim/rng';
import { Deco, TILE_SIZE } from '../sim/tiles';
import { BIOME_ART, type BiomeArt } from './palette';

const T = TILE_SIZE;

export interface TileTextures {
  floor: Texture[];
  wallCap: Texture;
  /** Cap with a lit lip on its south edge, used directly above a wall face. */
  wallCapLip: Texture;
  wallFace: Texture[];
  aoNorth: Texture;
  aoWest: Texture;
  aoEast: Texture;
  threshold: Texture;
  deco: Partial<Record<Deco, Texture>>;
}

function canvas(w = T, h = T): { el: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d');
  if (!ctx)
    throw new Error('Canvas 2D is unavailable; the game needs a browser with canvas support');
  return { el, ctx };
}

function toTexture(el: HTMLCanvasElement): Texture {
  const texture = Texture.from(el);
  texture.source.scaleMode = 'nearest';
  return texture;
}

/** Lightens (amount > 0) or darkens (amount < 0) a '#rrggbb' colour. */
export function shade(color: string, amount: number): string {
  const n = parseInt(color.slice(1), 16);
  const mix = (c: number): number =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  // Hex output, so a shaded colour can be shaded again.
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function speckle(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  base: string,
  count: number,
  spread = 0.12
): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = shade(base, rng.range(-spread, spread));
    ctx.fillRect(rng.int(0, T - 1), rng.int(0, T - 1), rng.chance(0.3) ? 2 : 1, 1);
  }
}

function paintFloor(art: BiomeArt, rng: Rng, variant: number): Texture {
  const { el, ctx } = canvas();
  // Variants differ only slightly, so neighbouring tiles never form a checkerboard.
  const base = shade(
    variant === 2 ? art.floorAlt : art.floor,
    [0, -0.025, 0.02, 0.01][variant] ?? 0
  );
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, T, T);

  switch (art.floorStyle) {
    case 'slabs': {
      // One worn flagstone per tile; some variants split in two so the
      // pattern doesn't read as a grid. Grout is faint so rooms don't look ruled.
      ctx.fillStyle = shade(base, rng.range(-0.05, 0.04));
      ctx.fillRect(1, 1, T - 1, T - 1);
      ctx.fillStyle = shade(base, 0.08);
      ctx.fillRect(1, 1, T - 1, 1);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = art.grout;
      ctx.fillRect(0, 0, T, 1);
      ctx.fillRect(0, 0, 1, T);
      if (variant === 1) ctx.fillRect(16, 1, 1, T - 1);
      if (variant === 3) ctx.fillRect(1, 16, T - 1, 1);
      ctx.globalAlpha = 1;
      speckle(ctx, rng, base, 45);
      break;
    }
    case 'grass': {
      speckle(ctx, rng, base, 70, 0.18);
      for (let i = 0; i < 12; i++) {
        const x = rng.int(1, T - 2);
        const y = rng.int(2, T - 1);
        ctx.fillStyle = shade(base, rng.range(0.1, 0.3));
        ctx.fillRect(x, y - 2, 1, 2);
      }
      if (variant === 3) {
        // A soft patch of bare earth, never a hard black block.
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = shade(base, -0.12);
        ctx.beginPath();
        ctx.ellipse(rng.int(10, 22), rng.int(10, 22), 6, 4, rng.range(0, 3), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'rock': {
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = shade(base, rng.range(-0.12, 0.08));
        ctx.beginPath();
        ctx.ellipse(
          rng.int(0, T),
          rng.int(0, T),
          rng.int(5, 11),
          rng.int(4, 8),
          rng.range(0, 3),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      speckle(ctx, rng, base, 50, 0.16);
      break;
    }
    case 'facets': {
      // Diagonal crystal facets.
      ctx.fillStyle = shade(base, 0.06);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(T, 0);
      ctx.lineTo(0, T);
      ctx.fill();
      ctx.strokeStyle = art.grout;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(T, 0);
      ctx.lineTo(0, T);
      ctx.stroke();
      ctx.strokeRect(0.5, 0.5, T - 1, T - 1);
      ctx.globalAlpha = 1;
      speckle(ctx, rng, base, 25);
      break;
    }
    case 'tiles': {
      ctx.fillStyle = shade(base, 0.04);
      ctx.fillRect(1, 1, T - 1, T - 1);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = art.grout;
      ctx.fillRect(0, 0, T, 1);
      ctx.fillRect(0, 0, 1, T);
      ctx.globalAlpha = 1;
      ctx.fillStyle = shade(base, 0.12);
      ctx.fillRect(1, 1, T - 1, 1);
      if (variant === 0) {
        ctx.strokeStyle = shade(art.accent, -0.5);
        ctx.globalAlpha = 0.35;
        ctx.strokeRect(10.5, 10.5, 11, 11);
        ctx.globalAlpha = 1;
      }
      speckle(ctx, rng, base, 20, 0.08);
      break;
    }
  }
  return toTexture(el);
}

function paintWallCap(art: BiomeArt, rng: Rng, lip: boolean): Texture {
  const { el, ctx } = canvas();
  ctx.fillStyle = art.wallCap;
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, art.wallCap, 30, 0.15);
  if (lip) {
    ctx.fillStyle = shade(art.wallHighlight, -0.15);
    ctx.fillRect(0, T - 4, T, 2);
    ctx.fillStyle = art.wallHighlight;
    ctx.fillRect(0, T - 2, T, 2);
  }
  return toTexture(el);
}

function paintWallFace(art: BiomeArt, rng: Rng, variant: number): Texture {
  const { el, ctx } = canvas();
  ctx.fillStyle = art.wallFace;
  ctx.fillRect(0, 0, T, T);
  // Brick courses, 8px tall, alternating offset.
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    const offset = (row + variant) % 2 === 0 ? 0 : 8;
    for (let x = -offset; x < T; x += 16) {
      ctx.fillStyle = shade(art.wallFace, rng.range(-0.1, 0.08) - row * 0.05);
      ctx.fillRect(x + 1, y + 1, 14, 6);
      ctx.fillStyle = shade(art.wallFace, 0.12 - row * 0.04);
      ctx.fillRect(x + 1, y + 1, 14, 1);
    }
    ctx.fillStyle = art.wallMortar;
    ctx.fillRect(0, y, T, 1);
  }
  // Light from above, occlusion where the wall meets the floor.
  const gradient = ctx.createLinearGradient(0, 0, 0, T);
  gradient.addColorStop(0, 'rgba(255,255,255,0.10)');
  gradient.addColorStop(0.7, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, T, T);
  return toTexture(el);
}

function paintOcclusion(direction: 'north' | 'west' | 'east'): Texture {
  const { el, ctx } = canvas();
  const depth = direction === 'north' ? 14 : 8;
  const gradient =
    direction === 'north'
      ? ctx.createLinearGradient(0, 0, 0, depth)
      : direction === 'west'
        ? ctx.createLinearGradient(0, 0, depth, 0)
        : ctx.createLinearGradient(T, 0, T - depth, 0);
  gradient.addColorStop(0, `rgba(0,0,0,${direction === 'north' ? 0.55 : 0.35})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, T, T);
  return toTexture(el);
}

function paintThreshold(art: BiomeArt): Texture {
  const { el, ctx } = canvas();
  ctx.fillStyle = shade(art.grout, -0.2);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < T; i += 6) ctx.fillRect(i, 0, 3, T);
  return toTexture(el);
}

function paintDeco(art: BiomeArt, rng: Rng, kind: Deco): Texture {
  const { el, ctx } = canvas();
  switch (kind) {
    case Deco.Crack: {
      ctx.strokeStyle = shade(art.grout, -0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      let x = rng.int(4, 12);
      let y = rng.int(4, 12);
      ctx.moveTo(x, y);
      for (let i = 0; i < 4; i++) {
        x += rng.int(2, 6);
        y += rng.int(-2, 5);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case Deco.Rubble:
      for (let i = 0; i < 4; i++) {
        const x = rng.int(4, 26);
        const y = rng.int(4, 26);
        const s = rng.int(2, 4);
        ctx.fillStyle = shade(art.wallFace, -0.2);
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = shade(art.wallHighlight, -0.1);
        ctx.fillRect(x, y, s, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x, y + s, s, 1);
      }
      break;
    case Deco.Moss:
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = shade(art.growth, rng.range(-0.3, 0.1));
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(rng.int(6, 26), rng.int(6, 26), rng.int(1, 3), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case Deco.Glyph:
      ctx.strokeStyle = art.accent;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(16, 16, 9, 0, Math.PI * 2);
      ctx.moveTo(16, 8);
      ctx.lineTo(16, 24);
      ctx.moveTo(10, 13);
      ctx.lineTo(22, 19);
      ctx.stroke();
      break;
    case Deco.None:
      break;
  }
  return toTexture(el);
}

const cache = new Map<BiomeId, TileTextures>();

/** Tile textures for a biome, painted on first use. */
export function tileTextures(biome: BiomeId): TileTextures {
  const cached = cache.get(biome);
  if (cached) return cached;
  const art = BIOME_ART[biome];
  const rng = new Rng(biome.length * 7919 + biome.charCodeAt(0));
  const textures: TileTextures = {
    floor: [0, 1, 2, 3].map((v) => paintFloor(art, rng, v)),
    wallCap: paintWallCap(art, rng, false),
    wallCapLip: paintWallCap(art, rng, true),
    wallFace: [0, 1].map((v) => paintWallFace(art, rng, v)),
    aoNorth: paintOcclusion('north'),
    aoWest: paintOcclusion('west'),
    aoEast: paintOcclusion('east'),
    threshold: paintThreshold(art),
    deco: {
      [Deco.Crack]: paintDeco(art, rng, Deco.Crack),
      [Deco.Rubble]: paintDeco(art, rng, Deco.Rubble),
      [Deco.Moss]: paintDeco(art, rng, Deco.Moss),
      [Deco.Glyph]: paintDeco(art, rng, Deco.Glyph),
    },
  };
  cache.set(biome, textures);
  return textures;
}
