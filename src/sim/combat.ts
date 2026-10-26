/**
 * Combat contract shared by the player and enemy logic.
 *
 * `Arena` is what the World exposes to actors; keeping it an interface lets
 * player.ts and enemies.ts stay free of any import of world.ts.
 */
import type { Enemy, Player, Projectile } from './entities';
import type { SimEvent } from './events';
import type { Rng } from './rng';
import type { TileGrid } from './tiles';

export type DamageSource = 'melee' | 'bolt' | 'dash' | 'shockwave' | 'hazard';

export interface Arena {
  readonly grid: TileGrid;
  readonly rng: Rng;
  readonly player: Player;
  readonly enemies: readonly Enemy[];
  emit(event: SimEvent): void;
  /** Applies damage, knockback, lifesteal and kill rewards. Returns damage dealt. */
  damageEnemy(
    enemy: Enemy,
    amount: number,
    source: DamageSource,
    crit: boolean,
    knockback: number
  ): number;
  /** Applies damage unless the player is invulnerable; knockback points away from (fromX, fromY). */
  damagePlayer(amount: number, fromX: number, fromY: number, knockback: number): void;
  spawnProjectile(projectile: Omit<Projectile, 'id' | 'hitIds'>): void;
  /** Spawns an enemy (with its spawn telegraph) into a room. */
  spawnEnemy(defId: string, x: number, y: number, roomId: number): Enemy;
  /** Unit direction from (x, y) toward the player around obstacles; undefined if unreachable. */
  chaseDirection(x: number, y: number): { x: number; y: number } | undefined;
  /** Freezes the simulation briefly to sell a heavy hit. */
  hitstop(seconds: number): void;
  /** Rewards a near miss with mana, dash charge and a refreshed flow window. */
  graze(x: number, y: number): void;
  /** Damages destructible barrels in a radius; returns how many broke. */
  hitHazards(x: number, y: number, radius: number, damage: number): number;
  /** Queues a delayed ground explosion. */
  spawnBlast(x: number, y: number, radius: number, delay: number, damage: number): void;
  /** Drops an armed proximity mine. */
  spawnMine(x: number, y: number, damage: number): void;
  /** Throws a bomb in a direction; it bounces off walls and fuses out. */
  spawnBomb(
    x: number,
    y: number,
    vx: number,
    vy: number,
    owner: 'player' | 'enemy',
    damage: number,
    fuse: number
  ): void;
  /** Places a player trap that arms after a moment and hurts both sides. */
  placePlayerTrap(x: number, y: number): void;
  /** Current section depth, so late enemies can pick late attacks. */
  readonly depth: number;
  /** This floor's enemy roster, so summons scale with the section. */
  readonly roster: readonly string[];
}

export function angleBetween(x0: number, y0: number, x1: number, y1: number): number {
  return Math.atan2(y1 - y0, x1 - x0);
}

/** Smallest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * True when a target circle touches the sector at (cx, cy) facing `angle`
 * with the given reach and half-angle. Targets overlapping the origin always count.
 */
export function inArc(
  cx: number,
  cy: number,
  angle: number,
  reach: number,
  halfAngle: number,
  tx: number,
  ty: number,
  targetRadius: number
): boolean {
  const dist = Math.hypot(tx - cx, ty - cy);
  if (dist > reach + targetRadius) return false;
  if (dist <= targetRadius + 4) return true;
  // Widen the arc by the angle the target's radius subtends.
  const slack = Math.asin(Math.min(1, targetRadius / dist));
  return Math.abs(angleDelta(angle, angleBetween(cx, cy, tx, ty))) <= halfAngle + slack;
}

export function circlesTouch(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number
): boolean {
  const r = ar + br;
  return (bx - ax) * (bx - ax) + (by - ay) * (by - ay) <= r * r;
}

/** Rolls a crit and returns the final damage and whether it critted. */
export function rollDamage(
  rng: Rng,
  base: number,
  critChance: number,
  critMultiplier: number
): { amount: number; crit: boolean } {
  const crit = rng.chance(critChance);
  const spread = rng.range(0.9, 1.1);
  return { amount: Math.max(1, Math.round(base * spread * (crit ? critMultiplier : 1))), crit };
}
