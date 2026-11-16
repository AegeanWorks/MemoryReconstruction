/**
 * Keyboard, mouse, gamepad and touch input, turned into one InputFrame per sim step.
 *
 * Held buttons (move, attack, bolt) are sampled; one-shot actions (dash,
 * potion, interact) latch until a sim step consumes them, so a tap between
 * two steps is never lost.
 */
import type { InputFrame } from '../sim/entities';
import { TouchState } from './touch';

export type MenuAction = 'pause' | 'confirm' | 'map' | 'inventory' | 'quests';

const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ'],
  bolt: ['KeyK'],
  dash: ['Space', 'ShiftLeft', 'ShiftRight'],
  potion: ['KeyQ'],
  manaPotion: ['KeyR'],
  interact: ['KeyE', 'KeyF'],
  bomb: ['KeyG'],
  trap: ['KeyT'],
  art: ['KeyV'],
} as const;

const STICK_DEADZONE = 0.22;

export class Input {
  private readonly held = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private mouseLeft = false;
  private lastPointerTouch = false;
  private mouseRight = false;
  private latched = {
    attack: false,
    bolt: false,
    dash: false,
    potion: false,
    manaPotion: false,
    interact: false,
    weapon: -1,
    bomb: false,
    trap: false,
    art: false,
  };
  /** Virtual sticks and buttons, fed by the on-screen overlay on touch devices. */
  readonly touch = new TouchState();
  private padButtons: boolean[] = [];
  private padAim: { x: number; y: number } | undefined;
  /** True after the last aim came from a gamepad stick rather than the mouse. */
  private usingPad = false;

  constructor(
    target: HTMLElement,
    private readonly onMenu: (action: MenuAction) => void
  ) {
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.releaseAll());
    target.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.usingPad = false;
    });
    // A touch tap is followed by compatibility mouse events; remember it so they are not read as clicks.
    target.addEventListener('pointerdown', (e) => {
      this.lastPointerTouch = e.pointerType === 'touch';
    });
    target.addEventListener('mousedown', (e) => {
      if (this.lastPointerTouch) return;
      if (e.button === 0) {
        this.mouseLeft = true;
        this.latched.attack = true;
      }
      if (e.button === 2) {
        this.mouseRight = true;
        this.latched.bolt = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseLeft = false;
      if (e.button === 2) this.mouseRight = false;
    });
  }

  get mouse(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  private keyDown(e: KeyboardEvent): void {
    // In play, keep Space/arrows from scrolling and Tab from leaving the
    // canvas. With a menu screen open, those keys belong to the DOM: Tab must
    // move focus and Space must activate the focused button.
    const screenOpen = !!document.querySelector('.screen');
    if (
      !screenOpen &&
      ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
    )
      e.preventDefault();
    if (e.repeat) return;
    if (screenOpen) {
      // A DOM screen owns the keyboard. Route menu keys, but never latch a
      // gameplay action that could fire the moment the screen closes.
      if (e.code === 'Escape' || e.code === 'KeyP') this.onMenu('pause');
      if (e.code === 'Tab' || e.code === 'KeyM') this.onMenu('map');
      if (e.code === 'Enter') this.onMenu('confirm');
      if (e.code === 'KeyI') this.onMenu('inventory');
      if (e.code === 'KeyJ') this.onMenu('quests');
      return;
    }
    this.held.add(e.code);
    if (KEYS.dash.includes(e.code as never)) this.latched.dash = true;
    if (KEYS.potion.includes(e.code as never)) this.latched.potion = true;
    if (KEYS.manaPotion.includes(e.code as never)) this.latched.manaPotion = true;
    if (KEYS.interact.includes(e.code as never)) this.latched.interact = true;
    if (KEYS.bomb.includes(e.code as never)) this.latched.bomb = true;
    if (KEYS.trap.includes(e.code as never)) this.latched.trap = true;
    if (KEYS.art.includes(e.code as never)) this.latched.art = true;
    if (e.code === 'Digit1') this.latched.weapon = 0;
    if (e.code === 'Digit2') this.latched.weapon = 1;
    if (e.code === 'Digit3') this.latched.weapon = 2;
    // Latch presses so a click or tap shorter than one frame still registers.
    if (e.code === KEYS.attack[0]) this.latched.attack = true;
    if (e.code === KEYS.bolt[0]) this.latched.bolt = true;
    if (e.code === 'Escape' || e.code === 'KeyP') this.onMenu('pause');
    if (e.code === 'Tab' || e.code === 'KeyM') this.onMenu('map');
    if (e.code === 'Enter') this.onMenu('confirm');
    if (e.code === 'KeyI') this.onMenu('inventory');
    if (e.code === 'KeyJ') this.onMenu('quests');
  }

  /** Drops held state, e.g. when the window loses focus or a menu opens. */
  releaseAll(): void {
    this.held.clear();
    this.mouseLeft = false;
    this.mouseRight = false;
    this.touch.reset();
    this.latched = {
      attack: false,
      bolt: false,
      dash: false,
      potion: false,
      manaPotion: false,
      interact: false,
      weapon: -1,
      bomb: false,
      trap: false,
      art: false,
    };
  }

  private any(codes: readonly string[]): boolean {
    return codes.some((c) => this.held.has(c));
  }

  /** Reads gamepad state once per animation frame; latches its one-shot buttons. */
  pollGamepad(): void {
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    if (!pad) {
      this.padAim = undefined;
      return;
    }
    const pressed = pad.buttons.map((b) => b.pressed);
    const edge = (i: number): boolean => !!pressed[i] && !this.padButtons[i];
    // A DOM screen owns the gamepad too: only menu edges while it is open, so a combat button
    // pressed in a menu cannot fire the moment the screen closes.
    if (edge(9)) this.onMenu('pause'); // Start
    if (edge(8)) this.onMenu('map'); // Back
    if (edge(1)) this.onMenu('confirm'); // B
    if (!document.querySelector('.screen')) {
      if (edge(0) || edge(5)) this.latched.dash = true; // A / RB
      if (edge(2)) this.latched.potion = true; // X
      if (edge(3)) this.latched.interact = true; // Y
      if (edge(10)) this.latched.bomb = true; // L3
      if (edge(11)) this.latched.trap = true; // R3
      if (edge(4)) this.latched.art = true; // LB
      if (edge(12)) this.latched.weapon = 0; // D-pad up
      if (edge(14)) this.latched.weapon = 1; // D-pad left
      if (edge(15)) this.latched.weapon = 2; // D-pad right
    }
    this.padButtons = pressed;
    const rx = pad.axes[2] ?? 0;
    const ry = pad.axes[3] ?? 0;
    if (Math.hypot(rx, ry) > STICK_DEADZONE) {
      this.padAim = { x: rx, y: ry };
      this.usingPad = true;
    }
  }

  /**
   * Builds the frame for one sim step and clears the one-shot latches.
   * `toWorld` maps screen pixels to world pixels for mouse aiming.
   */
  frame(
    playerX: number,
    playerY: number,
    toWorld: (x: number, y: number) => { x: number; y: number }
  ): InputFrame {
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    let moveX = (this.any(KEYS.right) ? 1 : 0) - (this.any(KEYS.left) ? 1 : 0);
    let moveY = (this.any(KEYS.down) ? 1 : 0) - (this.any(KEYS.up) ? 1 : 0);
    if (pad && Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > STICK_DEADZONE) {
      moveX = pad.axes[0];
      moveY = pad.axes[1];
    }
    if (this.touch.move.x !== 0 || this.touch.move.y !== 0) {
      moveX = this.touch.move.x;
      moveY = this.touch.move.y;
    }

    let aim = toWorld(this.mouseX, this.mouseY);
    if (this.usingPad) {
      const dir =
        this.padAim ?? (Math.hypot(moveX, moveY) > 0 ? { x: moveX, y: moveY } : { x: 1, y: 0 });
      aim = { x: playerX + dir.x * 100, y: playerY + dir.y * 100 };
    }

    // The right touch stick aims relative to the walker and wins over the mouse while it is down.
    if (this.touch.aim) {
      aim = { x: playerX + this.touch.aim.x * 100, y: playerY + this.touch.aim.y * 100 };
    }

    const touch = this.touch.consume();
    const padHeld = (i: number): boolean => !!pad?.buttons[i]?.pressed;
    const frame: InputFrame = {
      moveX,
      moveY,
      aimX: aim.x,
      aimY: aim.y,
      attack:
        this.mouseLeft ||
        this.any(KEYS.attack) ||
        padHeld(7) ||
        this.latched.attack ||
        this.touch.attackHeld ||
        touch.attack,
      bolt:
        this.mouseRight ||
        this.any(KEYS.bolt) ||
        padHeld(6) ||
        this.latched.bolt ||
        this.touch.boltHeld ||
        touch.bolt,
      dash: this.latched.dash || touch.dash,
      potion: this.latched.potion || touch.potion,
      manaPotion: this.latched.manaPotion || touch.manaPotion,
      interact: this.latched.interact || touch.interact,
      weapon: this.latched.weapon >= 0 ? this.latched.weapon : touch.weapon,
      bomb: this.latched.bomb || touch.bomb,
      trap: this.latched.trap || touch.trap,
      art: this.latched.art || touch.art,
    };
    this.latched = {
      attack: false,
      bolt: false,
      dash: false,
      potion: false,
      manaPotion: false,
      interact: false,
      weapon: -1,
      bomb: false,
      trap: false,
      art: false,
    };
    return frame;
  }
}
