/**
 * Armor- and cape-coloured copies of the player's animation frames. Each frame is cut out of its
 * sheet, its robe pixels are re-mapped by `recolorPixels` and its cloak pixels by
 * `recolorCapePixels`; the result becomes a new texture. A set of frames is built once per
 * armor/cape pair, the first time that pair is worn, and then reused.
 */
import { Texture } from 'pixi.js';
import { recolorCapePixels, recolorPixels, type ArmorLook } from './gearLook';

/** Frame arrays are the cache key because an animation hands the same array to the sprite every time. */
const cache = new WeakMap<Texture[], Map<string, Texture[]>>();

function recolorTexture(
  texture: Texture,
  armor: ArmorLook | null,
  cape: ArmorLook | null
): Texture {
  const resource = texture.source.resource as CanvasImageSource | undefined;
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!resource || !ctx) return texture;
  const scale = texture.source.resolution || 1;
  const width = Math.round(texture.frame.width * scale);
  const height = Math.round(texture.frame.height * scale);
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  ctx.drawImage(
    resource,
    Math.round(texture.frame.x * scale),
    Math.round(texture.frame.y * scale),
    width,
    height,
    0,
    0,
    width,
    height
  );
  const image = ctx.getImageData(0, 0, width, height);
  if (armor) recolorPixels(image.data, armor);
  if (cape) recolorCapePixels(image.data, cape);
  ctx.putImageData(image, 0, 0);
  const out = Texture.from(ctx.canvas);
  out.source.scaleMode = texture.source.scaleMode;
  return out;
}

/** The frames re-coloured for one armor/cape pair; the same array comes back for the same inputs. */
export function recolorFrames(
  frames: Texture[],
  key: string,
  armor: ArmorLook | null,
  cape: ArmorLook | null
): Texture[] {
  if (!armor && !cape) return frames;
  let byLook = cache.get(frames);
  if (!byLook) {
    byLook = new Map();
    cache.set(frames, byLook);
  }
  let recolored = byLook.get(key);
  if (!recolored) {
    recolored = frames.map((frame) => recolorTexture(frame, armor, cape));
    byLook.set(key, recolored);
  }
  return recolored;
}
