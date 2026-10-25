/**
 * Plain-data entity records. Everything here is JSON-serializable so a world
 * can be inspected or snapshotted without custom code.
 */
import type { EnemyDef } from './content';
import type { PlayerStats } from './upgrades';

export type PlayerAction = 'idle' | 'move' | 'attack' | 'dash' | 'dead';

export interface Player {
  x: number;
  y: number;
  radius: number;
  /** Aim angle in radians; also the facing used for sprites. */
  aim: number;
  action: PlayerAction;
  health: number;
  mana: number;
  stats: PlayerStats;
  /** Upgrade id -> times taken. */
  upgrades: Record<string, number>;
  level: number;
  xp: number;
  shards: number;
  potions: number;
  /** Dash charges, fractional while recharging. */
  dashCharges: number;
  /** Combo step of the current or last swing (0..2). */
  combo: number;
  /** Seconds into the current swing; -1 when not swinging. */
  swingTime: number;
  swingDuration: number;
  swingHitDone: boolean;
  /** Seconds left in which the next swing continues the combo. */
  comboWindow: number;
  dashTime: number;
  dashDirX: number;
  dashDirY: number;
  /** Enemies already hit by the current dash (Phantom Rush). */
  dashHits: number[];
  boltCooldown: number;
  invulnerable: number;
  knockX: number;
  knockY: number;
  /** Seconds the hurt flash shows. */
  hurtFlash: number;
}

export type EnemyState =
  'spawning' | 'chase' | 'windup' | 'attack' | 'recover' | 'stagger' | 'dying';

/** Boss and caster attack shapes, also used by the view to draw telegraphs. */
export type AttackKind =
  'strike' | 'lunge' | 'slam' | 'shot' | 'spread' | 'ring' | 'charge' | 'volley' | 'summon';

export interface Enemy {
  id: number;
  def: EnemyDef;
  x: number;
  y: number;
  radius: number;
  health: number;
  maxHealth: number;
  state: EnemyState;
  /** Seconds left in the current state. */
  stateTime: number;
  /** Seconds until the next attack may start. */
  cooldown: number;
  attack: AttackKind;
  /** Locked attack direction during windup and attack. */
  dirX: number;
  dirY: number;
  knockX: number;
  knockY: number;
  /** Seconds the white hit flash shows. */
  flash: number;
  roomId: number;
  elite: boolean;
  isBoss: boolean;
  /** Boss phase 0..2, advancing at 60% and 30% health. */
  phase: number;
  /** Index into the boss pattern rotation. */
  patternIndex: number;
  /** Player already hit by this attack, so one swing deals damage once. */
  attackLanded: boolean;
  /** Strafe sign for casters and skirmishers. */
  strafe: number;
}

export type ProjectileOwner = 'player' | 'enemy';

export interface Projectile {
  id: number;
  owner: ProjectileOwner;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  /** Seconds before it fades. */
  life: number;
  /** Extra enemies it may pass through. */
  pierce: number;
  hitIds: number[];
}

export type PickupKind = 'shard' | 'health' | 'potion' | 'fragment';

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  amount: number;
  /** Fragment id for kind 'fragment'. */
  fragmentId?: string;
  /** Seconds since dropped; shards scatter briefly before homing. */
  age: number;
  vx: number;
  vy: number;
}

export type InteractableKind = 'chest' | 'shrine' | 'portal';

export interface Interactable {
  id: number;
  kind: InteractableKind;
  x: number;
  y: number;
  used: boolean;
  /** Shards a shrine upgrade costs. */
  cost: number;
}

/** One frame of player intent, produced by the input layer or a test. */
export interface InputFrame {
  /** Movement direction; any length, normalized by the sim. */
  moveX: number;
  moveY: number;
  /** Aim target in world pixels. */
  aimX: number;
  aimY: number;
  attack: boolean;
  bolt: boolean;
  dash: boolean;
  potion: boolean;
  interact: boolean;
}

export const NO_INPUT: Readonly<InputFrame> = {
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  attack: false,
  bolt: false,
  dash: false,
  potion: false,
  interact: false,
};
