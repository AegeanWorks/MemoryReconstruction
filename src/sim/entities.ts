/**
 * Plain-data entity records. Everything here is JSON-serializable so a world
 * can be inspected or snapshotted without custom code.
 */
import type { EnemyDef } from './content';
import type { EquipmentItem, EquipmentSlots } from './equipment';
import type { PlayerStats } from './upgrades';
import type { WeaponId } from './weapons';

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
  /** Current melee stance. */
  weapon: WeaponId;
  /** Throwable bombs carried. */
  bombs: number;
  /** Placeable traps carried. */
  traps: number;
  /** Seconds until the stance weapon art is ready again. */
  artCooldown: number;
  /** Worn relics, one per slot. */
  equipment: EquipmentSlots;
  /** Unequipped relics carried this expedition. */
  inventory: EquipmentItem[];
  /** Monotonic id for new relic drops. */
  nextEquipmentId: number;
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
  /** Enemies already grazed by the current dash. */
  dashGrazes: number[];
  /** Kills in the current flow streak (0 when the window lapsed). */
  resonance: number;
  /** Seconds left before the flow streak lapses. */
  resonanceTime: number;
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
  | 'strike'
  | 'lunge'
  | 'slam'
  | 'shot'
  | 'spread'
  | 'ring'
  | 'charge'
  | 'volley'
  | 'summon'
  | 'beam'
  | 'mortar'
  | 'mines'
  | 'spiral'
  | 'blink'
  | 'bomb'
  | 'swarm'
  | 'hook'
  | 'quake';

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
  /** Player has already been rewarded for a near miss on this shot. */
  grazed?: boolean;
}

/** A delayed ground explosion (mortars, rockfall, mines). */
export interface Blast {
  id: number;
  x: number;
  y: number;
  radius: number;
  /** Seconds until it detonates. */
  delay: number;
  damage: number;
}

/** A thrown bomb: arcs, bounces off walls, fuses, then explodes. */
export interface Bomb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds until it explodes. */
  fuse: number;
  radius: number;
  damage: number;
  owner: 'player' | 'enemy';
}

/** A proximity mine that arms after a short delay. */
export interface Mine {
  id: number;
  x: number;
  y: number;
  damage: number;
  /** Seconds until armed. */
  arm: number;
  /** Seconds until it fizzles out. */
  life: number;
}

export type PickupKind = 'shard' | 'health' | 'potion' | 'fragment' | 'equipment' | 'bomb' | 'trap';

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  amount: number;
  /** Fragment id for kind 'fragment'. */
  fragmentId?: string;
  /** Relic for kind 'equipment'. */
  equipment?: EquipmentItem;
  /** Seconds since dropped; shards scatter briefly before homing. */
  age: number;
  vx: number;
  vy: number;
}

export type InteractableKind =
  | 'chest'
  | 'shrine'
  | 'portal'
  | 'lever'
  | 'fountain'
  | 'merchant'
  | 'structure'
  | 'npc'
  | 'gate'
  | 'archive';

export interface Interactable {
  id: number;
  kind: InteractableKind;
  x: number;
  y: number;
  used: boolean;
  /** Shards a shrine or merchant purchase costs. */
  cost: number;
  /** Room a lever disables hazards in. */
  roomId?: number;
  /** Sanctuary structure id (hearth, armory, ...). */
  structureId?: string;
  /** Sanctuary NPC id. */
  npcId?: string;
  /** Floating name shown above Sanctuary stations. */
  label?: string;
  /** A chest that turns out to be a mimic. */
  mimic?: boolean;
}

export type HazardKind = 'spike' | 'flame' | 'poison' | 'rockfall' | 'barrel' | 'trap';
export type HazardPhase = 'idle' | 'warning' | 'active';

/** A passive floor danger or a destructible barrel. */
export interface Hazard {
  id: number;
  kind: HazardKind;
  x: number;
  y: number;
  radius: number;
  roomId: number;
  phase: HazardPhase;
  /** Seconds until the next phase change. */
  timer: number;
  period: number;
  damage: number;
  hp: number;
  maxHp: number;
  disabled: boolean;
  /**
   * Player-placed traps do not fire while their owner is still standing on
   * them; they arm once the player steps clear, then treat everyone equally.
   */
  safePlayer?: boolean;
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
  /** Weapon index to switch to, or -1 to keep the current one. */
  weapon: number;
  /** Throw a bomb this frame. */
  bomb: boolean;
  /** Place a trap this frame. */
  trap: boolean;
  /** Trigger the stance weapon art. */
  art: boolean;
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
  weapon: -1,
  bomb: false,
  trap: false,
  art: false,
};
