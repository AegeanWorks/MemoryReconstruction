/**
 * Static floor rendering: tile sprites grouped into chunks (hidden when off
 * screen), animated door barriers and glyph lights.
 */
import { Container, Graphics, Sprite, TilingSprite, type Texture } from 'pixi.js';
import type { BiomeId } from '../sim/content';
import type { FloorMap } from '../sim/dungeon';
import { Deco, Tile, TILE_SIZE, type TileGrid } from '../sim/tiles';
import { fxTextures } from './fxArt';
import { BIOME_ART, hex } from './palette';
import { tileTextures } from './tileArt';

const CHUNK = 16;
/** Prop drawn for a freestanding one-tile obstacle, per biome (keys of sprite_atlas.json props). */
const OBSTACLE_PROPS: Record<BiomeId, string> = {
  ruins: 'statue',
  forest: 'ancient_tree',
  caves: 'crystal_cluster',
  crystal: 'crystal_cluster',
  ash: 'station_hearth',
  foundry: 'cog_pillar',
  abyss: 'coral',
  void: 'statue',
  frost: 'ice_spire',
  mire: 'ancient_tree',
  bloom: 'ancient_tree',
  hive: 'hive_comb',
  catacomb: 'bone_pile',
  sanctuary: 'sanctuary_altar',
};
const T = TILE_SIZE;

interface Chunk {
  container: Container;
  x0: number;
  y0: number;
}

/** Stable per-tile variant so a floor looks the same every time it's built. */
function variantAt(tx: number, ty: number, count: number): number {
  const h = Math.imul(tx * 374761393 + ty * 668265263, 1274126177) >>> 0;
  return (h >>> 13) % count;
}

export class LevelView {
  readonly root = new Container();
  /**
   * Obstacle props; the renderer puts them in the depth-sorted actor layer,
   * which then owns (and destroys) them.
   */
  readonly props: Sprite[] = [];
  private readonly chunks: Chunk[] = [];
  private readonly doors = new Graphics();
  private readonly glyphs: Sprite[] = [];
  private readonly accent: number;
  private readonly biome: BiomeId;
  private time = 0;

  constructor(
    private readonly floor: FloorMap,
    biome: BiomeId,
    private readonly propTextures: Record<string, Texture>,
    backdrop?: Texture
  ) {
    this.biome = biome;
    this.accent = hex(BIOME_ART[biome].accent);
    if (backdrop) this.addBackdrop(backdrop);
    this.build(biome);
    this.root.addChild(this.doors);
  }

  /**
   * A dim tiling backdrop under the floor so the void between rooms carries the
   * biome's atmosphere instead of reading as flat black.
   */
  private addBackdrop(texture: Texture): void {
    const grid = this.floor.grid;
    const bg = new TilingSprite({
      texture,
      width: grid.width * T,
      height: grid.height * T,
    });
    bg.scale.set(1);
    bg.alpha = 0.55;
    bg.tint = 0xffffff;
    this.root.addChild(bg);
  }

  private build(biome: BiomeId): void {
    const grid = this.floor.grid;
    const tex = tileTextures(biome);
    const glowLayer = new Container();
    for (let cy = 0; cy < grid.height; cy += CHUNK) {
      for (let cx = 0; cx < grid.width; cx += CHUNK) {
        const container = new Container();
        let used = false;
        for (let ty = cy; ty < Math.min(cy + CHUNK, grid.height); ty++) {
          for (let tx = cx; tx < Math.min(cx + CHUNK, grid.width); tx++) {
            used = this.addTile(container, glowLayer, grid, tex, tx, ty) || used;
          }
        }
        if (!used) continue;
        this.root.addChild(container);
        this.chunks.push({ container, x0: cx * T, y0: cy * T });
      }
    }
    this.root.addChild(glowLayer);
  }

  /** Adds the sprites for one tile; returns whether anything was drawn. */
  private addTile(
    container: Container,
    glowLayer: Container,
    grid: TileGrid,
    tex: ReturnType<typeof tileTextures>,
    tx: number,
    ty: number
  ): boolean {
    const tile = grid.get(tx, ty);
    const put = (texture: Texture, alpha = 1): void => {
      const s = new Sprite(texture);
      s.position.set(tx * T, ty * T);
      s.alpha = alpha;
      container.addChild(s);
    };
    const isFace = (x: number, y: number): boolean =>
      grid.get(x, y) === Tile.Wall && grid.isWalkable(x, y + 1);

    if (tile === Tile.Floor || tile === Tile.Door) {
      put(tex.floor[variantAt(tx, ty, tex.floor.length)]);
      const deco = grid.deco[grid.index(tx, ty)] as Deco;
      const decoTex = tex.deco[deco];
      if (decoTex) put(decoTex);
      if (deco === Deco.Glyph) this.addGlyphLight(glowLayer, tx, ty);
      if (tile === Tile.Door) put(tex.threshold);
      if (grid.get(tx, ty - 1) === Tile.Wall) put(tex.aoNorth);
      if (grid.get(tx - 1, ty) === Tile.Wall) put(tex.aoWest);
      if (grid.get(tx + 1, ty) === Tile.Wall) put(tex.aoEast);
      return true;
    }
    if (tile === Tile.Wall && this.isFreestanding(grid, tx, ty)) {
      put(tex.floor[variantAt(tx, ty, tex.floor.length)]);
      this.addProp(tx, ty);
      return true;
    }
    if (tile === Tile.Wall) {
      if (isFace(tx, ty)) put(tex.wallFace[variantAt(tx, ty, tex.wallFace.length)]);
      else put(isFace(tx, ty + 1) ? tex.wallCapLip : tex.wallCap);
      return true;
    }
    // Void directly above a wall face gets a cap, so outer walls have height.
    if (isFace(tx, ty + 1)) {
      put(tex.wallCapLip);
      return true;
    }
    return false;
  }

  /** A single wall tile with walkable tiles on all four sides. */
  private isFreestanding(grid: TileGrid, tx: number, ty: number): boolean {
    return (
      grid.isWalkable(tx - 1, ty) &&
      grid.isWalkable(tx + 1, ty) &&
      grid.isWalkable(tx, ty - 1) &&
      grid.isWalkable(tx, ty + 1)
    );
  }

  private addProp(tx: number, ty: number): void {
    const texture = this.propTextures[OBSTACLE_PROPS[this.biome]];
    if (!texture) return;
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.86);
    sprite.width = sprite.height = 60;
    sprite.position.set((tx + 0.5) * T, (ty + 1) * T - 2);
    sprite.zIndex = (ty + 1) * T;
    this.props.push(sprite);
  }

  private addGlyphLight(layer: Container, tx: number, ty: number): void {
    const glow = new Sprite(fxTextures().glow);
    glow.anchor.set(0.5);
    glow.position.set((tx + 0.5) * T, (ty + 0.5) * T);
    glow.width = glow.height = 56;
    glow.tint = this.accent;
    glow.blendMode = 'add';
    glow.alpha = 0.25;
    layer.addChild(glow);
    this.glyphs.push(glow);
  }

  /** Shows only chunks overlapping the view rectangle (world pixels) and animates doors. */
  update(dt: number, viewX: number, viewY: number, viewW: number, viewH: number): void {
    this.time += dt;
    const span = CHUNK * T;
    for (const chunk of this.chunks) {
      chunk.container.visible =
        chunk.x0 + span > viewX &&
        chunk.x0 < viewX + viewW &&
        chunk.y0 + span > viewY &&
        chunk.y0 < viewY + viewH;
    }
    for (let i = 0; i < this.glyphs.length; i++) {
      this.glyphs[i].alpha = 0.18 + 0.12 * Math.sin(this.time * 1.7 + i * 1.3);
    }
    this.drawDoors();
  }

  private drawDoors(): void {
    const g = this.doors;
    g.clear();
    const grid = this.floor.grid;
    const pulse = 0.55 + 0.25 * Math.sin(this.time * 6);
    for (const room of this.floor.rooms) {
      for (const door of room.doors) {
        const first = door.tiles[0];
        if (!grid.isDoorLocked(first.x, first.y)) continue;
        const vertical = door.direction === 'east' || door.direction === 'west';
        for (const t of door.tiles) {
          g.rect(t.x * T, t.y * T, T, T).fill({ color: 0x000000, alpha: 0.35 });
          // Energy bars across the opening.
          for (let i = 0; i < 4; i++) {
            const o = 4 + i * 8;
            if (vertical) g.rect(t.x * T + 12, t.y * T + o - 2, 8, 3);
            else g.rect(t.x * T + o - 2, t.y * T + 12, 3, 8);
          }
          g.fill({ color: this.accent, alpha: pulse });
          if (vertical) g.rect(t.x * T + 15, t.y * T, 2, T);
          else g.rect(t.x * T, t.y * T + 15, T, 2);
          g.fill({ color: 0xffffff, alpha: pulse * 0.8 });
        }
      }
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
