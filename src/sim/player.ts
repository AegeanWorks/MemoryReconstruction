/**
 * Player controller: movement, the three-hit combo, dash, bolt and potion.
 */
import { angleBetween, inArc, rollDamage, type Arena } from './combat';
import type { InputFrame, Player } from './entities';
import { moveAndCollide } from './physics';
import { applyEquipment, emptyEquipment, type EquipmentSlots } from './equipment';
import { computeStats } from './upgrades';
import { WEAPONS, weaponDef } from './weapons';

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
/** Extra reach beyond the bodies for a dash to count as a near miss. */
const GRAZE_REACH = 24;

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
    weapon: 'sword',
    bombs: 2,
    traps: 1,
    artCooldown: 0,
    equipment: emptyEquipment(),
    inventory: [],
    nextEquipmentId: 1,
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
    dashGrazes: [],
    resonance: 0,
    resonanceTime: 0,
    boltCooldown: 0,
    invulnerable: 0,
    knockX: 0,
    knockY: 0,
    hurtFlash: 0,
  };
}

/** Recomputes stats after an upgrade, keeping health and mana as the same absolute values plus any gain. */
export function refreshStats(player: Player, equipped?: EquipmentSlots): void {
  const before = player.stats;
  const after = applyEquipment(computeStats(player.upgrades), equipped ?? player.equipment);
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
  p.artCooldown = Math.max(0, p.artCooldown - dt);
  p.comboWindow = Math.max(0, p.comboWindow - dt);
  p.resonanceTime = Math.max(0, p.resonanceTime - dt);
  if (p.resonanceTime === 0) p.resonance = 0;
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

  if (input.weapon >= 0 && input.weapon < WEAPONS.length) switchWeapon(arena, input.weapon);
  if (input.bomb) throwBomb(arena);
  if (input.trap) placeTrap(arena);
  if (input.art) useWeaponArt(arena);
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

  const speed = s.moveSpeed * (p.swingTime >= 0 ? weaponDef(p.weapon).moveFactor : 1);
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
  p.dashGrazes = [];
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
  arena.hitHazards(p.x, p.y, p.radius + 10, p.stats.meleeDamage * 0.35);
  for (const enemy of arena.enemies) {
    if (enemy.state === 'spawning' || enemy.state === 'dying') continue;
    const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    const touch = enemy.radius + p.radius;
    if (p.stats.dashStrike && !p.dashHits.includes(enemy.id) && dist <= touch + 6) {
      p.dashHits.push(enemy.id);
      const hit = rollDamage(
        arena.rng,
        p.stats.meleeDamage * 0.8,
        p.stats.critChance,
        p.stats.critMultiplier
      );
      arena.damageEnemy(enemy, hit.amount, 'dash', hit.crit, 120);
      continue;
    }
    // Slipping past a body without striking it is a near miss worth rewarding.
    if (dist > touch + GRAZE_REACH || p.dashGrazes.includes(enemy.id)) continue;
    p.dashGrazes.push(enemy.id);
    arena.graze(enemy.x, enemy.y);
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

/** Switches stance; a switch cancels the current swing but keeps the flow meter. */
function switchWeapon(arena: Arena, index: number): void {
  const p = arena.player;
  const next = WEAPONS[index].id;
  if (next === p.weapon) return;
  p.weapon = next;
  p.swingTime = -1;
  p.combo = 0;
  p.comboWindow = 0;
  arena.emit({ type: 'weaponSwitch', weapon: next });
}

/** Player-thrown bomb: arcs toward the aim, fuses, hurts both sides. */
function throwBomb(arena: Arena): void {
  const p = arena.player;
  if (p.bombs <= 0) return;
  p.bombs--;
  const speed = 400;
  arena.spawnBomb(
    p.x + Math.cos(p.aim) * 16,
    p.y + Math.sin(p.aim) * 16,
    Math.cos(p.aim) * speed,
    Math.sin(p.aim) * speed,
    'player',
    62,
    1.25
  );
}

/** Drops a trap just ahead of the player. It arms quickly and ignores sides. */
function placeTrap(arena: Arena): void {
  const p = arena.player;
  if (p.traps <= 0) return;
  p.traps--;
  arena.placePlayerTrap(p.x + Math.cos(p.aim) * 22, p.y + Math.sin(p.aim) * 22);
  arena.emit({ type: 'notice', text: 'Trap armed' });
}

/** Stance art on a cooldown: sword nova, spear pierce, greatsword quake. */
const ART_COOLDOWN = 7;

function useWeaponArt(arena: Arena): void {
  const p = arena.player;
  if (p.artCooldown > 0 || p.action === 'dead') return;
  const weapon = weaponDef(p.weapon);
  p.artCooldown = ART_COOLDOWN;
  p.swingTime = -1;
  p.combo = 0;
  p.comboWindow = 0;

  if (weapon.id === 'spear') {
    const dx = Math.cos(p.aim);
    const dy = Math.sin(p.aim);
    const ox = p.x;
    const oy = p.y;
    const ex = ox + dx * 150;
    const ey = oy + dy * 150;
    for (const enemy of arena.enemies) {
      if (enemy.state === 'dying') continue;
      if (segmentDistance(enemy.x, enemy.y, ox, oy, ex, ey) > enemy.radius + 26) continue;
      const hit = rollDamage(
        arena.rng,
        p.stats.meleeDamage * 1.85,
        p.stats.critChance,
        p.stats.critMultiplier
      );
      arena.damageEnemy(enemy, hit.amount, 'melee', hit.crit, 300);
    }
    arena.hitHazards((ox + ex) / 2, (oy + ey) / 2, 62, p.stats.meleeDamage * 1.5);
    moveAndCollide(arena.grid, p, dx * 150, dy * 150);
    arena.emit({
      type: 'weaponArt',
      weapon: 'spear',
      x: ox,
      y: oy,
      radius: 34,
      angle: p.aim,
      length: 150,
    });
  } else {
    const heavy = weapon.id === 'greatsword';
    const radius = heavy ? 165 : 120;
    const power = heavy ? 1.75 : 1.35;
    for (const enemy of arena.enemies) {
      if (enemy.state === 'dying') continue;
      if (Math.hypot(enemy.x - p.x, enemy.y - p.y) > radius + enemy.radius) continue;
      const hit = rollDamage(
        arena.rng,
        p.stats.meleeDamage * power,
        p.stats.critChance,
        p.stats.critMultiplier
      );
      arena.damageEnemy(enemy, hit.amount, 'melee', hit.crit, heavy ? 620 : 420);
    }
    arena.hitHazards(p.x, p.y, radius, p.stats.meleeDamage * power);
    arena.emit({
      type: 'weaponArt',
      weapon: weapon.id,
      x: p.x,
      y: p.y,
      radius,
    });
  }
  arena.emit({ type: 'shake', strength: weapon.id === 'greatsword' ? 9 : 5 });
  arena.emit({ type: 'notice', text: `${weapon.name} art` });
}

function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function startSwing(arena: Arena): void {
  const p = arena.player;
  const weapon = weaponDef(p.weapon);
  p.combo = p.comboWindow > 0 ? (p.combo + 1) % weapon.steps.length : 0;
  p.swingDuration = weapon.steps[p.combo].duration / p.stats.attackSpeed;
  p.swingTime = 0;
  p.swingHitDone = false;
  // A small forward step makes each swing feel committed.
  p.knockX += Math.cos(p.aim) * 110;
  p.knockY += Math.sin(p.aim) * 110;
  arena.emit({ type: 'swing', x: p.x, y: p.y, angle: p.aim, combo: p.combo, weapon: p.weapon });
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
    p.comboWindow = p.combo === weaponDef(p.weapon).steps.length - 1 ? 0 : COMBO_GRACE;
  }
}

function resolveSwing(arena: Arena): void {
  const p = arena.player;
  const weapon = weaponDef(p.weapon);
  const step = weapon.steps[p.combo];
  let landed = 0;
  for (const enemy of arena.enemies) {
    if (enemy.state === 'spawning' || enemy.state === 'dying') continue;
    if (!inArc(p.x, p.y, p.aim, step.reach, step.halfArc, enemy.x, enemy.y, enemy.radius)) continue;
    const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    // The spear rewards spacing: its tip bites harder than its haft.
    const reachBonus = weapon.id === 'spear' && dist > step.reach * 0.6 ? 1.2 : 1;
    const hit = rollDamage(
      arena.rng,
      p.stats.meleeDamage * step.damage * reachBonus,
      p.stats.critChance,
      p.stats.critMultiplier
    );
    arena.damageEnemy(enemy, hit.amount, 'melee', hit.crit, step.knockback);
    landed++;
  }
  // Swings also break destructible barrels in front of the player.
  arena.hitHazards(p.x, p.y, step.reach, p.stats.meleeDamage * step.damage);
  const finisher = p.combo === weapon.steps.length - 1;
  if (finisher && (p.stats.shockwave || weapon.finisherShockwave)) {
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
