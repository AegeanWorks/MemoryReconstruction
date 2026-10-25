/**
 * The game shell: a state machine over title, play, pause, upgrade choice,
 * map, floor transitions, death and victory. It runs the simulation at a
 * fixed 60 Hz and renders every animation frame.
 */
import { Sound } from '../audio/Sound';
import { Input, type MenuAction } from '../input/Input';
import { biomeInfo } from '../sim/content';
import { NO_INPUT } from '../sim/entities';
import type { SimEvent } from '../sim/events';
import { createRun, type RunState } from '../sim/run';
import { World } from '../sim/world';
import { SaveStore, recordRun, type Meta, type Settings } from '../save/SaveStore';
import { h } from '../ui/dom';
import { Hud } from '../ui/Hud';
import {
  Screens,
  choiceScreen,
  controlsScreen,
  deathScreen,
  floorBanner,
  mapScreen,
  memoriesScreen,
  pauseScreen,
  settingsScreen,
  titleScreen,
  victoryScreen,
} from '../ui/Screens';
import type { Renderer } from '../view/Renderer';

export type AppState =
  'title' | 'playing' | 'paused' | 'choice' | 'map' | 'transition' | 'dead' | 'victory';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
/** Seconds the world keeps moving after the player falls, before the death screen. */
const DEATH_LINGER = 1.4;

export class App {
  state: AppState = 'title';
  world: World | undefined;
  private run: RunState | undefined;
  private meta: Meta;
  private readonly store = new SaveStore();
  private readonly sound = new Sound();
  private readonly input: Input;
  private readonly hud = new Hud();
  private readonly screens: Screens;
  private readonly fade = h('div', { class: 'fade' });
  private accumulator = 0;
  private lastTime = 0;
  private deathTimer = -1;

  constructor(
    private readonly renderer: Renderer,
    private readonly ui: HTMLElement
  ) {
    this.meta = this.store.loadMeta();
    this.applySettings(this.meta.settings);
    this.screens = new Screens(ui);
    ui.append(this.hud.root, this.fade);
    this.input = new Input(renderer.canvas, (action) => this.onMenu(action));
    // Audio needs a user gesture; any first input unlocks it.
    const unlock = (): void => {
      this.sound.unlock();
      this.applySettings(this.meta.settings);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pause();
    });
  }

  start(): void {
    this.showTitle();
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ----- loop -----

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.input.pollGamepad();
    if (this.world && (this.state === 'playing' || this.state === 'dead')) this.simulate(dt);
    const mouse = this.input.mouse;
    this.renderer.setAimScreen(mouse.x, mouse.y);
    this.renderer.render(this.state === 'playing' ? this.accumulator / STEP : 1, dt);
    this.hud.setDimmed(this.state === 'paused' || this.state === 'map' || this.state === 'choice');
    if (this.world && this.state !== 'title') this.hud.update(this.world, dt);
    requestAnimationFrame((t) => this.frame(t));
  }

  private simulate(dt: number): void {
    const world = this.world!;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS_PER_FRAME) {
      this.renderer.beforeStep();
      const p = world.player;
      const frame =
        this.state === 'playing'
          ? this.input.frame(p.x, p.y, (x, y) => this.renderer.screenToWorld(x, y))
          : NO_INPUT;
      this.dispatch(world.step(frame, STEP));
      this.accumulator -= STEP;
      steps++;
      if (this.state !== 'playing' && this.state !== 'dead') break;
    }
    // Falling far behind (a slow tab): drop the backlog instead of spiralling.
    if (steps === MAX_STEPS_PER_FRAME || (this.state !== 'playing' && this.state !== 'dead'))
      this.accumulator = 0;

    if (this.state === 'dead' && this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.endRun(false);
    }
  }

  private dispatch(events: SimEvent[]): void {
    const world = this.world!;
    const visible = this.meta.settings.screenShake
      ? events
      : events.filter((e) => e.type !== 'shake');
    this.renderer.handleEvents(visible);
    this.sound.handle(events);
    this.hud.handle(events, world);
    for (const e of events) {
      switch (e.type) {
        case 'fragmentFound':
          // Saved at once: recovered memories are never lost, even to a crash.
          this.meta = {
            ...this.meta,
            fragments: Array.from(new Set([...this.meta.fragments, e.fragmentId])),
          };
          this.store.saveMeta(this.meta);
          break;
        case 'bossIntro':
          this.sound.playAmbience(world.plan.biome, true);
          break;
        case 'roomCleared':
          if (world.floor.rooms[e.roomId].kind === 'boss')
            this.sound.playAmbience(world.plan.biome);
          break;
        case 'playerDied':
          this.state = 'dead';
          this.deathTimer = DEATH_LINGER;
          break;
        case 'floorExit':
          this.nextFloor();
          return;
        case 'victory':
          this.endRun(true);
          return;
        default:
          break;
      }
    }
    if (this.state === 'playing' && world.awaitingChoice) this.showChoice();
  }

  // ----- flow -----

  private showTitle(): void {
    this.state = 'title';
    this.hud.setVisible(false);
    // A quiet backdrop: the first floor of a random run, not simulated.
    const backdrop = new World(createRun(Math.floor(Math.random() * 2 ** 31), []));
    this.world = backdrop;
    this.renderer.showFloor(backdrop);
    this.sound.playAmbience('ruins');
    this.screens.show(
      titleScreen({
        meta: this.meta,
        canContinue: this.store.hasRun(),
        onNew: () =>
          this.click(() =>
            this.startRun(createRun(Math.floor(Math.random() * 2 ** 31), this.meta.fragments))
          ),
        onContinue: () =>
          this.click(() => {
            const run = this.store.loadRun();
            if (run) this.startRun(run);
          }),
        onMemories: () =>
          this.click(() =>
            this.screens.show(memoriesScreen(this.meta.fragments, () => this.showTitle()))
          ),
        onSettings: () => this.click(() => this.showSettings(() => this.showTitle())),
        onControls: () =>
          this.click(() => this.screens.show(controlsScreen(() => this.showTitle()))),
      })
    );
  }

  private click(action: () => void): void {
    this.sound.unlock();
    this.sound.click();
    action();
  }

  private startRun(run: RunState): void {
    this.run = run;
    this.screens.close();
    this.enterFloor();
  }

  /** Builds the world for the run's current depth and saves the run at its entrance. */
  private enterFloor(): void {
    const run = this.run!;
    this.world = new World(run);
    this.renderer.showFloor(this.world);
    this.store.saveRun(run);
    this.accumulator = 0;
    this.deathTimer = -1;
    this.input.releaseAll();
    this.hud.setVisible(true);
    this.hud.setHintVisible(run.depth === 0);
    this.sound.playAmbience(this.world.plan.biome);
    this.ui.append(floorBanner(run.depth, biomeInfo(this.world.plan.biome).name));
    this.state = 'playing';
    if (this.world.awaitingChoice) this.showChoice();
  }

  private nextFloor(): void {
    this.state = 'transition';
    this.fade.classList.add('on');
    window.setTimeout(() => {
      this.run!.depth++;
      this.enterFloor();
      this.fade.classList.remove('on');
    }, 500);
  }

  private showChoice(): void {
    const world = this.world!;
    const choice = world.run.pendingChoices[0];
    if (!choice) return;
    this.state = 'choice';
    this.input.releaseAll();
    const render = (): void => {
      const { el, onKey } = choiceScreen(
        choice,
        world.player.upgrades,
        (id) => {
          this.sound.click();
          world.chooseUpgrade(id);
          this.screens.close();
          if (world.awaitingChoice) this.showChoice();
          else this.resume();
        },
        {
          cost: world.rerollCost(),
          shards: world.player.shards,
          onReroll: () => {
            this.sound.click();
            if (world.rerollChoices()) render();
            else if (world.player.shards < world.rerollCost())
              this.hud.toast(`Reroll needs ${world.rerollCost()} shards`, true);
            else this.hud.toast('No echoes left to offer', true);
          },
        }
      );
      this.screens.show(el, onKey);
    };
    render();
  }

  private endRun(won: boolean): void {
    const run = this.run!;
    this.meta = recordRun(this.meta, run, won);
    this.store.saveMeta(this.meta);
    this.store.clearRun();
    this.state = won ? 'victory' : 'dead';
    this.deathTimer = -1;
    this.hud.setVisible(false);
    this.sound.stopAmbience();
    const toTitle = (): void => this.click(() => this.showTitle());
    const retry = (): void =>
      this.click(() =>
        this.startRun(createRun(Math.floor(Math.random() * 2 ** 31), this.meta.fragments))
      );
    this.screens.show(won ? victoryScreen(run, toTitle) : deathScreen(run, retry, toTitle));
  }

  private pause(): void {
    this.state = 'paused';
    this.input.releaseAll();
    this.screens.show(
      pauseScreen({
        world: this.world,
        onResume: () => this.click(() => this.resume()),
        onSettings: () => this.click(() => this.showSettings(() => this.pause())),
        onControls: () => this.click(() => this.screens.show(controlsScreen(() => this.pause()))),
        onAbandon: () =>
          this.click(() => {
            this.meta = recordRun(this.meta, this.run!, false);
            this.store.saveMeta(this.meta);
            this.store.clearRun();
            this.showTitle();
          }),
      })
    );
  }

  private resume(): void {
    this.screens.close();
    this.input.releaseAll();
    this.accumulator = 0;
    this.state = 'playing';
  }

  private showSettings(onBack: () => void): void {
    this.screens.show(
      settingsScreen(
        this.meta.settings,
        (settings) => {
          this.meta = { ...this.meta, settings };
          this.applySettings(settings);
          this.store.saveMeta(this.meta);
        },
        onBack
      )
    );
  }

  private applySettings(settings: Settings): void {
    this.sound.setVolumes(settings.masterVolume, settings.musicVolume, settings.sfxVolume);
  }

  private onMenu(action: MenuAction): void {
    if (action === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused' || this.state === 'map') this.resume();
    } else if (action === 'map') {
      if (this.state === 'playing' && this.world) {
        this.state = 'map';
        this.input.releaseAll();
        this.screens.show(mapScreen(this.world, () => this.resume()));
      } else if (this.state === 'map') this.resume();
    }
  }
}
