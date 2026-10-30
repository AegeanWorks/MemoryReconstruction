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
  beam: 0.85,
  mortar: 0.7,
  mines: 0.6,
  spiral: 0.75,
  blink: 0.4,
  bomb: 0.6,
  swarm: 0.8,
  hook: 0.45,
  quake: 0.75,
  fan: 0.55,
  sweep: 0.9,
  wall: 0.65,
  pillars: 0.7,
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
  beam: 0.2,
  mortar: 0.15,
  mines: 0.15,
  spiral: 0.15,
  blink: 0.15,
  bomb: 0.15,
  swarm: 0.15,
  hook: 0.15,
  quake: 0.15,
  fan: 0.1,
  sweep: 0.7,
  wall: 0.15,
  pillars: 0.15,
};

const BOSS_PATTERNS: Record<string, AttackKind[]> = {
  guardian: ['slam', 'charge', 'spread', 'beam'],
  spirit: ['ring', 'volley', 'summon', 'spiral'],
  crystal_golem: ['slam', 'ring', 'mortar', 'slam'],
  crystal_guardian: ['charge', 'fan', 'beam', 'blink'],
  cinder_warden: ['slam', 'mortar', 'spread', 'beam'],
  leviathan: ['charge', 'ring', 'volley', 'spiral'],
  forgotten: ['ring', 'summon', 'blink', 'mines'],
  frost_warden: ['spread', 'sweep', 'ring', 'slam'],
  thorn_matriarch: ['summon', 'volley', 'mines', 'ring'],
  clockwork_regent: ['mortar', 'beam', 'spiral', 'charge'],
  mire_sovereign: ['mines', 'spiral', 'summon', 'mortar'],
  hive_queen: ['summon', 'swarm', 'bomb', 'spiral'],
  bone_tyrant: ['quake', 'hook', 'bomb', 'charge'],
  choir_hierophant: ['beam', 'spiral', 'swarm', 'hook'],
  hollow_behemoth: ['quake', 'charge', 'mines', 'mortar'],
  keeper: ['ring', 'beam', 'bomb', 'quake', 'blink', 'summon'],
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

/** Signature attack per special behaviour, so new enemies read differently. */
const BEHAVIOR_ATTACK: Record<string, AttackKind> = {
  storm_caller: 'fan',
  sweeper: 'sweep',
  wall_warden: 'wall',
  pillar_warden: 'pillars',
};

function defaultAttack(def: EnemyDef): AttackKind {
  const signature = BEHAVIOR_ATTACK[def.behavior];
  if (signature) return signature;
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
      if (enemy.cooldown <= 0 && sight && dist < 380) {
        const signature = BEHAVIOR_ATTACK[def.behavior];
        if (signature) {
          beginWindup(arena, enemy, signature);
          break;
        }
        const bomber =
          def.id === 'bombardier' || def.id === 'hive_drone' || def.id === 'hive_slinger';
        const late: AttackKind[] = ['shot', 'mortar', 'mines', 'spiral'];
        // Deep casters unlock lane beams and pulls, so the caster answer is not
        // always "strafe and shoot".
        if (arena.depth >= 8) late.push('beam');
        if (arena.depth >= 10) late.push('hook');
        const kind = bomber ? 'bomb' : arena.depth >= 4 ? arena.rng.pick(late) : defaultAttack(def);
        beginWindup(arena, enemy, kind);
      }
      break;
    }
    case 'skirmisher': {
      // Circle at mid range, then dart in.
      const circling = dist < 150;
      if (arena.rng.chance(dt * 0.5)) enemy.strafe *= -1;
      if (circling) step(arena, enemy, -ny * enemy.strafe, nx * enemy.strafe, def.speed * 0.9, dt);
      else step(arena, enemy, toward.x, toward.y, def.speed, dt);
      if (enemy.cooldown <= 0 && sight && dist < 175) {
        const kind =
          arena.depth >= 8 && arena.rng.chance(0.22)
            ? 'bomb'
            : arena.depth >= 6 && arena.rng.chance(0.35)
              ? 'blink'
              : 'lunge';
        beginWindup(arena, enemy, kind);
      }
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
  const tracks =
    enemy.attack === 'shot' ||
    enemy.attack === 'spread' ||
    enemy.attack === 'volley' ||
    enemy.attack === 'beam' ||
    enemy.attack === 'mortar';
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
    case 'beam': {
      // A long line attack: dodge out of the lane, not away from the caster.
      const length = 620;
      const width = enemy.isBoss ? 34 : 24;
      const ex = enemy.x + Math.cos(angle) * length;
      const ey = enemy.y + Math.sin(angle) * length;
      if (segmentDistance(p.x, p.y, enemy.x, enemy.y, ex, ey) <= width / 2 + p.radius)
        arena.damagePlayer(def.damage, enemy.x, enemy.y, 220);
      arena.emit({ type: 'beam', x: enemy.x, y: enemy.y, angle, length, width });
      arena.emit({ type: 'shake', strength: 6 });
      break;
    }
    case 'mortar':
      for (const offset of [-70, 0, 70]) {
        const a = angle + Math.PI / 2;
        arena.spawnBlast(
          p.x + Math.cos(a) * offset,
          p.y + Math.sin(a) * offset,
          enemy.isBoss ? 52 : 40,
          0.62,
          def.damage
        );
      }
      break;
    case 'mines':
      for (let i = 0; i < 3; i++) {
        const a = arena.rng.range(0, Math.PI * 2);
        arena.spawnMine(
          p.x + Math.cos(a) * 56,
          p.y + Math.sin(a) * 56,
          Math.round(def.damage * 0.9)
        );
      }
      break;
    case 'spiral': {
      const count = enemy.isBoss ? phase.ring : 8;
      const twist = (enemy.patternIndex + enemy.phase) * 0.35;
      for (let i = 0; i < count; i++)
        shoot(arena, enemy, twist + (i / count) * Math.PI * 2, phase.speed * 0.85, def.damage);
      break;
    }
    case 'blink': {
      const a = arena.rng.range(0, Math.PI * 2);
      const tx = p.x + Math.cos(a) * 58;
      const ty = p.y + Math.sin(a) * 58;
      const oldX = enemy.x;
      const oldY = enemy.y;
      if (!arena.grid.isSolidAtPixel(tx, ty)) {
        enemy.x = tx;
        enemy.y = ty;
        arena.emit({ type: 'blink', x: oldX, y: oldY, toX: tx, toY: ty });
      }
      if (Math.hypot(p.x - enemy.x, p.y - enemy.y) <= 86)
        arena.damagePlayer(def.damage, enemy.x, enemy.y, 320);
      break;
    }
    case 'bomb':
      arena.spawnBomb(
        enemy.x + Math.cos(angle) * 18,
        enemy.y + Math.sin(angle) * 18,
        Math.cos(angle) * 260,
        Math.sin(angle) * 260,
        'enemy',
        Math.round(def.damage * 0.9),
        1.55
      );
      break;
    case 'swarm': {
      const roster = arena.roster.length > 0 ? arena.roster : ['scavenger'];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + arena.rng.range(0, 1);
        const x = enemy.x + Math.cos(a) * 56;
        const y = enemy.y + Math.sin(a) * 56;
        if (arena.grid.isSolidAtPixel(x, y)) continue;
        const e = arena.spawnEnemy(arena.rng.pick(roster), x, y, enemy.roomId);
        e.state = 'chase';
      }
      break;
    }
    case 'hook':
      if (Math.hypot(enemy.x - p.x, enemy.y - p.y) <= 330) {
        arena.damagePlayer(Math.round(def.damage * 0.6), enemy.x, enemy.y, 40);
        p.knockX += (enemy.x - p.x) * 3.4;
        p.knockY += (enemy.y - p.y) * 3.4;
        arena.emit({ type: 'hook', x: enemy.x, y: enemy.y, toX: p.x, toY: p.y });
      }
      break;
    case 'quake':
      for (let i = 1; i <= 4; i++)
        arena.spawnBlast(
          enemy.x + Math.cos(angle) * 62 * i,
          enemy.y + Math.sin(angle) * 62 * i,
          40,
          0.42 + i * 0.09,
          Math.round(def.damage * 0.8)
        );
      break;
    case 'fan': {
      // A wide five-shot cone: step through it or get around the caster.
      const speed = enemy.isBoss ? phase.speed + 10 : 210;
      for (const offset of [-0.5, -0.25, 0, 0.25, 0.5])
        shoot(arena, enemy, angle + offset, speed, def.damage);
      break;
    }
    case 'wall': {
      // A curtain of bolts with one gap: dash the gap or leave the lane.
      // Fixed gap so the telegraph and the curtain agree.
      const gap = 2;
      for (let i = 0; i < 6; i++) {
        if (i === gap || i === gap + 1) continue;
        const offset = -100 + i * 40;
        const px = enemy.x + Math.cos(angle + Math.PI / 2) * offset;
        const py = enemy.y + Math.sin(angle + Math.PI / 2) * offset;
        if (arena.grid.isSolidAtPixel(px, py)) continue;
        arena.spawnProjectile({
          owner: 'enemy',
          x: px,
          y: py,
          vx: Math.cos(angle) * 175,
          vy: Math.sin(angle) * 175,
          radius: 8,
          damage: def.damage,
          life: 4,
          pierce: 0,
        });
      }
      break;
    }
    case 'pillars':
      // Eruptions march toward the player, alternating off the centre line.
      for (let i = 1; i <= 5; i++) {
        const side = i % 2 === 0 ? 44 : -44;
        arena.spawnBlast(
          enemy.x + Math.cos(angle) * 58 * i + Math.cos(angle + Math.PI / 2) * side,
          enemy.y + Math.sin(angle) * 58 * i + Math.sin(angle + Math.PI / 2) * side,
          38,
          0.32 + i * 0.13,
          Math.round(def.damage * 0.85)
        );
      }
      break;
    case 'sweep':
      // The beam damage is resolved frame by frame in attack().
      arena.emit({ type: 'shake', strength: 4 });
      break;
    case 'lunge':
    case 'charge':
    case 'volley':
      // Continuous attacks resolve over the attack phase.
      break;
  }
}

/** Shortest distance from a point to a line segment. */
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
  // Summons come from the floor's own roster, so late bosses call late enemies.
  const roster = arena.roster.length > 0 ? arena.roster : ['memory_echo', 'scavenger'];
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
  } else if (enemy.attack === 'sweep') {
    // A rotating beam: one clean hit per sweep, telegraphed by the full arc.
    const span = 1.8;
    const base = Math.atan2(enemy.dirY, enemy.dirX);
    const progress = 1 - enemy.stateTime / ACTIVE.sweep;
    const angle = base - span / 2 + progress * span;
    const ex = enemy.x + Math.cos(angle) * 520;
    const ey = enemy.y + Math.sin(angle) * 520;
    const width = enemy.isBoss ? 30 : 22;
    if (
      !enemy.attackLanded &&
      segmentDistance(p.x, p.y, enemy.x, enemy.y, ex, ey) <= width / 2 + p.radius
    ) {
      arena.damagePlayer(def.damage, enemy.x, enemy.y, 240);
      enemy.attackLanded = true;
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
