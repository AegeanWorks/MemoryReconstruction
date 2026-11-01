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

/**
 * Small non-blocking clutter drawn along room walls, per biome. These are view
 * only: they never touch the simulation, so pickups, enemies and pathing are
 * unaffected. Keys must exist in sprite_atlas.json props.
 */
const ROOM_DRESSING: Record<BiomeId, string[]> = {
  ruins: ['barrel', 'furn_crate', 'bone_pile'],
  forest: ['furn_herbs', 'barrel', 'ancient_tree'],
  caves: ['furn_crate', 'bone_pile', 'barrel'],
  crystal: ['crystal_cluster', 'furn_lantern'],
  void: ['furn_candle', 'bone_pile'],
  sanctuary: ['furn_lantern', 'furn_planter'],
  ash: ['furn_brazier', 'barrel'],
  abyss: ['coral', 'furn_herbs'],
  frost: ['ice_spire', 'furn_crate'],
  bloom: ['furn_herbs', 'furn_planter', 'ancient_tree'],
  foundry: ['furn_crate', 'furn_lantern', 'cog_pillar'],
  mire: ['furn_herbs', 'bone_pile', 'ancient_tree'],
  hive: ['hive_comb', 'furn_crate'],
  catacomb: ['bone_pile', 'furn_candle'],
};

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
  private readonly torchGfx = new Graphics();
  private readonly glyphs: Sprite[] = [];
  private readonly torches: Array<{ x: number; y: number; tint: number; seed: number }> = [];
  private readonly accent: number;
  private readonly biome: BiomeId;
  private time = 0;

  constructor(
    private readonly floor: FloorMap,
    biome: BiomeId,
    private readonly propTextures: Record<string, Texture>,
    backdrop?: Texture,
    dressRooms = false
  ) {
    this.biome = biome;
    this.accent = hex(BIOME_ART[biome].accent);
    if (backdrop) this.addBackdrop(backdrop);
    this.build(biome);
    if (dressRooms) this.addDressing(biome);
    this.root.addChild(this.torchGfx, this.doors);
  }

  /**
   * Scatters a little wall clutter through each room so dungeon floors read as
   * lived-in places rather than empty stone. Placement is deterministic per
   * room and tile, and never lands on a doorway or a glyph.
   */
  private addDressing(biome: BiomeId): void {
    const kinds = ROOM_DRESSING[biome] ?? ROOM_DRESSING.ruins;
    const grid = this.floor.grid;
    const layer = new Container();
    for (const room of this.floor.rooms) {
      const seed = room.x * 7919 + room.y * 104729 + room.w * 31;
      const count = 1 + ((seed >>> 3) % 2);
      const candidates: Array<[number, number]> = [];
      for (let ty = room.y; ty < room.y + room.h; ty++) {
        for (let tx = room.x; tx < room.x + room.w; tx++) {
          const tile = grid.get(tx, ty);
          if (tile !== Tile.Floor) continue;
          // Along a wall base, so clutter frames the room instead of blocking it.
          if (grid.get(tx, ty - 1) !== Tile.Wall) continue;
          const deco = grid.deco[grid.index(tx, ty)] as Deco;
          if (deco === Deco.Glyph) continue;
          candidates.push([tx, ty]);
        }
      }
      if (candidates.length < 3) continue;
      for (let i = 0; i < count; i++) {
        const pick = candidates[(seed + i * 977) % candidates.length];
        const texture = this.propTextures[kinds[(seed + i * 37) % kinds.length]];
        if (!texture) continue;
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1);
        sprite.position.set(pick[0] * T + T / 2, pick[1] * T + T);
        sprite.scale.set(0.34);
        sprite.alpha = 0.92;
        layer.addChild(sprite);
      }
    }
    this.root.addChild(layer);
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
      const decoVariants = tex.deco[deco];
      if (decoVariants && decoVariants.length > 0) {
        put(decoVariants[variantAt(tx, ty, decoVariants.length)]);
      }
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
      if (isFace(tx, ty)) {
        put(tex.wallFace[variantAt(tx, ty, tex.wallFace.length)]);
        if (
          isFace(tx - 1, ty) &&
          isFace(tx + 1, ty) &&
          grid.get(tx, ty + 1) !== Tile.Door &&
          tx % 5 === 2
        ) {
          const tint =
            this.biome === 'crystal' || this.biome === 'frost'
              ? 0x6fe7ff
              : this.biome === 'void' || this.biome === 'abyss'
                ? 0xb86cff
                : this.biome === 'bloom' || this.biome === 'forest' || this.biome === 'sanctuary'
                  ? 0xffd98a
                  : 0xff8a2a;
          this.torches.push({
            x: tx * T + T * 0.5,
            y: ty * T + T * 0.45,
            tint,
            seed: (tx * 17 + ty * 31) % 100,
          });
        }
      } else {
        put(isFace(tx, ty + 1) ? tex.wallCapLip : tex.wallCap);
      }
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
    this.drawTorches(viewX, viewY, viewW, viewH);
  }

  /** Flickering wall torches and sconces with warm radial ambient light. */
  private drawTorches(viewX: number, viewY: number, viewW: number, viewH: number): void {
    const g = this.torchGfx;
    g.clear();
    const margin = 48;
    const t = this.time;
    for (const torch of this.torches) {
      if (
        torch.x < viewX - margin ||
        torch.x > viewX + viewW + margin ||
        torch.y < viewY - margin ||
        torch.y > viewY + viewH + margin
      ) {
        continue;
      }
      const flicker =
        0.82 + 0.18 * Math.sin(t * 8 + torch.seed * 3.7) * Math.cos(t * 13 + torch.seed);
      const px = torch.x;
      const py = torch.y;

      // 1. Ambient warm radial light cast onto the wall and floor
      g.circle(px, py + 8, 38).fill({
        color: torch.tint,
        alpha: 0.12 * flicker,
      });

      // 2. Iron wall bracket / sconce mount
      g.rect(px - 2, py + 5, 4, 6).fill({ color: 0x222028 });
      g.rect(px - 1, py + 5, 2, 6).fill({ color: 0x4a4655 });
      g.rect(px - 4, py + 3, 8, 2.5).fill({ color: 0x33303a });

      // 3. Torch wooden stick / holder
      g.rect(px - 1.5, py - 3, 3, 7).fill({ color: 0x6e4825 });

      // 4. Glowing ember core
      const flameH = 6 * flicker;
      g.poly([
        px - 3,
        py - 1,
        px + 3,
        py - 1,
        px + 1.5,
        py - flameH * 0.7,
        px,
        py - flameH - 2,
        px - 1.5,
        py - flameH * 0.7,
      ]).fill({
        color: torch.tint,
        alpha: 0.88,
      });

      // 5. Hot inner white flame tip
      g.poly([px - 1.5, py - 2, px + 1.5, py - 2, px, py - flameH * 0.6]).fill({
        color: 0xffffff,
        alpha: 0.95 * flicker,
      });
    }
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
      if (room.gates) {
        for (const gate of room.gates) {
          const isNorthOrSouth = gate.direction === 'north' || gate.direction === 'south';
          for (const t of gate.tiles) {
            const px = t.x * T;
            const py = t.y * T;
            // 1. Dark recessed alcove backing
            g.rect(px, py, T, T).fill({ color: 0x05040a, alpha: 0.96 });
            // 2. Iron portcullis vertical bars (with shadow and specular highlight)
            for (let i = 0; i < 4; i++) {
              const ox = 4 + i * 8;
              g.rect(px + ox - 1, py, 3, T).fill({ color: 0x3d3848 });
              g.rect(px + ox, py, 1.5, T).fill({ color: 0x827d92 });
              g.rect(px + ox + 0.5, py, 0.75, T).fill({ color: 0xb5b0c6 });
            }
            // 3. Horizontal cross-brace beams
            const crossOffsets = [8, 22];
            for (const oy of crossOffsets) {
              g.rect(px, py + oy - 1, T, 3.5).fill({ color: 0x2e2938 });
              g.rect(px, py + oy, T, 1.5).fill({ color: 0x6e687e });
              // Studded rivets at intersections
              for (let i = 0; i < 4; i++) {
                const ox = 4 + i * 8;
                g.circle(px + ox + 0.5, py + oy + 0.5, 1.25).fill({ color: 0xc8c2d8 });
              }
            }
            // 4. Pointed iron gate teeth / spikes pointing into the chamber
            if (isNorthOrSouth) {
              const tipY = gate.direction === 'north' ? py + T : py;
              const baseY = gate.direction === 'north' ? py + T - 4 : py + 4;
              for (let i = 0; i < 4; i++) {
                const ox = 4 + i * 8;
                g.poly([px + ox - 1.5, baseY, px + ox + 2.5, baseY, px + ox + 0.5, tipY]).fill({
                  color: 0xa8a2b8,
                });
              }
            } else {
              const tipX = gate.direction === 'west' ? px + T : px;
              const baseX = gate.direction === 'west' ? px + T - 4 : px + 4;
              for (let i = 0; i < 4; i++) {
                const oy = 4 + i * 8;
                g.poly([baseX, py + oy - 1.5, baseX, py + oy + 2.5, tipX, py + oy + 0.5]).fill({
                  color: 0xa8a2b8,
                });
              }
            }
            // 5. Ominous void threshold ember glow
            const glow = 0.28 + 0.14 * Math.sin(this.time * 3 + t.x * 2.1 + t.y);
            g.rect(px, py, T, T).stroke({
              width: 1.5,
              color: 0xff5a3a,
              alpha: glow,
            });
          }
        }
      }
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
