/**
 * Touch input state, with no DOM: two virtual sticks and a few buttons reduced to the same
 * shapes the keyboard and gamepad produce. `Input` merges it into each frame; the on-screen
 * overlay (`ui/TouchControls.ts`) only feeds it pointer positions, so the maths stays testable.
 *
 * The left stick moves. The right stick aims and attacks while it is pushed, as on a twin-stick
 * pad. Buttons are one-shots that latch until a sim step consumes them, except bolt, which is
 * held while pressed.
 */

const STICK_DEADZONE = 0.18;
const WEAPON_COUNT = 3;

export type TouchTap = 'dash' | 'potion' | 'manaPotion' | 'interact' | 'art' | 'bomb' | 'trap';

export interface Vec2 {
  x: number;
  y: number;
}

export interface TouchLatches {
  attack: boolean;
  bolt: boolean;
  dash: boolean;
  potion: boolean;
  manaPotion: boolean;
  interact: boolean;
  art: boolean;
  bomb: boolean;
  trap: boolean;
  /** Weapon index to switch to, or -1 to keep the current one. */
  weapon: number;
}

/** A thumb offset from the stick centre as a direction with length 0..1; zero in the dead zone. */
export function stickVector(dx: number, dy: number, radius: number): Vec2 {
  const length = Math.hypot(dx, dy);
  if (radius <= 0 || length / radius < STICK_DEADZONE) return { x: 0, y: 0 };
  const magnitude = Math.min(1, length / radius);
  return { x: (dx / length) * magnitude, y: (dy / length) * magnitude };
}

function freshLatches(): TouchLatches {
  return {
    attack: false,
    bolt: false,
    dash: false,
    potion: false,
    manaPotion: false,
    interact: false,
    art: false,
    bomb: false,
    trap: false,
    weapon: -1,
  };
}

export class TouchState {
  move: Vec2 = { x: 0, y: 0 };
  /** Last aim direction while the right stick is down, else undefined. */
  aim: Vec2 | undefined;
  attackHeld = false;
  boltHeld = false;
  private latches = freshLatches();

  setMove(dx: number, dy: number, radius: number): void {
    this.move = stickVector(dx, dy, radius);
  }

  clearMove(): void {
    this.move = { x: 0, y: 0 };
  }

  /** Pushing past the dead zone aims and attacks; drifting back inside it keeps the aim but stops attacking. */
  setAim(dx: number, dy: number, radius: number): void {
    const v = stickVector(dx, dy, radius);
    if (v.x === 0 && v.y === 0) {
      this.attackHeld = false;
      return;
    }
    this.aim = v;
    this.attackHeld = true;
    this.latches.attack = true;
  }

  clearAim(): void {
    this.aim = undefined;
    this.attackHeld = false;
  }

  tap(action: TouchTap): void {
    this.latches[action] = true;
  }

  /** Bolt is held while pressed; a quick tap still latches so it is never lost between steps. */
  hold(action: 'bolt', down: boolean): void {
    this.boltHeld = down;
    if (down) this.latches[action] = true;
  }

  /** Requests the next stance after `current` and returns its index. */
  nextWeapon(current: number): number {
    const next = (current + 1) % WEAPON_COUNT;
    this.latches.weapon = next;
    return next;
  }

  /** The one-shot actions since the last call, then clears them. */
  consume(): TouchLatches {
    const out = this.latches;
    this.latches = freshLatches();
    return out;
  }

  /** Drops every held and latched touch, e.g. when a menu opens or the window loses focus. */
  reset(): void {
    this.clearMove();
    this.clearAim();
    this.boltHeld = false;
    this.latches = freshLatches();
  }
}
