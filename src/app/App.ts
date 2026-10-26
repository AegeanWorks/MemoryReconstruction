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
import {
  RESTORATIONS,
  checkpointForDepth,
  createExpedition,
  echoesEarned,
  purchaseRestoration,
  sectionNumber,
} from '../sim/hub';
import { NPCS, questProgress, questsForNpc, questSnapshot } from '../sim/quests';
import { createRun, type RunState } from '../sim/run';
import { SANCTUARY_LABELS } from '../sim/sanctuary';
import { World } from '../sim/world';
import { SaveStore, recordRun, type Meta, type Settings } from '../save/SaveStore';
import { h } from '../ui/dom';
import { Hud } from '../ui/Hud';
import {
  Screens,
  choiceScreen,
  controlsScreen,
  deathScreen,
  dialogueScreen,
  expeditionScreen,
  floorBanner,
  hubScreen,
  inventoryScreen,
  mapScreen,
  meditationScreen,
  memoriesScreen,
  pauseScreen,
  questLogScreen,
  trainingScreen,
  sanctuaryMenuScreen,
  settingsScreen,
  titleScreen,
  victoryScreen,
} from '../ui/Screens';
import type { Renderer } from '../view/Renderer';

export type AppState =
  | 'title'
  | 'hub'
  | 'sanctuary'
  | 'playing'
  | 'paused'
  | 'choice'
  | 'map'
  | 'inventory'
  | 'transition'
  | 'dead'
  | 'victory';

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
  private readonly prompt = h('div', { class: 'sanctuary-prompt hidden' });
  private readonly sanctuaryTitle = h(
    'div',
    { class: 'sanctuary-title hidden' },
    h('div', { class: 'st-title' }, 'The Sanctuary'),
    h('div', { class: 'st-sub' }, 'E interact  ·  I relics  ·  Esc menu')
  );
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
    ui.append(this.hud.root, this.sanctuaryTitle, this.prompt, this.fade);
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
    if (
      this.world &&
      (this.state === 'playing' || this.state === 'dead' || this.state === 'sanctuary')
    )
      this.simulate(dt);
    const mouse = this.input.mouse;
    this.renderer.setAimScreen(mouse.x, mouse.y);
    this.renderer.render(this.state === 'playing' ? this.accumulator / STEP : 1, dt);
    this.hud.setDimmed(
      this.world?.mode === 'dungeon' &&
        (this.state === 'paused' ||
          this.state === 'map' ||
          this.state === 'choice' ||
          this.state === 'inventory')
    );
    // Sanctuary station labels must not bleed through full-screen menus.
    this.renderer.setLabelsVisible(
      this.state === 'sanctuary' ||
        this.state === 'playing' ||
        this.state === 'dead' ||
        this.state === 'victory'
    );
    if (this.world && this.world.mode === 'dungeon' && this.state !== 'title')
      this.hud.update(this.world, dt);
    this.updatePrompt();
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
        this.state === 'playing' || this.state === 'sanctuary'
          ? this.input.frame(p.x, p.y, (x, y) => this.renderer.screenToWorld(x, y))
          : NO_INPUT;
      this.dispatch(world.step(frame, STEP));
      this.accumulator -= STEP;
      steps++;
      if (this.state !== 'playing' && this.state !== 'dead' && this.state !== 'sanctuary') break;
    }
    // Falling far behind (a slow tab): drop the backlog instead of spiralling.
    if (
      steps === MAX_STEPS_PER_FRAME ||
      (this.state !== 'playing' && this.state !== 'dead' && this.state !== 'sanctuary')
    )
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
        case 'sanctuary':
          if (e.kind === 'structure') {
            if (e.id === 'training') this.showTraining();
            else if (e.id === 'meditation') this.showMeditation();
            else if (e.id === 'noticeboard') this.showQuestLog(() => this.closeHubPanel());
            else this.openHubPanel();
          } else if (e.kind === 'npc') this.showNpc(e.id);
          else this.showExpedition();
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
    document.querySelectorAll('.banner').forEach((el) => el.remove());
    // A quiet backdrop: the first floor of a random run, not simulated.
    const backdrop = new World(createRun(Math.floor(Math.random() * 2 ** 31), []));
    this.world = backdrop;
    this.renderer.showFloor(backdrop);
    this.sound.playAmbience('ruins');
    this.screens.show(
      titleScreen({
        meta: this.meta,
        canContinue: this.store.hasRun(),
        onNew: () => this.click(() => this.showHub()),
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

  /** Walks the Sanctuary as a real map: structures, NPCs and the gate. */
  private showHub(): void {
    this.state = 'sanctuary';
    this.screens.close();
    document.querySelectorAll('.banner').forEach((el) => el.remove());
    this.hud.setVisible(false);
    this.input.releaseAll();
    this.deathTimer = -1;
    const run = createExpedition(
      Math.floor(Math.random() * 2 ** 31),
      this.meta.fragments,
      0,
      this.meta
    );
    this.world = new World(run, { sanctuary: true });
    this.renderer.showFloor(this.world);
    this.sound.playAmbience('sanctuary');
  }

  /** The rebuild ledger, opened by walking up to any structure. */
  private openHubPanel(): void {
    this.state = 'hub';
    this.input.releaseAll();
    const saved = this.store.loadRun();
    const restCost = saved ? 10 + saved.depth * 2 : 0;
    const reopen = (): void => this.openHubPanel();
    this.screens.show(
      hubScreen({
        meta: this.meta,
        canContinue: !!saved,
        saved: saved
          ? {
              depth: saved.depth,
              health: saved.player.health,
              maxHealth: saved.player.stats.maxHealth,
            }
          : undefined,
        restCost,
        onRest: () =>
          this.click(() => {
            this.restSavedRun(restCost);
            reopen();
          }),
        onExpedition: () => this.click(() => this.showExpedition()),
        onContinue: () =>
          this.click(() => {
            const run = this.store.loadRun();
            if (run) this.startRun(run);
          }),
        onRebuild: (id) => this.buyRestoration(id),
        onMemories: () =>
          this.click(() => this.screens.show(memoriesScreen(this.meta.fragments, () => reopen()))),
        onSettings: () => this.click(() => this.showSettings(() => reopen())),
        onControls: () => this.click(() => this.screens.show(controlsScreen(() => reopen()))),
        onBack: () => this.click(() => this.closeHubPanel()),
      })
    );
  }

  private closeHubPanel(): void {
    this.screens.close();
    this.state = 'sanctuary';
  }

  private showExpedition(): void {
    this.state = 'hub';
    this.input.releaseAll();
    const saved = this.store.loadRun();
    const restCost = saved ? 10 + saved.depth * 2 : 0;
    this.screens.show(
      expeditionScreen({
        meta: this.meta,
        saved: saved
          ? {
              depth: saved.depth,
              health: saved.player.health,
              maxHealth: saved.player.stats.maxHealth,
            }
          : undefined,
        restCost,
        onContinue: () =>
          this.click(() => {
            const run = this.store.loadRun();
            if (run) this.startRun(run);
          }),
        onRest: () =>
          this.click(() => {
            this.restSavedRun(restCost);
            this.showExpedition();
          }),
        onStart: (depth) => this.click(() => this.startExpedition(depth)),
        onBack: () => this.click(() => this.closeHubPanel()),
      })
    );
  }

  private questSnapshotNow() {
    return questSnapshot(
      this.meta.fragments,
      this.meta.kills,
      this.meta,
      this.meta.bestDepth,
      this.meta.bossKills
    );
  }

  /** The quest section, reachable from the Notice Board and the pause menu. */
  private showQuestLog(back: () => void): void {
    if (this.world?.mode === 'sanctuary') this.state = 'hub';
    this.input.releaseAll();
    this.screens.show(questLogScreen(this.meta, this.questSnapshotNow(), () => this.click(back)));
  }

  /** Pick the weapon every expedition starts with. */
  private showTraining(): void {
    this.state = 'hub';
    this.input.releaseAll();
    const render = (): void => {
      this.screens.show(
        trainingScreen(
          this.meta,
          (id) => {
            this.sound.click();
            this.meta = { ...this.meta, startingWeapon: id };
            if (this.world) this.world.player.weapon = id;
            this.store.saveMeta(this.meta);
            render();
          },
          () => this.click(() => this.closeHubPanel())
        )
      );
    };
    render();
  }

  /** Buy a one-expedition boon. */
  private showMeditation(): void {
    this.state = 'hub';
    this.input.releaseAll();
    const render = (): void => {
      this.screens.show(
        meditationScreen(
          this.meta,
          (boon) => {
            if (this.meta.echoes < 20) return;
            this.sound.click();
            this.meta = { ...this.meta, echoes: this.meta.echoes - 20, boon };
            this.store.saveMeta(this.meta);
            render();
          },
          () => this.click(() => this.closeHubPanel())
        )
      );
    };
    render();
  }

  /** Talks to an NPC: accept, then claim, their task. */
  private showNpc(npcId: string): void {
    this.state = 'hub';
    this.input.releaseAll();
    const render = (): void => {
      const quest = questsForNpc(npcId);
      const snapshot = this.questSnapshotNow();
      const accepted = !!quest && this.meta.quests.accepted.includes(quest.id);
      const claimed = !!quest && this.meta.quests.claimed.includes(quest.id);
      const progress = quest ? questProgress(quest, snapshot) : 0;
      this.screens.show(
        dialogueScreen({
          npcId,
          progress,
          accepted,
          claimed,
          onAccept: () => {
            if (!quest || accepted) return;
            this.sound.click();
            this.meta = {
              ...this.meta,
              quests: { ...this.meta.quests, accepted: [...this.meta.quests.accepted, quest.id] },
            };
            this.store.saveMeta(this.meta);
            render();
          },
          onClaim: () => {
            if (!quest || claimed || progress < quest.target) return;
            this.sound.click();
            const vault =
              quest.rewardItem && !this.meta.vault.includes(quest.rewardItem)
                ? [...this.meta.vault, quest.rewardItem]
                : this.meta.vault;
            this.meta = {
              ...this.meta,
              echoes: this.meta.echoes + quest.rewardEchoes,
              vault,
              quests: {
                ...this.meta.quests,
                claimed: [...this.meta.quests.claimed, quest.id],
              },
            };
            this.store.saveMeta(this.meta);
            render();
          },
          onClose: () => this.click(() => this.closeHubPanel()),
        })
      );
    };
    render();
  }

  private showSanctuaryMenu(): void {
    this.state = 'hub';
    this.input.releaseAll();
    const reopen = (): void => this.showSanctuaryMenu();
    this.screens.show(
      sanctuaryMenuScreen({
        onResume: () => this.click(() => this.closeHubPanel()),
        onSettings: () => this.click(() => this.showSettings(() => reopen())),
        onControls: () => this.click(() => this.screens.show(controlsScreen(() => reopen()))),
        onTitle: () => this.click(() => this.showTitle()),
      })
    );
  }

  /** Heals the saved expedition between floors at the cost of echoes. */
  private restSavedRun(cost: number): void {
    const run = this.store.loadRun();
    if (!run || this.meta.echoes < cost) return;
    const p = run.player;
    p.health = p.stats.maxHealth;
    p.mana = p.stats.maxMana;
    p.potions = p.stats.maxPotions;
    this.store.saveRun(run);
    this.meta = { ...this.meta, echoes: this.meta.echoes - cost };
    this.store.saveMeta(this.meta);
  }

  private startExpedition(startDepth: number): void {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const run = createExpedition(seed, this.meta.fragments, startDepth, this.meta);
    // A meditation boon is spent by the expedition that carries it.
    if (this.meta.boon) {
      this.meta = { ...this.meta, boon: null };
      this.store.saveMeta(this.meta);
    }
    this.startRun(run);
  }

  private buyRestoration(id: string): void {
    const next = purchaseRestoration(this.meta, id);
    if (!next) return;
    this.meta = { ...this.meta, echoes: next.echoes, restorations: next.restorations };
    this.store.saveMeta(this.meta);
    this.sound.click();
    this.openHubPanel();
  }

  /** Prompt for whatever the Walker is standing next to in the Sanctuary. */
  private updatePrompt(): void {
    this.sanctuaryTitle.classList.toggle('hidden', this.state !== 'sanctuary');
    const target = this.state === 'sanctuary' ? this.world?.nearbyInteractable() : undefined;
    let label = '';
    if (target) {
      if (target.kind === 'structure') {
        const def = RESTORATIONS.find((r) => r.id === target.structureId);
        const name =
          def?.name ??
          SANCTUARY_LABELS[target.structureId ?? ''] ??
          target.structureId?.replace(/_/g, ' ') ??
          'Station';
        label = `${name}  ·  E`;
      } else if (target.kind === 'npc') {
        label = `${NPCS[target.npcId ?? '']?.name ?? 'Resident'}  ·  E`;
      } else if (target.kind === 'gate') {
        label = 'The Gate  ·  E';
      }
    }
    this.prompt.textContent = label;
    this.prompt.classList.toggle('hidden', label === '');
  }

  private click(action: () => void): void {
    this.sound.unlock();
    this.sound.click();
    action();
  }

  private startRun(run: RunState): void {
    this.run = run;
    this.screens.close();
    this.input.releaseAll();
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
    this.ui.append(
      floorBanner(run.depth, this.world.plan.trialName ?? biomeInfo(this.world.plan.biome).name)
    );
    this.hud.showBanner();
    const reached = checkpointForDepth(run.depth);
    if (reached > this.meta.checkpoint) {
      this.meta = { ...this.meta, checkpoint: reached };
      this.store.saveMeta(this.meta);
      // Let the cinematic floor banner finish before the checkpoint toast,
      // but do not let a queued toast land on a later floor.
      const scheduledRun = this.run;
      const scheduledDepth = run.depth;
      window.setTimeout(() => {
        if (
          this.state === 'playing' &&
          this.run === scheduledRun &&
          this.run?.depth === scheduledDepth
        )
          this.hud.toast(`Checkpoint · Section ${sectionNumber(reached)}`);
      }, 3650);
    }
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

  /** Opens the relic bag; re-renders in place after every equip change. */
  private showInventory(): void {
    const world = this.world;
    if (!world) return;
    const inSanctuary = world.mode === 'sanctuary';
    this.state = 'inventory';
    this.input.releaseAll();
    const close = (): void => {
      if (inSanctuary) this.closeHubPanel();
      else this.resume();
    };
    const render = (): void => {
      this.screens.show(
        inventoryScreen(
          world,
          () => this.click(close),
          () => render()
        )
      );
    };
    render();
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
    const earned = echoesEarned(run, won);
    this.meta = recordRun(this.meta, run, won);
    this.store.saveMeta(this.meta);
    this.store.clearRun();
    this.state = won ? 'victory' : 'dead';
    this.deathTimer = -1;
    this.hud.setVisible(false);
    document.querySelectorAll('.banner').forEach((el) => el.remove());
    this.sound.stopAmbience();
    const checkpoint = checkpointForDepth(run.depth);
    const sanctuary = (): void => this.click(() => this.showHub());
    this.screens.show(
      won
        ? victoryScreen(run, { echoes: earned, onSanctuary: sanctuary })
        : deathScreen(run, {
            echoes: earned,
            checkpoint: sectionNumber(checkpoint),
            onRetry: () => this.click(() => this.startExpedition(checkpoint)),
            onBeginning: () => this.click(() => this.startExpedition(0)),
            onSanctuary: sanctuary,
          })
    );
  }

  private pause(): void {
    this.state = 'paused';
    this.input.releaseAll();
    this.screens.show(
      pauseScreen({
        world: this.world,
        onResume: () => this.click(() => this.resume()),
        onQuests: () => this.click(() => this.showQuestLog(() => this.pause())),
        onSettings: () => this.click(() => this.showSettings(() => this.pause())),
        onControls: () => this.click(() => this.screens.show(controlsScreen(() => this.pause()))),
        onAbandon: () =>
          this.click(() => {
            this.meta = recordRun(this.meta, this.run!, false);
            this.store.saveMeta(this.meta);
            this.store.clearRun();
            this.showHub();
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
    const closeOverlay = (): void => {
      if (this.world?.mode === 'sanctuary') this.closeHubPanel();
      else this.resume();
    };
    if (action === 'pause') {
      if (this.state === 'sanctuary') this.showSanctuaryMenu();
      else if (this.state === 'hub') this.closeHubPanel();
      else if (this.state === 'playing') this.pause();
      else if (this.state === 'paused' || this.state === 'map' || this.state === 'inventory')
        closeOverlay();
    } else if (action === 'map') {
      if (this.state === 'playing' && this.world) {
        this.state = 'map';
        this.input.releaseAll();
        this.screens.show(mapScreen(this.world, () => this.resume()));
      } else if (this.state === 'map') this.resume();
    } else if (action === 'inventory') {
      if ((this.state === 'playing' || this.state === 'sanctuary') && this.world)
        this.showInventory();
      else if (this.state === 'inventory') closeOverlay();
    } else if (action === 'confirm' && this.state === 'choice') {
      // Gamepad B confirms the selection without reaching for the mouse.
      const confirm = document.querySelector<HTMLButtonElement>('.btn.confirm');
      if (confirm && !confirm.disabled) confirm.click();
    }
  }
}
