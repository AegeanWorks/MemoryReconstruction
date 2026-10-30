/**
 * The Pixi renderer: owns the application, the layer stack and the camera.
 *
 * Layers, bottom to top: level tiles, ground (telegraphs, glows), actors
 * (depth-sorted), effects, overlay (projectiles, bars), then screen-space
 * darkness and the hurt flash.
 */
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { SimEvent } from '../sim/events';
import type { World } from '../sim/world';
import { ActorView } from './ActorView';
import { Effects } from './Effects';
import { fxTextures } from './fxArt';
import { LevelView } from './LevelView';
import { BIOME_ART, hex } from './palette';
import { loadSprites, type SpriteLibrary } from './sheets';

/** World pixels visible vertically; the zoom follows the window height. */
const VIEW_HEIGHT = 520;
/** Inside a house the camera fills the screen with that one room. */
const VIEW_HEIGHT_INTERIOR = 470;
const LOOK_AHEAD = 0.18;
const LOOK_AHEAD_MAX = 90;

interface FloorScene {
  world: World;
  level: LevelView;
  actors: ActorView;
  effects: Effects;
}

/**
 * Keeps a camera axis inside `[min, max]` when that span is wider than the
 * view, and centres the span when it is not.
 */
function clampToSpan(value: number, min: number, max: number, halfView: number): number {
  const lo = min + halfView;
  const hi = max - halfView;
  if (lo >= hi) return (min + max) / 2;
  return Math.min(Math.max(value, lo), hi);
}

export class Renderer {
  private readonly app = new Application();
  private readonly camera = new Container();
  private readonly darkness = new Sprite();
  private readonly flash = new Graphics();
  private sprites!: SpriteLibrary;
  private scene: FloorScene | undefined;
  private camX = 0;
  private camY = 0;
  private zoom = 1;
  private aimX = 0;
  private aimY = 0;

  async init(host: HTMLElement, onProgress?: (fraction: number) => void): Promise<void> {
    await this.app.init({
      resizeTo: window,
      background: 0x000000,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: 'high-performance',
    });
    this.app.ticker.stop();
    host.prepend(this.app.canvas);
    this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.darkness.texture = fxTextures().vignette;
    this.darkness.anchor.set(0.5);
    this.app.stage.addChild(this.camera, this.darkness, this.flash);
    this.sprites = await loadSprites(onProgress);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /** Builds the scene for a new floor, discarding the previous one. */
  showFloor(world: World): void {
    this.clearFloor();
    const biome = world.plan.biome;
    const art = BIOME_ART[biome];
    this.app.renderer.background.color = art.background;
    const level = new LevelView(
      world.floor,
      biome,
      this.sprites.props,
      this.sprites.backgrounds[biome],
      world.mode !== 'sanctuary'
    );
    const actors = new ActorView(this.sprites, world);
    const effects = new Effects(hex(art.accent));
    this.camera.addChild(level.root, actors.ground, actors.actors, effects.layer, actors.overlay);
    for (const prop of level.props) actors.actors.addChild(prop);
    this.scene = { world, level, actors, effects };
    this.camX = world.player.x;
    this.camY = world.player.y;
    // Snap the room framing instead of easing in from the previous screen.
    this.zoom = Math.max(
      0.5,
      this.app.screen.height / (world.mode === 'sanctuary' ? VIEW_HEIGHT_INTERIOR : VIEW_HEIGHT)
    );
    this.darkness.alpha = art.darkness;
  }

  clearFloor(): void {
    if (!this.scene) return;
    this.scene.level.destroy();
    this.scene.actors.destroy();
    this.scene.effects.destroy();
    this.camera.removeChildren();
    this.scene = undefined;
  }

  /** Hides world-space station labels while a DOM menu covers the screen. */
  setLabelsVisible(visible: boolean): void {
    this.scene?.actors.setLabelsVisible(visible);
  }

  /** Call before each sim step so motion can be interpolated. */
  beforeStep(): void {
    this.scene?.actors.capture();
  }

  handleEvents(events: readonly SimEvent[]): void {
    if (!this.scene) return;
    const p = this.scene.world.player;
    this.scene.effects.handle(events, p.x, p.y);
  }

  /** Mouse position in screen pixels, used for camera look-ahead. */
  setAimScreen(x: number, y: number): void {
    this.aimX = x;
    this.aimY = y;
  }

  screenToWorld(x: number, y: number): { x: number; y: number } {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    return { x: (x - w / 2) / this.zoom + this.camX, y: (y - h / 2) / this.zoom + this.camY };
  }

  /**
   * Draws a frame. `alpha` is how far real time is between the last two sim
   * steps (0..1); `dt` is the real seconds since the previous frame.
   */
  render(alpha: number, dt: number): void {
    const scene = this.scene;
    if (scene) this.updateScene(scene, alpha, dt);
    this.app.renderer.render(this.app.stage);
  }

  private updateScene(scene: FloorScene, alpha: number, dt: number): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const viewHeight = scene.world.mode === 'sanctuary' ? VIEW_HEIGHT_INTERIOR : VIEW_HEIGHT;
    const targetZoom = Math.max(0.5, h / viewHeight);
    this.zoom += (targetZoom - this.zoom) * Math.min(1, 8 * dt);

    const target = scene.actors.playerPosition(alpha);
    // Lean the camera toward the cursor so the player sees where they aim.
    const lookX = Math.max(
      -LOOK_AHEAD_MAX,
      Math.min(LOOK_AHEAD_MAX, ((this.aimX - w / 2) / this.zoom) * LOOK_AHEAD)
    );
    const lookY = Math.max(
      -LOOK_AHEAD_MAX,
      Math.min(LOOK_AHEAD_MAX, ((this.aimY - h / 2) / this.zoom) * LOOK_AHEAD)
    );
    const follow = 1 - Math.exp(-10 * dt);
    this.camX += (target.x + lookX - this.camX) * follow;
    this.camY += (target.y + lookY - this.camY) * follow;
    // A resident's room is one small stage: hold it framed instead of letting
    // the camera crop the top wall when the walker stands near the door.
    if (scene.world.mode === 'sanctuary') {
      const halfW = w / this.zoom / 2;
      const halfH = h / this.zoom / 2;
      this.camX = clampToSpan(this.camX, 32, scene.world.floor.grid.width * 32 - 32, halfW);
      this.camY = clampToSpan(this.camY, 32, scene.world.floor.grid.height * 32 - 32, halfH);
    }
    const shake = scene.effects.shakeOffset();
    this.camera.scale.set(this.zoom);
    this.camera.position.set(
      Math.round(w / 2 - (this.camX + shake.x) * this.zoom),
      Math.round(h / 2 - (this.camY + shake.y) * this.zoom)
    );

    const viewW = w / this.zoom;
    const viewH = h / this.zoom;
    const view = { x: this.camX - viewW / 2, y: this.camY - viewH / 2, w: viewW, h: viewH };
    scene.level.update(dt, view.x - 64, view.y - 64, view.w + 128, view.h + 128);
    scene.actors.update(dt, alpha);
    scene.effects.update(dt, view);

    // Darkness centred on the player, sized to the larger screen side.
    const px = w / 2 + (target.x - this.camX) * this.zoom;
    const py = h / 2 + (target.y - this.camY) * this.zoom;
    const size = Math.max(w, h) * 1.9;
    this.darkness.position.set(px, py);
    this.darkness.width = this.darkness.height = size;

    this.flash.clear();
    if (scene.effects.hurtFlash > 0)
      this.flash.rect(0, 0, w, h).fill({ color: 0xff2020, alpha: scene.effects.hurtFlash * 0.22 });
  }
}
