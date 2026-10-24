/**
 * Render System - 2.5D Graphics Engine
 *
 * Implements layered rendering with parallax, dynamic lighting,
 * particle systems, and post-processing for human-appealing visuals.
 *
 * Uses PixiJS v8 for WebGL/WebGPU rendering.
 */

import * as PIXI from 'pixi.js';
import { BloomFilter } from '@pixi/filter-bloom';
import { ColorMatrixFilter } from '@pixi/filter-color-matrix';
import type { EventBus } from '@core/EventBus';
import { GameEvents } from '@core/EventBus';
import type { IGameModule, ModuleContext, ModuleState } from '@core/ModuleRegistry';
import type { GraphicsConfig } from '@core/ConfigManager';
import type { AssetManager } from '@engine/AssetManager';
import spriteAtlas from '@data/sprite_atlas.json';
import { resolveAssetUrl } from '@utils/assetUrl';
import { loadTextureAtlas } from './TextureAtlas';
import type { TextureAtlas } from './TextureAtlas';

export interface LayerConfig {
  name: string;
  depth: number;
  parallaxFactor: number;
  visible: boolean;
}

export interface RenderStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  particles: number;
}

export class RenderSystem implements IGameModule {
  readonly name = 'renderSystem';
  readonly version = '1.0.0';
  readonly dependencies = ['assetManager'];
  readonly tokenBudget = 5000;

  private eventBus: EventBus;
  private config: GraphicsConfig;
  private assetManager!: AssetManager;

  // PixiJS Application
  private app: PIXI.Application | null = null;

  // Layer containers (back to front)
  private layers = new Map<string, PIXI.Container>();
  private layerOrder: string[] = ['background', 'midground', 'foreground', 'effects', 'ui'];

  // Camera
  private camera = {
    x: 0,
    y: 0,
    zoom: 1,
    rotation: 0,
    shake: { x: 0, y: 0, intensity: 0, time: 0 },
  };

  // Parallax backgrounds
  private parallaxLayers: Array<{
    container: PIXI.Container;
    factor: number;
    textures: PIXI.Texture[];
  }> = [];

  // Lighting
  private lightContainer: PIXI.Container | null = null;
  private lights = new Map<string, LightSource>();
  private ambientLight = { color: 0xffffff, intensity: 0.3 };

  // Particles
  private particleContainer: PIXI.Container | null = null;
  private particlePools = new Map<string, ParticlePool>();

  // Post-processing
  private postProcessEnabled = true;
  private bloomFilter: BloomFilter | null = null;
  private vignetteFilter: ColorMatrixFilter | null = null;
  private colorGradingFilter: ColorMatrixFilter | null = null;

  // Art
  private tilesetAtlases = new Map<string, TextureAtlas>();
  private backgroundTextures = new Map<string, PIXI.Texture>();
  private backdrop: PIXI.TilingSprite | null = null;
  private currentBiome = 'ruins';

  // Stats
  private stats: RenderStats = { fps: 0, drawCalls: 0, triangles: 0, textures: 0, particles: 0 };
  private lastStatsTime = 0;
  private frameCount = 0;

  constructor(eventBus: EventBus, config: GraphicsConfig) {
    this.eventBus = eventBus;
    this.config = config;
  }

  async initialize(context: ModuleContext): Promise<void> {
    this.assetManager = context.sharedState.get('assetManager');

    // Create PixiJS application
    this.app = new PIXI.Application();
    await this.app.init({
      width: this.config.resolution.width,
      height: this.config.resolution.height,
      resolution: this.config.resolution.pixelRatio,
      autoDensity: true,
      antialias: this.config.rendering.antialias,
      preserveDrawingBuffer: this.config.rendering.preserveDrawingBuffer,
      powerPreference: this.config.rendering.powerPreference,
      backgroundColor: this.config.rendering.backgroundColor,
      backgroundAlpha: 1,
    });

    // Add canvas to DOM
    const container = document.getElementById('game-container');
    if (container && this.app.canvas) {
      container.appendChild(this.app.canvas);
      this.app.canvas.style.width = '100%';
      this.app.canvas.style.height = '100%';
    }

    await this.loadArtTextures();

    // Setup layers
    this.createLayers();

    // Setup backdrop and lighting
    this.setupBackdrop();
    this.setupLighting();

    // Setup particles
    this.setupParticles();

    // Setup post-processing
    if (this.config.postProcessing.enabled) {
      this.setupPostProcessing();
    }

    // Setup resize handler
    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Start render loop
    this.app.ticker.add(this.render, this);

    // Event listeners
    this.setupEventListeners();

    this.eventBus.emit('renderSystem:ready', { app: this.app });
  }

  private async loadArtTextures(): Promise<void> {
    try {
      for (const [biome, definition] of Object.entries(spriteAtlas.tilesets)) {
        this.tilesetAtlases.set(
          biome,
          await loadTextureAtlas(
            definition.texture,
            definition.columns,
            definition.rows,
            definition.tileSize,
            definition.tileSize
          )
        );
      }
      for (const [biome, path] of Object.entries(spriteAtlas.backgrounds)) {
        this.backgroundTextures.set(
          biome,
          await PIXI.Assets.load<PIXI.Texture>(resolveAssetUrl(path))
        );
      }
    } catch (error) {
      console.warn('[RenderSystem] Art textures unavailable, using flat colors:', error);
    }
  }

  private setupBackdrop(): void {
    if (!this.app) return;
    const texture =
      this.backgroundTextures.get(this.currentBiome) ??
      this.backgroundTextures.values().next().value ??
      null;
    if (!texture) return;

    this.backdrop = new PIXI.TilingSprite({
      texture,
      width: this.app.screen.width,
      height: this.app.screen.height,
    });
    this.backdrop.label = 'backdrop';
    this.backdrop.alpha = 0.5;
    this.backdrop.zIndex = -1000;
    this.backdrop.eventMode = 'none';
    this.app.stage.addChild(this.backdrop);
    this.app.stage.sortChildren();
  }

  private updateBackdrop(): void {
    if (!this.backdrop || !this.app) return;
    const screen = this.app.screen;
    this.backdrop.position.set(this.camera.x - screen.width / 2, this.camera.y - screen.height / 2);
    this.backdrop.tilePosition.set(this.camera.x * 0.15, this.camera.y * 0.15);
  }

  private setBiomeBackdrop(biome: string): void {
    const texture = this.backgroundTextures.get(biome);
    if (!texture || !this.backdrop) return;
    this.currentBiome = biome;
    this.backdrop.texture = texture;
  }

  getTileTexture(biome: string, tileType: string, variant: number): PIXI.Texture | null {
    if (tileType === 'empty') return null;
    const definition = spriteAtlas.tilesets[biome as keyof typeof spriteAtlas.tilesets];
    if (!definition) return null;
    const row = definition.rowMap[tileType as keyof typeof definition.rowMap];
    if (row === undefined) return null;
    const atlas = this.tilesetAtlases.get(biome) ?? this.tilesetAtlases.get('ruins');
    if (!atlas) return null;
    const column = Math.min(Math.max(Math.floor(variant), 0), definition.columns - 1);
    return atlas.frameAt(column, row);
  }

  private createLayers(): void {
    if (!this.app) return;

    const stage = this.app.stage;

    for (const layerName of this.layerOrder) {
      const layerConfig = this.getLayerConfig(layerName);
      const container = new PIXI.Container();
      container.name = layerName;
      container.zIndex = layerConfig.depth;
      container.visible = layerConfig.visible;

      // Enable culling for performance
      container.cullable = true;
      container.cullArea = new PIXI.Rectangle(0, 0, this.app.screen.width, this.app.screen.height);

      this.layers.set(layerName, container);
      stage.addChild(container);
    }

    // Sort children by zIndex
    stage.sortChildren();
  }

  private getLayerConfig(name: string): LayerConfig {
    const depths = {
      background: this.config.layers.background,
      midground: this.config.layers.midground,
      foreground: this.config.layers.foreground,
      effects: this.config.layers.effects,
      ui: this.config.layers.ui,
    };

    const parallaxFactors = {
      background: 0.1,
      midground: 0.3,
      foreground: 0.6,
      effects: 0.8,
      ui: 0,
    };

    return {
      name,
      depth: depths[name as keyof typeof depths] ?? 0,
      parallaxFactor: parallaxFactors[name as keyof typeof parallaxFactors] ?? 0,
      visible: true,
    };
  }

  private setupLighting(): void {
    if (!this.app) return;

    this.lightContainer = new PIXI.Container();
    this.lightContainer.label = 'lights';
    this.layers.get('effects')?.addChild(this.lightContainer);
  }

  private setupParticles(): void {
    if (!this.app) return;

    this.particleContainer = new PIXI.Container();
    this.particleContainer.name = 'particles';
    this.layers.get('effects')?.addChild(this.particleContainer);
  }

  private setupPostProcessing(): void {
    if (!this.app) return;

    const filters: any[] = [];

    if (this.config.postProcessing.bloom) {
      this.bloomFilter = new BloomFilter({
        threshold: 0.8,
        bloomScale: 1.5,
        brightness: 1.2,
        blur: 4,
        quality: 0.5,
      } as any);
      filters.push(this.bloomFilter);
    }

    if (this.config.postProcessing.vignette) {
      this.vignetteFilter = new ColorMatrixFilter();
      this.applyVignette(this.vignetteFilter, 0.5);
      filters.push(this.vignetteFilter);
    }

    if (this.config.postProcessing.colorGrading) {
      this.colorGradingFilter = new ColorMatrixFilter();
      this.applyColorGrading(this.colorGradingFilter, 'cinematic');
      filters.push(this.colorGradingFilter);
    }

    if (filters.length > 0) {
      this.layers.get('effects')!.filters = filters as any;
    }
  }

  private applyVignette(filter: ColorMatrixFilter, _intensity: number): void {
    // Vignette via color matrix (darken edges)
    const matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    (filter as any)._loadMatrix(matrix, true);
    // Note: True vignette needs a custom fragment shader
  }

  private applyColorGrading(filter: ColorMatrixFilter, preset: string): void {
    const presets: Record<string, number[]> = {
      cinematic: [1.1, 0, 0, 0, -0.05, 0, 1.05, 0, 0, -0.02, 0, 0, 1.1, 0, 0.03, 0, 0, 0, 1, 0],
      noir: [0.6, 0.6, 0.6, 0, 0, 0.3, 0.3, 0.3, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0, 0, 0, 1, 0],
      warm: [1.2, 0, 0, 0, 0.05, 0, 1.1, 0, 0, 0.02, 0, 0, 0.9, 0, -0.03, 0, 0, 0, 1, 0],
    };

    const matrix = presets[preset] ?? presets.cinematic;
    (filter as any)._loadMatrix(matrix, true);
  }

  private setupEventListeners(): void {
    this.eventBus.on(GameEvents.GRAPHICS_EFFECT, (data: any) => this.playEffect(data));
    this.eventBus.on(GameEvents.GRAPHICS_SCREEN_SHAKE, (data: any) => this.screenShake(data));
    this.eventBus.on(GameEvents.GRAPHICS_PARTICLE, (data: any) => this.spawnParticles(data));
    this.eventBus.on('camera:move', (data: any) => this.moveCamera(data));
    this.eventBus.on('camera:zoom', (data: any) => this.zoomCamera(data));
    this.eventBus.on('light:add', (data: any) => this.addLight(data));
    this.eventBus.on('light:remove', (data: any) => this.removeLight(data));
    this.eventBus.on('world:biomeChanged', (data: any) => this.setBiomeBackdrop(data.biome));
  }

  private render(): void {
    if (!this.app) return;

    this.frameCount++;
    const now = performance.now();

    // Update camera shake
    this.updateCameraShake();

    // Apply camera transform
    this.applyCameraTransform();

    // Update backdrop
    this.updateBackdrop();

    // Update parallax
    this.updateParallax();

    // Update lights
    this.updateLights();

    // Update particles
    this.updateParticles();

    // Update stats
    if (now - this.lastStatsTime >= 1000) {
      this.updateStats();
      this.lastStatsTime = now;
    }
  }

  private updateCameraShake(): void {
    if (this.camera.shake.intensity > 0) {
      this.camera.shake.time += 1 / 60;
      const decay = Math.exp(-this.camera.shake.time * 2);
      this.camera.shake.x = (Math.random() - 0.5) * this.camera.shake.intensity * decay;
      this.camera.shake.y = (Math.random() - 0.5) * this.camera.shake.intensity * decay;

      if (decay < 0.01) {
        this.camera.shake.intensity = 0;
        this.camera.shake.x = 0;
        this.camera.shake.y = 0;
      }
    }
  }

  private applyCameraTransform(): void {
    if (!this.app) return;

    const stage = this.app.stage;
    const screen = this.app.screen;

    // Calculate transform
    const cx = screen.width / 2;
    const cy = screen.height / 2;

    stage.pivot.set(cx, cy);
    stage.position.set(cx, cy);
    stage.scale.set(this.camera.zoom);
    stage.rotation = this.camera.rotation;

    // Apply shake
    stage.position.x += this.camera.shake.x;
    stage.position.y += this.camera.shake.y;

    // Apply camera offset
    stage.position.x += (cx - this.camera.x) * this.camera.zoom;
    stage.position.y += (cy - this.camera.y) * this.camera.zoom;
  }

  private updateParallax(): void {
    for (const layer of this.parallaxLayers) {
      layer.container.position.x = -this.camera.x * layer.factor;
      layer.container.position.y = -this.camera.y * layer.factor;
    }
  }

  private updateLights(): void {
    // Dynamic light updates would go here
    // For now, lights are static once added
  }

  private updateParticles(): void {
    let totalParticles = 0;
    for (const pool of this.particlePools.values()) {
      pool.update();
      totalParticles += pool.activeCount;
    }
    this.stats.particles = totalParticles;
  }

  private updateStats(): void {
    if (!this.app) return;

    this.stats.fps = Math.round(this.app.ticker.FPS);
    this.stats.drawCalls = (this.app.renderer.renderPipes.batch as any)?._drawCallCount ?? 0;
    this.stats.triangles = (this.app.renderer.renderPipes.batch as any)?._triangleCount ?? 0;
    this.stats.textures = this.app.renderer.textureGC?.count ?? 0;
  }

  // Public API

  getLayer(name: string): PIXI.Container | undefined {
    return this.layers.get(name);
  }

  getApp(): PIXI.Application | null {
    return this.app;
  }

  getCamera(): Readonly<typeof this.camera> {
    return this.camera;
  }

  moveCamera(data: { x: number; y: number; lerp?: number }): void {
    const lerp = data.lerp ?? 0.1;
    this.camera.x += (data.x - this.camera.x) * lerp;
    this.camera.y += (data.y - this.camera.y) * lerp;
  }

  zoomCamera(data: { zoom: number; lerp?: number }): void {
    const lerp = data.lerp ?? 0.1;
    this.camera.zoom += (data.zoom - this.camera.zoom) * lerp;
    this.camera.zoom = Math.max(0.1, Math.min(5, this.camera.zoom));
  }

  screenShake(data: { intensity: number; duration?: number }): void {
    this.camera.shake.intensity = data.intensity;
    this.camera.shake.time = 0;
    if (data.duration) {
      setTimeout(() => {
        this.camera.shake.intensity = 0;
      }, data.duration * 1000);
    }
  }

  addLight(data: {
    id: string;
    x: number;
    y: number;
    radius: number;
    color: number;
    intensity: number;
    flicker?: boolean;
  }): void {
    if (!this.lightContainer || !this.app) return;

    const light = new LightSource(data, this.app);
    this.lights.set(data.id, light);
    this.lightContainer.addChild(light.graphics);
  }

  removeLight(id: string): void {
    const light = this.lights.get(id);
    if (light) {
      light.destroy();
      this.lights.delete(id);
    }
  }

  playEffect(data: {
    type: string;
    x: number;
    y: number;
    scale?: number;
    rotation?: number;
    tint?: number;
    duration?: number;
  }): void {
    const layer = this.layers.get('effects');
    if (!layer || !this.app) return;

    // Create effect sprite (placeholder - would use actual effect textures)
    const gfx = new PIXI.Graphics();
    gfx.circle(0, 0, 20);
    gfx.fill({ color: data.tint ?? 0xffff00, alpha: 0.8 });
    gfx.position.set(data.x, data.y);
    gfx.scale.set(data.scale ?? 1);
    gfx.rotation = data.rotation ?? 0;

    layer.addChild(gfx);

    // Animate
    const duration = data.duration ?? 0.5;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = elapsed / duration;

      if (progress >= 1) {
        layer.removeChild(gfx);
        gfx.destroy();
        return;
      }

      gfx.alpha = 0.8 * (1 - progress);
      gfx.scale.set((data.scale ?? 1) * (1 + progress));
      requestAnimationFrame(animate);
    };

    animate();
  }

  spawnParticles(data: {
    type: string;
    x: number;
    y: number;
    count?: number;
    color?: number;
    size?: number;
    speed?: number;
    lifetime?: number;
    gravity?: number;
  }): void {
    if (!this.particleContainer) return;

    let pool = this.particlePools.get(data.type);
    if (!pool) {
      pool = new ParticlePool(
        data.type,
        this.particleContainer,
        this.config.particles.maxParticles
      );
      this.particlePools.set(data.type, pool);
    }

    pool.emit({
      x: data.x,
      y: data.y,
      count: data.count ?? 10,
      color: data.color ?? 0xffffff,
      size: data.size ?? 4,
      speed: data.speed ?? 100,
      lifetime: data.lifetime ?? 1,
      gravity: data.gravity ?? 0,
    });
  }

  resize(): void {
    if (!this.app) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.app.renderer.resize(width, height);
    if (this.backdrop) {
      this.backdrop.width = width + 2;
      this.backdrop.height = height + 2;
    }
    this.updateBackdrop();

    // Update layer culling areas
    for (const layer of this.layers.values()) {
      layer.cullArea = new PIXI.Rectangle(0, 0, width, height);
    }
  }

  setPostProcessing(enabled: boolean): void {
    this.postProcessEnabled = enabled;
    if (this.layers.has('effects')) {
      this.layers.get('effects')!.filters = enabled
        ? ([this.bloomFilter, this.vignetteFilter, this.colorGradingFilter].filter(Boolean) as any)
        : null;
    }
  }

  setColorGrading(preset: string): void {
    if (this.colorGradingFilter) {
      this.applyColorGrading(this.colorGradingFilter, preset);
    }
  }

  getStats(): RenderStats {
    return { ...this.stats };
  }

  async shutdown(): Promise<void> {
    if (this.app) {
      this.app.ticker.remove(this.render, this);
      this.app.destroy(true);
      this.app = null;
    }
    this.layers.clear();
    this.lights.clear();
    this.particlePools.clear();
  }

  serialize(): ModuleState {
    return {
      version: this.version,
      timestamp: Date.now(),
      data: {
        camera: this.camera,
        ambientLight: this.ambientLight,
        lights: Array.from(this.lights.entries()).map(([id, light]) => [id, light.serialize()]),
        postProcessEnabled: this.postProcessEnabled,
      },
      checksum: 'render',
    };
  }

  deserialize(state: ModuleState): void {
    if (state.data.camera) this.camera = { ...this.camera, ...state.data.camera };
    if (state.data.ambientLight) this.ambientLight = state.data.ambientLight;
    if (state.data.postProcessEnabled !== undefined)
      this.setPostProcessing(state.data.postProcessEnabled);
    // Lights would need re-creation
  }

  update(_deltaTime: number): void {
    // Render is handled by PixiJS ticker
  }
}

/**
 * Light Source - Dynamic 2D lighting
 */
class LightSource {
  graphics: PIXI.Graphics;
  data: any;
  private app: PIXI.Application;
  private flickerTime = 0;

  constructor(data: any, app: PIXI.Application) {
    this.app = app;
    this.data = data;
    this.graphics = new PIXI.Graphics();
    this.createLightGeometry();
  }

  private createLightGeometry(): void {
    const { x, y, radius, color, intensity } = this.data;

    // Create radial gradient light
    // Using graphics for simplicity; production would use shaders
    this.graphics.circle(x, y, radius);
    this.graphics.fill({
      color,
      alpha: intensity * 0.5,
    });

    // Add glow effect
    this.graphics.circle(x, y, radius * 1.5);
    this.graphics.fill({
      color,
      alpha: intensity * 0.1,
    });

    this.graphics.blendMode = 'add';
  }

  update(deltaTime: number): void {
    if (this.data.flicker) {
      this.flickerTime += deltaTime;
      const flicker = Math.sin(this.flickerTime * 10) * 0.1 + 0.9;
      this.graphics.alpha = this.data.intensity * flicker;
    }
  }

  serialize(): any {
    return { ...this.data };
  }

  destroy(): void {
    this.graphics.destroy();
  }
}

/**
 * Particle Pool - Object pooling for particle systems
 */
class ParticlePool {
  readonly type: string;
  private container: PIXI.Container;
  private maxParticles: number;
  private particles: Particle[] = [];
  private freeIndices: number[] = [];
  activeCount = 0;

  constructor(type: string, container: PIXI.Container, maxParticles: number) {
    this.type = type;
    this.container = container;
    this.maxParticles = maxParticles;

    // Pre-allocate
    for (let i = 0; i < maxParticles; i++) {
      const particle = new Particle();
      this.particles.push(particle);
      this.freeIndices.push(i);
    }
  }

  emit(config: {
    x: number;
    y: number;
    count: number;
    color: number;
    size: number;
    speed: number;
    lifetime: number;
    gravity: number;
  }): void {
    for (let i = 0; i < config.count && this.freeIndices.length > 0; i++) {
      const index = this.freeIndices.pop()!;
      const particle = this.particles[index];

      particle.init(config);
      this.container.addChild(particle.graphics);
      this.activeCount++;
    }
  }

  update(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;

      particle.update(1 / 60);

      if (particle.life <= 0) {
        this.container.removeChild(particle.graphics);
        particle.active = false;
        this.freeIndices.push(i);
        this.activeCount--;
      }
    }
  }
}

class Particle {
  graphics: PIXI.Graphics;
  active = false;
  life = 0;
  maxLife = 0;
  velocity = { x: 0, y: 0 };
  gravity = 0;
  size = 0;

  constructor() {
    this.graphics = new PIXI.Graphics();
  }

  init(config: {
    x: number;
    y: number;
    color: number;
    size: number;
    speed: number;
    lifetime: number;
    gravity: number;
  }): void {
    this.graphics.clear();
    this.graphics.circle(0, 0, config.size);
    this.graphics.fill({ color: config.color });
    this.graphics.position.set(config.x, config.y);
    this.graphics.blendMode = 'add';

    const angle = Math.random() * Math.PI * 2;
    const speed = config.speed * (0.5 + Math.random() * 0.5);
    this.velocity.x = Math.cos(angle) * speed;
    this.velocity.y = Math.sin(angle) * speed;

    this.life = config.lifetime;
    this.maxLife = config.lifetime;
    this.gravity = config.gravity;
    this.size = config.size;
    this.active = true;
  }

  update(deltaTime: number): void {
    if (!this.active) return;

    this.life -= deltaTime;
    this.graphics.position.x += this.velocity.x * deltaTime;
    this.graphics.position.y += this.velocity.y * deltaTime;
    this.velocity.y += this.gravity * deltaTime;

    // Fade out
    const progress = 1 - this.life / this.maxLife;
    this.graphics.alpha = 1 - progress;
    this.graphics.scale.set(1 - progress * 0.5);
  }
}
