/**
 * The paper doll's sprite sheet in the worn armor and cape colours, as a data URL for a CSS
 * background. Uses the same pixel rules as the in-game gear layer, so the doll and the wanderer
 * always match.
 */
import { recolorCapePixels, recolorPixels, type ArmorLook } from '../view/gearLook';

const cache = new Map<string, Promise<string>>();

/** Resolves to a recoloured copy of the sheet, or to the original URL if the canvas is unavailable. */
export function recolorSheetUrl(
  url: string,
  key: string,
  armor: ArmorLook | null,
  cape: ArmorLook | null
): Promise<string> {
  if (!armor && !cape) return Promise.resolve(url);
  const cacheKey = `${url}|${key}`;
  let pending = cache.get(cacheKey);
  if (!pending) {
    pending = new Promise<string>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(url);
          return;
        }
        ctx.canvas.width = image.naturalWidth;
        ctx.canvas.height = image.naturalHeight;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (armor) recolorPixels(data.data, armor);
        if (cape) recolorCapePixels(data.data, cape);
        ctx.putImageData(data, 0, 0);
        resolve(ctx.canvas.toDataURL('image/png'));
      };
      image.onerror = () => resolve(url);
      image.src = url;
    });
    cache.set(cacheKey, pending);
  }
  return pending;
}
