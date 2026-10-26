/**
 * Sprite sheets described by sprite_atlas.json, cut into frame textures.
 */
import { Assets, Rectangle, Texture } from 'pixi.js';
import atlas from '@data/sprite_atlas.json';

export interface Animation {
  frames: Texture[];
  fps: number;
  loop: boolean;
}

export interface ActorSheet {
  idle: Animation;
  walk: Animation;
  attack: Animation;
  death: Animation;
  /** Present for the player only. */
  dash?: Animation;
  /** Player strips for the other stances. */
  idleSpear?: Animation;
  idleGreatsword?: Animation;
  walkSpear?: Animation;
  walkGreatsword?: Animation;
  attackSpear?: Animation;
  attackGreatsword?: Animation;
  originX: number;
  originY: number;
  frameHeight: number;
}

export interface SpriteLibrary {
  player: ActorSheet;
  enemies: Record<string, ActorSheet>;
  props: Record<string, Texture>;
  ui: Record<string, Texture>;
}

interface AtlasEnemy {
  texture: string;
  frameWidth: number;
  frameHeight: number;
  origin: { x: number; y: number };
  animations: Record<string, { row: number; frames: number; fps: number; loop: boolean }>;
}

interface AtlasPlayerAnim {
  texture: string;
  frames: number;
  fps: number;
  loop: boolean;
}

interface Atlas {
  player: {
    frameSize: { width: number; height: number };
    origin: { x: number; y: number };
    animations: Record<string, AtlasPlayerAnim>;
  };
  enemies: Record<string, AtlasEnemy>;
  props: Record<string, string>;
  ui: Record<string, string>;
}

const data = atlas as Atlas;

function url(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path.replace(/^\/+/, '')}`;
}

function cut(source: Texture, x: number, y: number, w: number, h: number): Texture {
  return new Texture({ source: source.source, frame: new Rectangle(x, y, w, h) });
}

function strip(
  source: Texture,
  row: number,
  count: number,
  w: number,
  h: number,
  columns = count
): Texture[] {
  return Array.from({ length: Math.min(count, columns) }, (_, i) =>
    cut(source, i * w, row * h, w, h)
  );
}

async function loadTexture(path: string): Promise<Texture> {
  const texture = await Assets.load<Texture>(url(path));
  // Pixel art stays crisp: bilinear filtering was the main source of the
  // "blurry boss" look, especially when a 64px sheet was scaled to 144px.
  texture.source.scaleMode = 'nearest';
  return texture;
}

async function loadPlayer(): Promise<ActorSheet> {
  const p = data.player;
  const w = p.frameSize.width;
  const h = p.frameSize.height;
  const anim = async (key: string): Promise<Animation> => {
    const a = p.animations[key];
    const texture = await loadTexture(a.texture);
    return { frames: strip(texture, 0, a.frames, w, h), fps: a.fps, loop: a.loop };
  };
  const [
    idle,
    walk,
    attack,
    dash,
    idleSpear,
    idleGreatsword,
    walkSpear,
    walkGreatsword,
    attackSpear,
    attackGreatsword,
  ] = await Promise.all([
    anim('idle'),
    anim('walk'),
    anim('attack'),
    anim('dash'),
    anim('idle_spear'),
    anim('idle_greatsword'),
    anim('walk_spear'),
    anim('walk_greatsword'),
    anim('attack_spear'),
    anim('attack_greatsword'),
  ]);
  // The player sheet has no death strip; the idle pose fades out instead.
  return {
    idle,
    walk,
    attack,
    dash,
    idleSpear,
    idleGreatsword,
    walkSpear,
    walkGreatsword,
    attackSpear,
    attackGreatsword,
    death: { ...idle, loop: false },
    originX: p.origin.x,
    originY: p.origin.y,
    frameHeight: h,
  };
}

async function loadEnemy(entry: AtlasEnemy): Promise<ActorSheet> {
  const texture = await loadTexture(entry.texture);
  const w = entry.frameWidth;
  const h = entry.frameHeight;
  const row = (key: string, frames?: number): Animation => {
    const a = entry.animations[key];
    return { frames: strip(texture, a.row, frames ?? a.frames, w, h), fps: a.fps, loop: a.loop };
  };
  const idle = row('idle');
  return {
    idle,
    // Most generated walk strips have empty odd frames, so walking reuses the
    // idle strip (faster) and the view adds a bob.
    walk: { frames: idle.frames, fps: idle.fps * 2, loop: true },
    attack: row('attack'),
    // The last death frame is blank; stop on the third.
    death: row('death', 3),
    originX: entry.origin.x,
    originY: entry.origin.y,
    frameHeight: h,
  };
}

export async function loadSprites(onProgress?: (fraction: number) => void): Promise<SpriteLibrary> {
  const enemyKeys = Object.keys(data.enemies); // aikit:allow-secret
  const total = enemyKeys.length + Object.keys(data.props).length + Object.keys(data.ui).length + 1;
  let done = 0;
  const tick = <T>(value: T): T => {
    done++;
    onProgress?.(done / total);
    return value;
  };

  const player = tick(await loadPlayer());
  const enemies: Record<string, ActorSheet> = {};
  await Promise.all(
    enemyKeys.map(async (key) => {
      enemies[key] = tick(await loadEnemy(data.enemies[key]));
    })
  );
  const loadMap = async (map: Record<string, string>): Promise<Record<string, Texture>> => {
    const out: Record<string, Texture> = {};
    await Promise.all(
      Object.entries(map).map(async ([key, path]) => {
        out[key] = tick(await loadTexture(path));
      })
    );
    return out;
  };
  const [props, ui] = await Promise.all([loadMap(data.props), loadMap(data.ui)]);
  return { player, enemies, props, ui };
}

/** Every image path the atlas references, for asset checks. */
export function atlasImagePaths(): string[] {
  return [
    ...Object.values(data.player.animations).map((a) => a.texture),
    ...Object.values(data.enemies).map((e) => e.texture),
    ...Object.values(data.props),
    ...Object.values(data.ui),
  ];
}
