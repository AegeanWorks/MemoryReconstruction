/**
 * World System - Procedural world generation and chunk management
 *
 * Implements infinite 2D world with deterministic generation,
 * biome system, and streaming chunks for RLM compatibility.
 */

import type { EventBus } from '@core/EventBus';
import type { IGameModule, ModuleContext, ModuleState } from '@core/ModuleRegistry';
import type { GameplayConfig } from '@core/ConfigManager';
import type { RenderSystem } from '@graphics/RenderSystem';
import { resolveTileColor } from './tileColors';

export const TILE_SIZE = 32;

export interface ChunkData {
  x: number;
  y: number;
  biome: BiomeType;
  tiles: TileData[][];
  entities: EntitySpawnData[];
  generated: boolean;
  timestamp: number;
}

export interface TileData {
  type: TileType;
  variant: number;
  height: number;
  properties: TileProperties;
}

export interface TileProperties {
  solid: boolean;
  damage?: number;
  slippery?: boolean;
  climbable?: boolean;
  interactive?: string;
}

export interface EntitySpawnData {
  type: string;
  x: number;
  y: number;
  properties: Record<string, any>;
}

export type BiomeType = 'ruins' | 'forest' | 'caves' | 'crystal' | 'void' | 'sanctuary';

export type TileType =
  'empty' | 'floor' | 'wall' | 'platform' | 'hazard' | 'water' | 'ladder' | 'door' | 'secret';

export interface BiomeConfig {
  name: BiomeType;
  weight: number;
  tilePalette: TileType[];
  entityTables: EntityTable[];
  colorPalette: number[];
  musicTheme: string;
  ambientSound: string;
}

export interface EntityTable {
  entityType: string;
  weight: number;
  minDepth: number;
  maxDepth: number;
  conditions?: string[];
}

export class WorldSystem implements IGameModule {
  readonly name = 'worldSystem';
  readonly version = '1.0.0';
  readonly dependencies = ['renderSystem'];
  readonly tokenBudget = 3000;

  private eventBus: EventBus;
  private config: GameplayConfig;
  private renderSystem!: RenderSystem;

  // World state
  private seed: number;
  private rng: () => number;
  private chunks = new Map<string, ChunkData>();
  private loadedChunks = new Set<string>();
  private chunkSize: number;
  private viewDistance: number;

  // Streaming checkpoint: chunk streaming only changes when the player's chunk changes.
  private lastChunkX: number | null = null;
  private lastChunkY: number | null = null;
  // Chunk-derived depth (matching the entity spawn tables), emitted on crossings.
  private lastDepth = 0;

  // Biomes
  private biomes: BiomeConfig[] = [];
  private currentBiome: BiomeType = 'ruins';

  // Generation
  private generationQueue: Array<{ x: number; y: number; priority: number }> = [];
  private generating = false;

  constructor(eventBus: EventBus, config: GameplayConfig) {
    this.eventBus = eventBus;
    this.config = config;
    this.chunkSize = config.world.chunkSize;
    this.viewDistance = config.world.viewDistance;
    this.seed = config.world.seed;
    this.rng = this.createRNG(this.seed);
  }

  private createRNG(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  async initialize(context: ModuleContext): Promise<void> {
    this.renderSystem = context.sharedState.get('renderSystem');

    // Initialize biomes
    this.initializeBiomes();

    // Generate initial chunks around spawn
    const spawnChunks = this.getChunksInRadius(0, 0, this.viewDistance);
    for (const { x, y } of spawnChunks) {
      this.queueChunkGeneration(x, y, 10);
    }

    // Process generation queue
    this.processGenerationQueue();

    // Event listeners
    this.eventBus.on('world:requestChunk', (data: any) => this.ensureChunk(data.x, data.y));
    this.eventBus.on('player:position', (data: any) => this.onPlayerMove(data));
    this.eventBus.on('world:transition', (data: any) => this.onBiomeTransition(data));

    this.eventBus.emit('worldSystem:ready', { seed: this.seed });
  }

  private initializeBiomes(): void {
    this.biomes = [
      {
        name: 'ruins',
        weight: 30,
        tilePalette: ['floor', 'wall', 'platform', 'secret'],
        entityTables: [
          { entityType: 'scavenger', weight: 10, minDepth: 0, maxDepth: 10 },
          { entityType: 'guardian', weight: 3, minDepth: 5, maxDepth: 20 },
          { entityType: 'memoryEcho', weight: 5, minDepth: 0, maxDepth: 50 },
          { entityType: 'memoryFragment', weight: 4, minDepth: 0, maxDepth: 50 },
        ],
        colorPalette: [0x8b7355, 0x6b5b4a, 0xa08a6e, 0x4a3f35],
        musicTheme: 'exploration',
        ambientSound: 'wind_ruins',
      },
      {
        name: 'forest',
        weight: 25,
        tilePalette: ['floor', 'platform', 'water', 'ladder', 'hazard'],
        entityTables: [
          { entityType: 'wildling', weight: 8, minDepth: 0, maxDepth: 15 },
          { entityType: 'spirit', weight: 4, minDepth: 10, maxDepth: 30 },
          { entityType: 'memoryFragment', weight: 3, minDepth: 0, maxDepth: 50 },
        ],
        colorPalette: [0x2d5016, 0x3d6b1f, 0x1b3a0f, 0x4e7b2a],
        musicTheme: 'exploration',
        ambientSound: 'forest_ambience',
      },
      {
        name: 'caves',
        weight: 20,
        tilePalette: ['floor', 'wall', 'platform', 'hazard', 'water', 'ladder'],
        entityTables: [
          { entityType: 'caveDweller', weight: 12, minDepth: 0, maxDepth: 20 },
          { entityType: 'crystalGolem', weight: 3, minDepth: 15, maxDepth: 40 },
          { entityType: 'shadow', weight: 6, minDepth: 10, maxDepth: 50 },
          { entityType: 'memoryFragment', weight: 3, minDepth: 0, maxDepth: 50 },
        ],
        colorPalette: [0x2c2c3a, 0x3a3a4e, 0x1e1e28, 0x4a4a6a],
        musicTheme: 'combat',
        ambientSound: 'cave_drips',
      },
      {
        name: 'crystal',
        weight: 15,
        tilePalette: ['floor', 'platform', 'hazard', 'secret'],
        entityTables: [
          { entityType: 'crystalGuardian', weight: 5, minDepth: 10, maxDepth: 30 },
          { entityType: 'prismEntity', weight: 4, minDepth: 20, maxDepth: 50 },
          { entityType: 'memoryFragment', weight: 8, minDepth: 0, maxDepth: 50 },
        ],
        colorPalette: [0x8a2be2, 0x9932cc, 0xba55d3, 0xda70d6],
        musicTheme: 'combat',
        ambientSound: 'crystal_hum',
      },
      {
        name: 'void',
        weight: 5,
        tilePalette: ['floor', 'hazard', 'platform', 'secret'],
        entityTables: [
          { entityType: 'voidWalker', weight: 3, minDepth: 30, maxDepth: 100 },
          { entityType: 'forgotten', weight: 2, minDepth: 40, maxDepth: 100 },
          { entityType: 'memoryFragment', weight: 10, minDepth: 20, maxDepth: 100 },
        ],
        colorPalette: [0x0a0a0f, 0x1a1a2e, 0x16213e, 0x0f3460],
        musicTheme: 'boss',
        ambientSound: 'void_silence',
      },
      {
        name: 'sanctuary',
        weight: 5,
        tilePalette: ['floor', 'platform', 'door', 'secret'],
        entityTables: [
          { entityType: 'keeper', weight: 1, minDepth: 40, maxDepth: 100 },
          { entityType: 'memoryEcho', weight: 10, minDepth: 0, maxDepth: 50 },
          { entityType: 'memoryFragment', weight: 5, minDepth: 0, maxDepth: 50 },
        ],
        colorPalette: [0xffd700, 0xffa500, 0xff8c00, 0xffffe0],
        musicTheme: 'victory',
        ambientSound: 'sanctuary_peace',
      },
    ];
  }

  private onPlayerMove(data: { x: number; y: number }): void {
    const chunkX = Math.floor(data.x / this.chunkSize);
    const chunkY = Math.floor(data.y / this.chunkSize);

    // The set of chunks to stream depends only on the player's chunk, so a position update that
    // stays inside the same chunk does no work. This removes the per-frame chunk loop that made
    // corner navigation stutter.
    if (chunkX === this.lastChunkX && chunkY === this.lastChunkY) return;
    this.lastChunkX = chunkX;
    this.lastChunkY = chunkY;

    // Load chunks around player
    const chunks = this.getChunksInRadius(chunkX, chunkY, this.viewDistance);
    for (const { x, y } of chunks) {
      this.ensureChunk(x, y);
    }

    // Unload distant chunks
    this.unloadDistantChunks(chunkX, chunkY);

    // Depth uses the same chunk-unit formula as generateEntities(), so run
    // progress and enemy scaling agree on what "depth 10" means.
    const depth = Math.sqrt(chunkX * chunkX + chunkY * chunkY) * 0.5;
    if (depth !== this.lastDepth) {
      this.lastDepth = depth;
      this.eventBus.emit('world:depthChanged', { depth, chunkX, chunkY });
    }

    // Check biome transition
    this.checkBiomeTransition(data.x, data.y);
  }

  private checkBiomeTransition(x: number, y: number): void {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkY = Math.floor(y / this.chunkSize);
    const chunkKey = `${chunkX},${chunkY}`;
    const chunk = this.chunks.get(chunkKey);

    if (chunk && chunk.biome !== this.currentBiome) {
      this.currentBiome = chunk.biome;
      const biomeConfig = this.biomes.find((b) => b.name === chunk.biome);
      if (biomeConfig) {
        this.eventBus.emit('world:biomeChanged', {
          biome: chunk.biome,
          config: biomeConfig,
        });
      }
    }
  }

  private onBiomeTransition(data: { biome: BiomeType }): void {
    this.currentBiome = data.biome;
  }

  private getChunksInRadius(
    cx: number,
    cy: number,
    radius: number
  ): Array<{ x: number; y: number }> {
    const chunks: Array<{ x: number; y: number }> = [];
    for (let x = cx - radius; x <= cx + radius; x++) {
      for (let y = cy - radius; y <= cy + radius; y++) {
        chunks.push({ x, y });
      }
    }
    return chunks;
  }

  private ensureChunk(x: number, y: number): void {
    const key = `${x},${y}`;
    const cached = this.chunks.get(key);

    if (cached) {
      if (this.loadedChunks.has(key)) return;

      // Chunks stay cached after streaming out. Reattach and re-render the
      // cached chunk instead of leaving a hole in the world when the player returns.
      this.loadedChunks.add(key);
      this.renderChunk(cached);
      this.eventBus.emit('world:chunkGenerated', { chunk: cached });
      return;
    }

    this.queueChunkGeneration(x, y, 5);
  }

  private queueChunkGeneration(x: number, y: number, priority: number): void {
    const key = `${x},${y}`;
    if (this.chunks.has(key)) return;
    if (this.generationQueue.some((c) => c.x === x && c.y === y)) return;

    this.generationQueue.push({ x, y, priority });
    this.generationQueue.sort((a, b) => b.priority - a.priority);
  }

  private async processGenerationQueue(): Promise<void> {
    if (this.generating || this.generationQueue.length === 0) return;

    this.generating = true;

    while (this.generationQueue.length > 0) {
      const task = this.generationQueue.shift()!;
      await this.generateChunk(task.x, task.y);

      // Yield to main thread
      await new Promise((r) => setTimeout(r, 0));
    }

    this.generating = false;
  }

  private async generateChunk(x: number, y: number): Promise<ChunkData> {
    const key = `${x},${y}`;

    // Determine biome using noise
    const biome = this.determineBiome(x, y);
    const biomeConfig = this.biomes.find((b) => b.name === biome)!;

    // Generate tiles first and register the chunk before spawning entities:
    // isValidSpawnPosition reads the chunk from this map, so setting it only
    // after generation made every spawn position look valid (enemies could
    // appear inside walls, water or hazards).
    const tiles = this.generateTiles(x, y, biomeConfig);
    const chunk: ChunkData = {
      x,
      y,
      biome,
      tiles,
      entities: [],
      generated: true,
      timestamp: Date.now(),
    };
    this.chunks.set(key, chunk);

    // Generate entities against the real generated tiles.
    chunk.entities = this.generateEntities(x, y, biomeConfig);

    this.loadedChunks.add(key);

    // Render chunk
    this.renderChunk(chunk);

    this.eventBus.emit('world:chunkGenerated', { chunk });

    return chunk;
  }

  private determineBiome(x: number, y: number): BiomeType {
    // Use noise to determine biome
    const noise = this.getNoise(x * 0.01, y * 0.01, 0);
    const depthNoise = this.getNoise(x * 0.005, y * 0.005, 1);

    // Depth increases as you go further from origin
    const distance = Math.sqrt(x * x + y * y);
    const depth = distance * 0.5 + depthNoise * 10;

    // Biome selection based on noise and depth
    let accumulated = 0;
    const totalWeight = this.biomes.reduce((sum, b) => sum + b.weight, 0);
    const threshold = noise * totalWeight;

    for (const biome of this.biomes) {
      accumulated += biome.weight;
      if (threshold < accumulated) {
        // Check depth constraints
        const hasValidEntities = biome.entityTables.some(
          (t) => depth >= t.minDepth && depth <= t.maxDepth
        );
        if (hasValidEntities || biome.name === 'ruins') {
          return biome.name;
        }
      }
    }

    return 'ruins';
  }

  private generateTiles(x: number, y: number, _biome: BiomeConfig): TileData[][] {
    const tiles: TileData[][] = [];
    const width = 16;
    const height = 16;

    // Initialize all tiles as empty space
    for (let ty = 0; ty < height; ty++) {
      const row: TileData[] = [];
      for (let tx = 0; tx < width; tx++) {
        row.push({
          type: 'empty',
          variant: 0,
          height: 0,
          properties: { solid: false },
        });
      }
      tiles.push(row);
    }

    const setTile = (
      tx: number,
      ty: number,
      type: TileType,
      variant = 0,
      extraProps: Partial<TileProperties> = {}
    ) => {
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) return;
      const isSolid = type === 'floor' || type === 'wall' || type === 'platform';
      const properties: TileProperties = {
        solid: isSolid,
        ...(type === 'hazard' ? { damage: 10 } : {}),
        ...(type === 'ladder' ? { climbable: true } : {}),
        ...extraProps,
      };
      tiles[ty][tx] = {
        type,
        variant,
        height: isSolid ? 1 : 0,
        properties,
      };
    };

    const fillH = (
      x1: number,
      x2: number,
      ty: number,
      type: TileType,
      variantMod = 4,
      props?: Partial<TileProperties>
    ) => {
      for (let tx = x1; tx <= x2; tx++) {
        const v = Math.abs(this.hash(x * 100 + tx, y * 100 + ty)) % variantMod;
        setTile(tx, ty, type, v, props);
      }
    };

    const fillV = (
      tx: number,
      y1: number,
      y2: number,
      type: TileType,
      variantMod = 4,
      props?: Partial<TileProperties>
    ) => {
      for (let ty = y1; ty <= y2; ty++) {
        const v = Math.abs(this.hash(x * 100 + tx, y * 100 + ty)) % variantMod;
        setTile(tx, ty, type, v, props);
      }
    };

    // Deterministic room archetype selection based on coordinates
    const isSpawn = x === 0 && y === 0;
    const seed = Math.abs(this.hash(x * 73856093, y * 19349663));
    const archetype = isSpawn ? 0 : seed % 6;

    // Bedrock foundation at bottom: ty = 14..15 is always solid bedrock across all chunks
    fillH(0, 15, 15, 'wall');

    switch (archetype) {
      case 0: // Grand Promenade / Spawn Sanctuary
        // Continuous main floor at ty = 12..13
        fillH(0, 15, 12, 'floor');
        fillH(0, 15, 13, 'wall');
        fillH(0, 15, 14, 'wall');
        // Mid-level platform walkway
        fillH(3, 12, 8, 'platform');
        // Upper balcony ledges
        fillH(1, 4, 5, 'platform');
        fillH(11, 14, 5, 'platform');
        // Ladders connecting tiers
        fillV(4, 5, 11, 'ladder');
        fillV(11, 5, 11, 'ladder');
        // Architectural framing pillars
        fillV(1, 0, 3, 'wall');
        fillV(14, 0, 3, 'wall');
        break;

      case 1: // Stepped Ruins / Terraced Hall
        // Left terrace
        fillH(0, 4, 12, 'floor');
        fillH(0, 4, 13, 'wall');
        fillH(0, 4, 14, 'wall');
        // Center raised terrace
        fillH(5, 10, 9, 'floor');
        fillH(5, 10, 10, 'wall');
        fillH(5, 10, 11, 'wall');
        fillH(5, 10, 12, 'wall');
        fillH(5, 10, 13, 'wall');
        fillH(5, 10, 14, 'wall');
        // Right terrace
        fillH(11, 15, 12, 'floor');
        fillH(11, 15, 13, 'wall');
        fillH(11, 15, 14, 'wall');
        // Steps/platforms connecting terraces
        setTile(4, 11, 'platform');
        setTile(11, 11, 'platform');
        // Upper platform
        fillH(3, 12, 5, 'platform');
        fillV(7, 5, 8, 'ladder');
        break;

      case 2: // Sunken Reservoir / Overpass Bridge
        // Solid floor on left and right borders
        fillH(0, 4, 12, 'floor');
        fillH(0, 4, 13, 'wall');
        fillH(0, 4, 14, 'wall');
        fillH(11, 15, 12, 'floor');
        fillH(11, 15, 13, 'wall');
        fillH(11, 15, 14, 'wall');
        // Sunken water basin in center
        fillH(5, 10, 13, 'water');
        fillH(5, 10, 14, 'water');
        // Overhead bridge spanning the water
        fillH(4, 11, 10, 'platform');
        // Upper balcony and ladder
        fillH(1, 6, 6, 'platform');
        fillV(3, 6, 11, 'ladder');
        break;

      case 3: // Hazard Pit with Stepping Platforms
        // Solid borders
        fillH(0, 3, 12, 'floor');
        fillH(0, 3, 13, 'wall');
        fillH(0, 3, 14, 'wall');
        fillH(12, 15, 12, 'floor');
        fillH(12, 15, 13, 'wall');
        fillH(12, 15, 14, 'wall');
        // Recessed spike pit at bottom
        fillH(4, 11, 14, 'hazard');
        // Stepping platforms across pit
        fillH(4, 6, 11, 'platform');
        fillH(7, 8, 9, 'platform');
        fillH(9, 11, 11, 'platform');
        // Upper walkway with ladder
        fillH(2, 13, 5, 'platform');
        fillV(2, 5, 11, 'ladder');
        break;

      case 4: // Twin Towers / Vertical Transit Chamber
        // Ground floor
        fillH(0, 15, 12, 'floor');
        fillH(0, 15, 13, 'wall');
        fillH(0, 15, 14, 'wall');
        // Vertical ladder shafts
        fillV(2, 0, 11, 'ladder');
        fillV(13, 0, 11, 'ladder');
        // Multi-level walkways
        fillH(3, 12, 8, 'platform');
        fillH(3, 12, 4, 'platform');
        // Fortress columns
        fillV(1, 0, 11, 'wall');
        fillV(14, 0, 11, 'wall');
        // Passage opening in fortress walls at ground level
        setTile(1, 10, 'empty');
        setTile(1, 11, 'empty');
        setTile(14, 10, 'empty');
        setTile(14, 11, 'empty');
        break;

      case 5: // Altar of Memories & Secret Crypt
        // Ground floor
        fillH(0, 15, 12, 'floor');
        fillH(0, 15, 13, 'wall');
        fillH(0, 15, 14, 'wall');
        // Raised central dais
        fillH(6, 9, 11, 'floor');
        // Upper platform ledges
        fillH(1, 5, 7, 'platform');
        fillH(10, 14, 7, 'platform');
        fillV(5, 7, 11, 'ladder');
        fillV(10, 7, 11, 'ladder');
        // Secret wall leading to a hidden nook on the right
        setTile(14, 11, 'secret');
        setTile(15, 11, 'secret');
        break;
    }

    return tiles;
  }

  private generateEntities(x: number, y: number, biome: BiomeConfig): EntitySpawnData[] {
    const entities: EntitySpawnData[] = [];
    const chunkPixelSize = this.chunkSize;
    const distance = Math.sqrt(x * x + y * y);
    const depth = distance * 0.5;

    for (const table of biome.entityTables) {
      if (depth < table.minDepth || depth > table.maxDepth) continue;

      // Determine spawn count based on weight and chunk size
      const expectedCount = (table.weight / 100) * (chunkPixelSize / 512) * 10;
      const count = Math.floor(expectedCount) + (this.rng() < expectedCount % 1 ? 1 : 0);

      for (let i = 0; i < count; i++) {
        // Find valid spawn position
        let spawnX = 0,
          spawnY = 0;
        let attempts = 0;

        do {
          spawnX = x * chunkPixelSize + this.rng() * chunkPixelSize;
          spawnY = y * chunkPixelSize + this.rng() * chunkPixelSize;
          attempts++;
        } while (attempts < 10 && !this.isValidSpawnPosition(spawnX, spawnY, x, y));

        if (attempts < 10) {
          entities.push({
            type: table.entityType,
            x: spawnX,
            y: spawnY,
            properties: {
              biome: biome.name,
              depth,
              patrolRadius: 100 + this.rng() * 200,
            },
          });
        }
      }
    }

    return entities;
  }

  private isValidSpawnPosition(x: number, y: number, chunkX: number, chunkY: number): boolean {
    const key = `${chunkX},${chunkY}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return true; // Not generated yet, assume valid

    const { tx, ty } = this.tileIndexWithinChunk(x, y);

    if (ty < 0 || ty >= chunk.tiles.length) return false;
    const row = chunk.tiles[ty];
    if (!row || tx < 0 || tx >= row.length) return false;

    const tile = row[tx];
    return tile.type === 'floor' || tile.type === 'platform';
  }

  /**
   * Local tile indices for a world coordinate. Uses a floored modulo so a negative coordinate in a
   * negative chunk maps to the correct tile instead of a negative index (`-5 % 512` is `-5` in JS).
   */
  private tileIndexWithinChunk(worldX: number, worldY: number): { tx: number; ty: number } {
    const localX = worldX - Math.floor(worldX / this.chunkSize) * this.chunkSize;
    const localY = worldY - Math.floor(worldY / this.chunkSize) * this.chunkSize;
    return { tx: Math.floor(localX / TILE_SIZE), ty: Math.floor(localY / TILE_SIZE) };
  }

  private renderChunk(chunk: ChunkData): void {
    if (!this.renderSystem) return;

    const layer = this.renderSystem.getLayer('background');
    if (!layer) return;

    // Batch every tile of the chunk into one Graphics: a 512px chunk is 256 tiles, so a single
    // display object instead of 256 keeps the scene graph roughly 250x smaller and removes the
    // per-tile object churn that stalled the frame when chunks streamed in.
    const gfx = new PIXI.Graphics();
    gfx.label = `chunk_${chunk.x}_${chunk.y}`;

    const biomeConfig = this.biomes.find((b) => b.name === chunk.biome)!;

    for (let ty = 0; ty < chunk.tiles.length; ty++) {
      for (let tx = 0; tx < chunk.tiles[ty].length; tx++) {
        const tile = chunk.tiles[ty][tx];
        if (tile.type === 'empty') continue;

        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;
        const texture = this.renderSystem.getTileTexture(chunk.biome, tile.type, tile.variant);

        if (texture) {
          gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
          // 'local' fits the frame to the tile; the matrix maps the atlas frame's UV rect onto the
          // tile so a batched texture fill shows the right tile instead of the whole atlas page.
          gfx.fill({ texture, textureSpace: 'local', matrix: this.tileFillMatrix(texture) });
          continue;
        }

        const color = this.getTileColor(tile, biomeConfig);
        gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
        gfx.fill({ color, alpha: tile.type === 'hazard' ? 0.6 : 1 });

        if (tile.properties.solid) {
          gfx.rect(px, py, TILE_SIZE, TILE_SIZE);
          gfx.stroke({ color: 0x000000, width: 1, alpha: 0.3 });
        }
      }
    }

    gfx.position.set(chunk.x * this.chunkSize, chunk.y * this.chunkSize);
    layer.addChild(gfx);
  }

  private getTileColor(tile: TileData, biome: BiomeConfig): number {
    return resolveTileColor(tile, biome);
  }

  /**
   * The fill matrix that maps a tile's local rect onto the atlas frame's UV rect, so a batched
   * texture fill samples exactly one frame of a multi-tile tileset texture.
   * Assumes the atlas frame UV rect is axis-aligned (no rotation/shear). If the atlas pipeline
   * changes to support rotated frames, recompute the matrix with a full 3×3 or 4×4 texture transform.
   */
  private tileFillMatrix(texture: PIXI.Texture): PIXI.Matrix {
    const uvs = texture.uvs;
    const minX = Math.min(uvs.x0, uvs.x1, uvs.x2, uvs.x3);
    const minY = Math.min(uvs.y0, uvs.y1, uvs.y2, uvs.y3);
    const width = Math.max(uvs.x0, uvs.x1, uvs.x2, uvs.x3) - minX;
    const height = Math.max(uvs.y0, uvs.y1, uvs.y2, uvs.y3) - minY;
    return new PIXI.Matrix(1 / width, 0, 0, 1 / height, -minX / width, -minY / height);
  }

  private unloadDistantChunks(playerChunkX: number, playerChunkY: number): void {
    const unloadDistance = this.viewDistance + 2;

    for (const key of this.loadedChunks) {
      const [x, y] = key.split(',').map(Number);
      const dx = Math.abs(x - playerChunkX);
      const dy = Math.abs(y - playerChunkY);

      if (dx > unloadDistance || dy > unloadDistance) {
        this.unloadChunk(x, y);
      }
    }
  }

  private unloadChunk(x: number, y: number): void {
    const key = `${x},${y}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    // Remove from render layer
    const layer = this.renderSystem?.getLayer('background');
    if (layer) {
      const container = layer.getChildByLabel(`chunk_${x}_${y}`);
      if (container) {
        layer.removeChild(container);
        container.destroy({ children: true });
      }
    }

    this.loadedChunks.delete(key);
    this.eventBus.emit('world:chunkUnloaded', { x, y });
  }

  private getNoise(x: number, y: number, seed: number): number {
    // Integer hash computed directly: the old Map<string> cache allocated a fresh key string per
    // call and grew without bound for the lifetime of the world. The hash is deterministic, so
    // caching bought nothing but leaked memory; the noise stream is unchanged.
    const n = this.hash(x * 1000 + seed, y * 1000 + seed);
    return (n / 0x100000000) * 2 - 1;
  }

  private hash(x: number, y: number): number {
    let h = (x * 1664525 + 1013904223) ^ (y * 1664525 + 1013904223);
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = h ^ (h >>> 16);
    return h >>> 0;
  }

  // Public API

  getChunk(x: number, y: number): ChunkData | undefined {
    return this.chunks.get(`${x},${y}`);
  }

  getTileAt(worldX: number, worldY: number): TileData | null {
    const chunkX = Math.floor(worldX / this.chunkSize);
    const chunkY = Math.floor(worldY / this.chunkSize);
    const chunk = this.chunks.get(`${chunkX},${chunkY}`);
    if (!chunk) return null;

    const { tx, ty } = this.tileIndexWithinChunk(worldX, worldY);

    if (ty < 0 || ty >= chunk.tiles.length) return null;
    const row = chunk.tiles[ty];
    if (!row || tx < 0 || tx >= row.length) return null;

    return row[tx];
  }

  isSolidAt(worldX: number, worldY: number): boolean {
    const tile = this.getTileAt(worldX, worldY);
    return tile?.properties.solid ?? false;
  }

  getBiomeAt(worldX: number, worldY: number): BiomeType {
    const chunkX = Math.floor(worldX / this.chunkSize);
    const chunkY = Math.floor(worldY / this.chunkSize);
    const chunk = this.chunks.get(`${chunkX},${chunkY}`);
    return chunk?.biome ?? 'ruins';
  }

  getSpawnEntities(chunkX: number, chunkY: number): EntitySpawnData[] {
    const chunk = this.chunks.get(`${chunkX},${chunkY}`);
    return chunk?.entities ?? [];
  }

  getLoadedChunks(): ChunkData[] {
    const loaded: ChunkData[] = [];
    for (const key of this.loadedChunks) {
      const chunk = this.chunks.get(key);
      if (chunk) loaded.push(chunk);
    }
    return loaded;
  }

  getCurrentChunk(): { x: number; y: number } | null {
    if (this.lastChunkX === null || this.lastChunkY === null) {
      return { x: 0, y: 0 };
    }
    return { x: this.lastChunkX, y: this.lastChunkY };
  }

  getActiveChunks(): string[] {
    return Array.from(this.loadedChunks);
  }

  update(_deltaTime: number): void {
    // Process generation queue periodically
    if (this.generationQueue.length > 0 && !this.generating) {
      this.processGenerationQueue();
    }
  }

  async shutdown(): Promise<void> {
    // Unload all chunks
    for (const key of this.loadedChunks) {
      const [x, y] = key.split(',').map(Number);
      this.unloadChunk(x, y);
    }
    this.chunks.clear();
    this.loadedChunks.clear();
  }

  serialize(): ModuleState {
    return {
      version: this.version,
      timestamp: Date.now(),
      data: {
        seed: this.seed,
        currentBiome: this.currentBiome,
        loadedChunks: Array.from(this.loadedChunks),
        chunks: Array.from(this.chunks.entries()).map(([key, chunk]) => [key, chunk]),
      },
      checksum: 'world',
    };
  }

  deserialize(state: ModuleState): void {
    if (state.data.seed) this.seed = state.data.seed;
    if (state.data.currentBiome) this.currentBiome = state.data.currentBiome;
    if (state.data.loadedChunks) this.loadedChunks = new Set(state.data.loadedChunks);
    if (state.data.chunks) {
      this.chunks = new Map(state.data.chunks);
      // Re-render loaded chunks
      for (const chunk of this.chunks.values()) {
        if (this.loadedChunks.has(`${chunk.x},${chunk.y}`)) {
          this.renderChunk(chunk);
        }
      }
    }
  }
}

// Need to import PIXI for the renderChunk method
import * as PIXI from 'pixi.js';
