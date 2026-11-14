/**
 * Armor-coloured copies of the player's animation frames. Each frame is cut out of its sheet, its robe
 * pixels are re-mapped by `recolorPixels`, and the result becomes a new texture. A set of frames is
 * built once per armor, the first time that armor is worn, and then reused.
 */
import { Texture } from 'pixi.js';
import { recolorPixels, type ArmorLook } from './gearLook';

/** Frame arrays are the cache key because an animation hands the same array to the sprite every time. */
const cache = new WeakMap<Texture[], Map<string, Texture[]>>();

function recolorTexture(texture: Texture, look: ArmorLook): Texture {
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
  recolorPixels(image.data, look);
  ctx.putImageData(image, 0, 0);
  const out = Texture.from(ctx.canvas);
  out.source.scaleMode = texture.source.scaleMode;
  return out;
}

/** The frames re-coloured for one armor; the same array comes back for the same inputs. */
export function recolorFrames(frames: Texture[], armorId: string, look: ArmorLook): Texture[] {
  let byArmor = cache.get(frames);
  if (!byArmor) {
    byArmor = new Map();
    cache.set(frames, byArmor);
  }
  let recolored = byArmor.get(armorId);
  if (!recolored) {
    recolored = frames.map((frame) => recolorTexture(frame, look));
    byArmor.set(armorId, recolored);
  }
  return recolored;
}
