/**
 * Keyboard, mouse and gamepad input, turned into one InputFrame per sim step.
 *
 * Held buttons (move, attack, bolt) are sampled; one-shot actions (dash,
 * potion, interact) latch until a sim step consumes them, so a tap between
 * two steps is never lost.
 */
import type { InputFrame } from '../sim/entities';

export type MenuAction = 'pause' | 'confirm' | 'map';

const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ'],
  bolt: ['KeyK'],
  dash: ['Space', 'ShiftLeft', 'ShiftRight'],
  potion: ['KeyQ'],
  interact: ['KeyE', 'KeyF'],
} as const;

const STICK_DEADZONE = 0.22;

export class Input {
  private readonly held = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private mouseLeft = false;
  private mouseRight = false;
  private latched = { dash: false, potion: false, interact: false };
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
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseLeft = true;
      if (e.button === 2) this.mouseRight = true;
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
    // Keep Space/arrows from scrolling and Tab from leaving the canvas.
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
      e.preventDefault();
    if (e.repeat) return;
    this.held.add(e.code);
    if (KEYS.dash.includes(e.code as never)) this.latched.dash = true;
    if (KEYS.potion.includes(e.code as never)) this.latched.potion = true;
    if (KEYS.interact.includes(e.code as never)) this.latched.interact = true;
    if (e.code === 'Escape' || e.code === 'KeyP') this.onMenu('pause');
    if (e.code === 'Tab' || e.code === 'KeyM') this.onMenu('map');
    if (e.code === 'Enter') this.onMenu('confirm');
  }

  /** Drops held state, e.g. when the window loses focus or a menu opens. */
  releaseAll(): void {
    this.held.clear();
    this.mouseLeft = false;
    this.mouseRight = false;
    this.latched = { dash: false, potion: false, interact: false };
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
    if (edge(0) || edge(5)) this.latched.dash = true; // A / RB
    if (edge(2)) this.latched.potion = true; // X
    if (edge(3)) this.latched.interact = true; // Y
    if (edge(9)) this.onMenu('pause'); // Start
    if (edge(8)) this.onMenu('map'); // Back
    if (edge(1)) this.onMenu('confirm'); // B
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

    let aim = toWorld(this.mouseX, this.mouseY);
    if (this.usingPad) {
      const dir =
        this.padAim ?? (Math.hypot(moveX, moveY) > 0 ? { x: moveX, y: moveY } : { x: 1, y: 0 });
      aim = { x: playerX + dir.x * 100, y: playerY + dir.y * 100 };
    }

    const padHeld = (i: number): boolean => !!pad?.buttons[i]?.pressed;
    const frame: InputFrame = {
      moveX,
      moveY,
      aimX: aim.x,
      aimY: aim.y,
      attack: this.mouseLeft || this.any(KEYS.attack) || padHeld(7),
      bolt: this.mouseRight || this.any(KEYS.bolt) || padHeld(6),
      dash: this.latched.dash,
      potion: this.latched.potion,
      interact: this.latched.interact,
    };
    this.latched = { dash: false, potion: false, interact: false };
    return frame;
  }
}
