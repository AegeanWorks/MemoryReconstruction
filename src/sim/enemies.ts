/**
 * Enemy behaviour. Every attack has a windup the view telegraphs, then an
 * attack phase, then a recovery window the player can punish. Enemies deal
 * no contact damage; only telegraphed attacks hurt.
 */
import { angleBetween, circlesTouch, inArc, type Arena } from './combat';
import type { EnemyDef } from './content';
import type { AttackKind, Enemy } from './entities';
import { hasLineOfSight, moveAndCollide } from './physics';

/** Windup seconds per attack kind; longer for heavier attacks. */
const WINDUP: Record<AttackKind, number> = {
  strike: 0.42,
  lunge: 0.4,
  slam: 0.75,
  shot: 0.55,
  spread: 0.6,
  ring: 0.7,
  charge: 0.65,
  volley: 0.55,
  summon: 0.8,
};

/** Seconds the attack phase lasts. */
const ACTIVE: Record<AttackKind, number> = {
  strike: 0.15,
  lunge: 0.22,
  slam: 0.12,
  shot: 0.1,
  spread: 0.1,
  ring: 0.1,
  charge: 0.6,
  volley: 0.5,
  summon: 0.1,
};

const BOSS_PATTERNS: Record<string, AttackKind[]> = {
  guardian: ['slam', 'charge', 'spread', 'slam'],
  spirit: ['ring', 'volley', 'summon', 'ring'],
  crystal_golem: ['slam', 'ring', 'charge', 'slam'],
  crystal_guardian: ['charge', 'spread', 'charge', 'ring'],
  forgotten: ['ring', 'summon', 'charge', 'volley'],
  keeper: ['ring', 'charge', 'volley', 'summon', 'slam', 'spread'],
};

/** Boss phase tuning: cooldown factor, ring bullets, bullet speed. */
const PHASES = [
  { cooldown: 1, ring: 10, speed: 170 },
  { cooldown: 0.8, ring: 14, speed: 195 },
  { cooldown: 0.62, ring: 18, speed: 220 },
] as const;

const SPAWN_TIME = 0.7;
const STAGGER_TIME = 0.16;
const DEATH_TIME = 0.5;
const MAX_SUMMONS = 4;

export function createEnemy(
  id: number,
  def: EnemyDef,
  x: number,
  y: number,
  roomId: number,
  scale: { health: number; damage: number },
  elite: boolean
): Enemy {
  const health = Math.round(def.maxHealth * scale.health * (elite ? 1.6 : 1));
  return {
    id,
    def: { ...def, damage: Math.round(def.damage * scale.damage * (elite ? 1.3 : 1)) },
    x,
    y,
    radius: def.radius * (elite ? 1.15 : 1),
    health,
    maxHealth: health,
    state: 'spawning',
    stateTime: SPAWN_TIME,
    cooldown: 0,
    attack: defaultAttack(def),
    dirX: 1,
    dirY: 0,
    knockX: 0,
    knockY: 0,
    flash: 0,
    roomId,
    elite,
    isBoss: def.archetype === 'boss',
    phase: 0,
    patternIndex: 0,
    attackLanded: false,
    strafe: 1,
  };
}

function defaultAttack(def: EnemyDef): AttackKind {
  switch (def.archetype) {
    case 'skirmisher':
      return 'lunge';
    case 'caster':
      return def.behavior === 'splitter' ? 'spread' : 'shot';
    case 'brute':
      return 'slam';
    case 'boss':
      return (BOSS_PATTERNS[def.id] ?? BOSS_PATTERNS.keeper)[0];
    default:
      return 'strike';
  }
}

/** Puts an enemy into its stagger state after a hit (bosses and attackers keep going). */
export function staggerEnemy(enemy: Enemy): void {
  if (
    enemy.isBoss ||
    enemy.state === 'windup' ||
    enemy.state === 'attack' ||
    enemy.state === 'spawning'
  )
    return;
  enemy.state = 'stagger';
  enemy.stateTime = STAGGER_TIME;
}

export function killEnemy(enemy: Enemy): void {
  enemy.state = 'dying';
  enemy.stateTime = DEATH_TIME;
}

/** Advances one enemy. Returns false once its death animation has finished. */
export function updateEnemy(arena: Arena, enemy: Enemy, dt: number): boolean {
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  enemy.stateTime -= dt;
  applyKnockback(arena, enemy, dt);

  switch (enemy.state) {
    case 'spawning':
      if (enemy.stateTime <= 0) {
        enemy.state = 'chase';
        enemy.cooldown = arena.rng.range(0.5, 1.2);
      }
      break;
    case 'dying':
      return enemy.stateTime > 0;
    case 'stagger':
      if (enemy.stateTime <= 0) enemy.state = 'chase';
      break;
    case 'chase':
      chase(arena, enemy, dt);
      break;
    case 'windup':
      windup(arena, enemy);
      break;
    case 'attack':
      attack(arena, enemy, dt);
      break;
    case 'recover':
      if (enemy.stateTime <= 0) enemy.state = 'chase';
      break;
  }
  return true;
}

function applyKnockback(arena: Arena, enemy: Enemy, dt: number): void {
  if (Math.abs(enemy.knockX) + Math.abs(enemy.knockY) < 1) return;
  moveAndCollide(arena.grid, enemy, enemy.knockX * dt, enemy.knockY * dt);
  const decay = Math.exp(-10 * dt);
  enemy.knockX *= decay;
  enemy.knockY *= decay;
}

function step(
  arena: Arena,
  enemy: Enemy,
  dirX: number,
  dirY: number,
  speed: number,
  dt: number
): void {
  moveAndCollide(arena.grid, enemy, dirX * speed * dt, dirY * speed * dt);
}

function chase(arena: Arena, enemy: Enemy, dt: number): void {
  const p = arena.player;
  const dx = p.x - enemy.x;
  const dy = p.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const def = enemy.def;
  const reach = def.attackRange + p.radius;
  const sight = hasLineOfSight(arena.grid, enemy.x, enemy.y, p.x, p.y);
  if (p.action === 'dead') return;
  // Straight in when the way is clear, otherwise around obstacles via the flow field.
  const toward = sight
    ? { x: nx, y: ny }
    : (arena.chaseDirection(enemy.x, enemy.y) ?? { x: nx, y: ny });

  switch (def.archetype) {
    case 'caster': {
      // Hold a preferred distance and strafe; back off when crowded.
      const preferred = 190;
      const radial = dist < preferred - 40 ? -1 : dist > preferred + 50 ? 1 : 0;
      if (arena.rng.chance(dt * 0.4)) enemy.strafe *= -1;
      if (!sight) step(arena, enemy, toward.x, toward.y, def.speed, dt);
      else
        step(
          arena,
          enemy,
          nx * radial - ny * enemy.strafe * 0.7,
          ny * radial + nx * enemy.strafe * 0.7,
          def.speed,
          dt
        );
      if (enemy.cooldown <= 0 && sight && dist < 380) beginWindup(arena, enemy, defaultAttack(def));
      break;
    }
    case 'skirmisher': {
      // Circle at mid range, then dart in.
      const circling = dist < 150;
      if (arena.rng.chance(dt * 0.5)) enemy.strafe *= -1;
      if (circling) step(arena, enemy, -ny * enemy.strafe, nx * enemy.strafe, def.speed * 0.9, dt);
      else step(arena, enemy, toward.x, toward.y, def.speed, dt);
      if (enemy.cooldown <= 0 && sight && dist < 175) beginWindup(arena, enemy, 'lunge');
      break;
    }
    case 'boss': {
      if (dist > 140) step(arena, enemy, toward.x, toward.y, def.speed, dt);
      if (enemy.cooldown <= 0) {
        const pattern = BOSS_PATTERNS[def.id] ?? BOSS_PATTERNS.keeper;
        const kind = pattern[enemy.patternIndex % pattern.length];
        enemy.patternIndex++;
        beginWindup(
          arena,
          enemy,
          kind === 'summon' && summonCount(arena, enemy) >= MAX_SUMMONS ? 'ring' : kind
        );
      }
      break;
    }
    default: {
      // melee and brute close in.
      if (dist > reach * 0.75) step(arena, enemy, toward.x, toward.y, def.speed, dt);
      if (enemy.cooldown <= 0 && dist <= reach + (def.archetype === 'brute' ? 30 : 8)) {
        beginWindup(arena, enemy, def.archetype === 'brute' ? 'slam' : 'strike');
      }
    }
  }
}

function summonCount(arena: Arena, boss: Enemy): number {
  return arena.enemies.filter((e) => !e.isBoss && e.roomId === boss.roomId && e.state !== 'dying')
    .length;
}

function beginWindup(arena: Arena, enemy: Enemy, kind: AttackKind): void {
  const p = arena.player;
  const angle = angleBetween(enemy.x, enemy.y, p.x, p.y);
  enemy.state = 'windup';
  enemy.attack = kind;
  enemy.stateTime =
    WINDUP[kind] * (enemy.isBoss ? Math.max(0.75, PHASES[enemy.phase].cooldown) : 1);
  enemy.dirX = Math.cos(angle);
  enemy.dirY = Math.sin(angle);
  enemy.attackLanded = false;
  arena.emit({ type: 'enemyWindup', id: enemy.id, attack: kind });
}

function windup(arena: Arena, enemy: Enemy): void {
  // Ranged attackers keep tracking until the last moment; melee commits early.
  const tracks = enemy.attack === 'shot' || enemy.attack === 'spread' || enemy.attack === 'volley';
  if (tracks && enemy.stateTime > 0.15) {
    const angle = angleBetween(enemy.x, enemy.y, arena.player.x, arena.player.y);
    enemy.dirX = Math.cos(angle);
    enemy.dirY = Math.sin(angle);
  }
  if (enemy.stateTime > 0) return;
  enemy.state = 'attack';
  enemy.stateTime = ACTIVE[enemy.attack];
  arena.emit({ type: 'enemyAttack', id: enemy.id, attack: enemy.attack, x: enemy.x, y: enemy.y });
  launch(arena, enemy);
}

/** The instant part of an attack, fired as the attack phase begins. */
function launch(arena: Arena, enemy: Enemy): void {
  const p = arena.player;
  const def = enemy.def;
  const phase = PHASES[enemy.phase];
  const angle = Math.atan2(enemy.dirY, enemy.dirX);
  switch (enemy.attack) {
    case 'strike':
      if (inArc(enemy.x, enemy.y, angle, def.attackRange + 14, 0.95, p.x, p.y, p.radius)) {
        arena.damagePlayer(def.damage, enemy.x, enemy.y, 260);
        enemy.attackLanded = true;
      }
      enemy.knockX += enemy.dirX * 160;
      enemy.knockY += enemy.dirY * 160;
      break;
    case 'slam': {
      const radius = slamRadius(enemy);
      if (circlesTouch(enemy.x, enemy.y, radius, p.x, p.y, p.radius))
        arena.damagePlayer(def.damage, enemy.x, enemy.y, 380);
      arena.emit({ type: 'shake', strength: enemy.isBoss ? 9 : 5 });
      break;
    }
    case 'shot':
      shoot(arena, enemy, angle, 230, def.damage);
      break;
    case 'spread':
      for (const offset of [-0.32, 0, 0.32])
        shoot(arena, enemy, angle + offset, enemy.isBoss ? phase.speed + 20 : 210, def.damage);
      break;
    case 'ring': {
      const count = enemy.isBoss ? phase.ring : 8;
      const twist = arena.rng.range(0, Math.PI * 2);
      for (let i = 0; i < count; i++)
        shoot(arena, enemy, twist + (i / count) * Math.PI * 2, phase.speed, def.damage);
      break;
    }
    case 'summon':
      summon(arena, enemy);
      break;
    case 'lunge':
    case 'charge':
    case 'volley':
      // Continuous attacks resolve over the attack phase.
      break;
  }
}

export function slamRadius(enemy: Enemy): number {
  return enemy.def.attackRange + (enemy.isBoss ? 60 : 34);
}

function shoot(arena: Arena, enemy: Enemy, angle: number, speed: number, damage: number): void {
  arena.spawnProjectile({
    owner: 'enemy',
    x: enemy.x + Math.cos(angle) * enemy.radius,
    y: enemy.y + Math.sin(angle) * enemy.radius,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: enemy.isBoss ? 8 : 7,
    damage,
    life: 3.5,
    pierce: 0,
  });
}

function summon(arena: Arena, boss: Enemy): void {
  const roster = ['memory_echo', 'scavenger'];
  for (let i = 0; i < 2; i++) {
    const angle = arena.rng.range(0, Math.PI * 2);
    const x = boss.x + Math.cos(angle) * 70;
    const y = boss.y + Math.sin(angle) * 70;
    if (arena.grid.isSolidAtPixel(x, y)) continue;
    arena.spawnEnemy(arena.rng.pick(roster), x, y, boss.roomId);
  }
}

function attack(arena: Arena, enemy: Enemy, dt: number): void {
  const p = arena.player;
  const def = enemy.def;
  if (enemy.attack === 'lunge' || enemy.attack === 'charge') {
    const speed = enemy.attack === 'charge' ? 520 : def.speed * 4 + 120;
    const hitWall = moveAndCollide(
      arena.grid,
      enemy,
      enemy.dirX * speed * dt,
      enemy.dirY * speed * dt
    );
    if (
      !enemy.attackLanded &&
      circlesTouch(enemy.x, enemy.y, enemy.radius + 4, p.x, p.y, p.radius)
    ) {
      arena.damagePlayer(def.damage, enemy.x, enemy.y, enemy.attack === 'charge' ? 420 : 260);
      enemy.attackLanded = true;
    }
    if (hitWall && enemy.attack === 'charge') {
      // Slamming into a wall leaves a boss open for a moment.
      arena.emit({ type: 'shake', strength: 7 });
      enemy.stateTime = 0;
      finishAttack(arena, enemy, 1.1);
      return;
    }
  } else if (enemy.attack === 'volley') {
    // Five aimed shots across the attack phase.
    const before = Math.floor(((ACTIVE.volley - enemy.stateTime - dt) / ACTIVE.volley) * 5);
    const after = Math.floor(((ACTIVE.volley - enemy.stateTime) / ACTIVE.volley) * 5);
    if (after > before && after < 5) {
      const angle = angleBetween(enemy.x, enemy.y, p.x, p.y);
      shoot(arena, enemy, angle, PHASES[enemy.phase].speed + 40, def.damage);
    }
  }
  if (enemy.stateTime <= 0) finishAttack(arena, enemy, enemy.isBoss ? 0.55 : 0.45);
}

function finishAttack(arena: Arena, enemy: Enemy, recover: number): void {
  enemy.state = 'recover';
  enemy.stateTime = recover;
  const base = enemy.isBoss
    ? Math.max(1.1, enemy.def.attackCooldown) * PHASES[enemy.phase].cooldown
    : enemy.def.attackCooldown;
  enemy.cooldown = base * arena.rng.range(0.85, 1.2);
}

/** Advances a boss to the phase its health calls for. Returns true when it changed. */
export function updateBossPhase(enemy: Enemy): boolean {
  if (!enemy.isBoss) return false;
  const fraction = enemy.health / enemy.maxHealth;
  const phase = fraction <= 0.3 ? 2 : fraction <= 0.6 ? 1 : 0;
  if (phase <= enemy.phase) return false;
  enemy.phase = phase;
  return true;
}
