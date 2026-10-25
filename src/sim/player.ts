/**
 * Player controller: movement, the three-hit combo, dash, bolt and potion.
 */
import { angleBetween, inArc, rollDamage, type Arena } from './combat';
import type { InputFrame, Player } from './entities';
import { moveAndCollide } from './physics';
import { computeStats } from './upgrades';

/** Per combo step: damage multiplier, reach, half-arc (radians), knockback, base duration. */
const COMBO = [
  { damage: 1, reach: 54, halfArc: 1.0, knockback: 150, duration: 0.3 },
  { damage: 1.15, reach: 56, halfArc: 1.0, knockback: 170, duration: 0.3 },
  { damage: 1.8, reach: 64, halfArc: 1.45, knockback: 340, duration: 0.4 },
] as const;
/** Fraction of a swing at which its hit lands. */
const SWING_ACTIVE_AT = 0.38;
const COMBO_GRACE = 0.4;
const DASH_TIME = 0.17;
const DASH_SPEED = 560;
const DASH_IFRAMES = 0.24;
const BOLT_SPEED = 560;
const BOLT_COOLDOWN = 0.3;
const BOLT_SPREAD = 0.2;
const POTION_HEAL = 0.45;
const SHOCKWAVE_RADIUS = 90;

export function createPlayer(x: number, y: number): Player {
  const stats = computeStats({});
  return {
    x,
    y,
    radius: 11,
    aim: 0,
    action: 'idle',
    health: stats.maxHealth,
    mana: stats.maxMana,
    stats,
    upgrades: {},
    level: 1,
    xp: 0,
    shards: 0,
    potions: 2,
    dashCharges: stats.dashCharges,
    combo: 0,
    swingTime: -1,
    swingDuration: 0,
    swingHitDone: false,
    comboWindow: 0,
    dashTime: 0,
    dashDirX: 1,
    dashDirY: 0,
    dashHits: [],
    boltCooldown: 0,
    invulnerable: 0,
    knockX: 0,
    knockY: 0,
    hurtFlash: 0,
  };
}

/** Recomputes stats after an upgrade, keeping health and mana as the same absolute values plus any gain. */
export function refreshStats(player: Player): void {
  const before = player.stats;
  const after = computeStats(player.upgrades);
  player.health = Math.min(
    after.maxHealth,
    player.health + Math.max(0, after.maxHealth - before.maxHealth)
  );
  player.mana = Math.min(after.maxMana, player.mana + Math.max(0, after.maxMana - before.maxMana));
  player.dashCharges = Math.min(
    after.dashCharges,
    player.dashCharges + Math.max(0, after.dashCharges - before.dashCharges)
  );
  player.stats = after;
}

export function updatePlayer(arena: Arena, input: InputFrame, dt: number): void {
  const p = arena.player;
  if (p.action === 'dead') return;
  const s = p.stats;

  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.boltCooldown = Math.max(0, p.boltCooldown - dt);
  p.comboWindow = Math.max(0, p.comboWindow - dt);
  p.mana = Math.min(s.maxMana, p.mana + s.manaRegen * dt);
  if (p.dashCharges < s.dashCharges)
    p.dashCharges = Math.min(s.dashCharges, p.dashCharges + dt / s.dashRecharge);
  p.aim = angleBetween(p.x, p.y, input.aimX, input.aimY);

  let moveX = input.moveX;
  let moveY = input.moveY;
  const len = Math.hypot(moveX, moveY);
  if (len > 1e-6) {
    moveX /= len;
    moveY /= len;
  }

  if (input.potion) drinkPotion(arena);
  if (input.dash && p.dashCharges >= 1 && p.dashTime <= 0)
    startDash(arena, len > 1e-6 ? moveX : Math.cos(p.aim), len > 1e-6 ? moveY : Math.sin(p.aim));

  if (p.dashTime > 0) {
    updateDash(arena, dt);
    return;
  }

  if (input.bolt) fireBolt(arena);
  if (input.attack && p.swingTime < 0) startSwing(arena);
  if (p.swingTime >= 0) updateSwing(arena, dt);

  const speed = s.moveSpeed * (p.swingTime >= 0 ? 0.4 : 1);
  moveAndCollide(arena.grid, p, (moveX * speed + p.knockX) * dt, (moveY * speed + p.knockY) * dt);
  const decay = Math.exp(-12 * dt);
  p.knockX *= decay;
  p.knockY *= decay;
  if (p.swingTime >= 0) p.action = 'attack';
  else p.action = len > 1e-6 ? 'move' : 'idle';
}

function drinkPotion(arena: Arena): void {
  const p = arena.player;
  if (p.potions <= 0 || p.health >= p.stats.maxHealth) return;
  const healed = Math.min(
    p.stats.maxHealth - p.health,
    Math.round(p.stats.maxHealth * POTION_HEAL)
  );
  p.potions--;
  p.health += healed;
  arena.emit({ type: 'potion', healed });
}

function startDash(arena: Arena, dirX: number, dirY: number): void {
  const p = arena.player;
  p.dashCharges -= 1;
  p.dashTime = DASH_TIME;
  p.dashDirX = dirX;
  p.dashDirY = dirY;
  p.dashHits = [];
  p.invulnerable = Math.max(p.invulnerable, DASH_IFRAMES);
  // Dashing cancels a swing; the combo stays alive for a dash-then-strike.
  p.swingTime = -1;
  p.comboWindow = Math.max(p.comboWindow, COMBO_GRACE);
  p.action = 'dash';
  arena.emit({ type: 'dash', x: p.x, y: p.y });
}

function updateDash(arena: Arena, dt: number): void {
  const p = arena.player;
  p.dashTime -= dt;
  p.action = 'dash';
  moveAndCollide(arena.grid, p, p.dashDirX * DASH_SPEED * dt, p.dashDirY * DASH_SPEED * dt);
  if (!p.stats.dashStrike) return;
  for (const enemy of arena.enemies) {
    if (enemy.state === 'spawning' || enemy.state === 'dying' || p.dashHits.includes(enemy.id))
      continue;
    if (Math.hypot(enemy.x - p.x, enemy.y - p.y) > enemy.radius + p.radius + 6) continue;
    p.dashHits.push(enemy.id);
    const hit = rollDamage(
      arena.rng,
      p.stats.meleeDamage * 0.8,
      p.stats.critChance,
      p.stats.critMultiplier
    );
    arena.damageEnemy(enemy, hit.amount, 'dash', hit.crit, 120);
  }
}

function fireBolt(arena: Arena): void {
  const p = arena.player;
  const s = p.stats;
  if (p.boltCooldown > 0 || p.mana < s.boltCost) return;
  p.mana -= s.boltCost;
  p.boltCooldown = BOLT_COOLDOWN;
  for (let i = 0; i < s.boltCount; i++) {
    const offset = (i - (s.boltCount - 1) / 2) * BOLT_SPREAD;
    const angle = p.aim + offset;
    arena.spawnProjectile({
      owner: 'player',
      x: p.x + Math.cos(angle) * 14,
      y: p.y + Math.sin(angle) * 14,
      vx: Math.cos(angle) * BOLT_SPEED,
      vy: Math.sin(angle) * BOLT_SPEED,
      radius: 6,
      damage: s.boltDamage,
      life: 0.85,
      pierce: s.boltPierce,
    });
  }
  arena.emit({ type: 'bolt', x: p.x, y: p.y, angle: p.aim });
}

function startSwing(arena: Arena): void {
  const p = arena.player;
  p.combo = p.comboWindow > 0 ? (p.combo + 1) % COMBO.length : 0;
  p.swingDuration = COMBO[p.combo].duration / p.stats.attackSpeed;
  p.swingTime = 0;
  p.swingHitDone = false;
  // A small forward step makes each swing feel committed.
  p.knockX += Math.cos(p.aim) * 110;
  p.knockY += Math.sin(p.aim) * 110;
  arena.emit({ type: 'swing', x: p.x, y: p.y, angle: p.aim, combo: p.combo });
}

function updateSwing(arena: Arena, dt: number): void {
  const p = arena.player;
  p.swingTime += dt;
  if (!p.swingHitDone && p.swingTime >= p.swingDuration * SWING_ACTIVE_AT) {
    p.swingHitDone = true;
    resolveSwing(arena);
  }
  if (p.swingTime >= p.swingDuration) {
    p.swingTime = -1;
    p.comboWindow = p.combo === COMBO.length - 1 ? 0 : COMBO_GRACE;
  }
}

function resolveSwing(arena: Arena): void {
  const p = arena.player;
  const step = COMBO[p.combo];
  let landed = 0;
  for (const enemy of arena.enemies) {
    if (enemy.state === 'spawning' || enemy.state === 'dying') continue;
    if (!inArc(p.x, p.y, p.aim, step.reach, step.halfArc, enemy.x, enemy.y, enemy.radius)) continue;
    const hit = rollDamage(
      arena.rng,
      p.stats.meleeDamage * step.damage,
      p.stats.critChance,
      p.stats.critMultiplier
    );
    arena.damageEnemy(enemy, hit.amount, 'melee', hit.crit, step.knockback);
    landed++;
  }
  const finisher = p.combo === COMBO.length - 1;
  if (finisher && p.stats.shockwave) {
    const cx = p.x + Math.cos(p.aim) * 30;
    const cy = p.y + Math.sin(p.aim) * 30;
    arena.emit({ type: 'shockwave', x: cx, y: cy, radius: SHOCKWAVE_RADIUS });
    for (const enemy of arena.enemies) {
      if (enemy.state === 'spawning' || enemy.state === 'dying') continue;
      if (Math.hypot(enemy.x - cx, enemy.y - cy) > SHOCKWAVE_RADIUS + enemy.radius) continue;
      arena.damageEnemy(enemy, Math.round(p.stats.meleeDamage * 0.7), 'shockwave', false, 220);
    }
  }
  if (landed > 0) {
    arena.hitstop(finisher ? 0.07 : 0.035);
    arena.emit({ type: 'shake', strength: finisher ? 5 : 2 });
  }
}
