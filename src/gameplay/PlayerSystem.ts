/**
 * Player System - Player entity management, stats, progression
 *
 * Handles player state, movement, abilities, inventory,
 * and progression systems for the roguelike Metroidvania.
 */

import type { EventBus } from '@core/EventBus';
import { GameEvents } from '@core/EventBus';
import type { IGameModule, ModuleContext, ModuleState } from '@core/ModuleRegistry';
import type { GameplayConfig } from '@core/ConfigManager';
import type { InputSystem } from '@engine/InputSystem';
import type { WorldSystem } from './WorldSystem';

export interface PlayerStats {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;

  // Base stats
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;

  // Derived stats
  damage: number;
  attackSpeed: number;
  moveSpeed: number;
  dashCooldown: number;
  dashDistance: number;
  critChance: number;
  critMultiplier: number;
  armor: number;
  resistance: number;

  // Progression
  level: number;
}

export interface PlayerState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  facing: 1 | -1;
  grounded: boolean;
  dashing: boolean;
  attacking: boolean;
  interacting: boolean;
  invincible: boolean;
  invincibilityTimer: number;
  /** While positive, input no longer overwrites knockback velocity. */
  knockbackTimer: number;
}

export interface Ability {
  id: string;
  name: string;
  type: 'active' | 'passive' | 'ultimate';
  cooldown: number;
  currentCooldown: number;
  manaCost: number;
  level: number;
  maxLevel: number;
  unlocked: boolean;
}

export interface InventoryItem {
  id: string;
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'key' | 'memory';
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  stats: Record<string, number>;
  quantity: number;
  maxStack: number;
}

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export type EquipmentState = Record<EquipmentSlot, InventoryItem | null>;

export interface ProgressionData {
  level: number;
  experience: number;
  experienceToNext: number;
  statPoints: number;
  memoryFragments: number;
  unlockedAbilities: string[];
  completedRuns: number;
  deepestDepth: number;
  totalPlayTime: number;
  enemiesDefeated: number;
  deaths: number;
}

export class PlayerSystem implements IGameModule {
  readonly name = 'playerSystem';
  readonly version = '1.0.0';
  readonly dependencies = ['inputSystem', 'worldSystem'];
  readonly tokenBudget = 2000;

  private eventBus: EventBus;
  private config: GameplayConfig;
  private inputSystem!: InputSystem;
  private worldSystem!: WorldSystem;

  // Player data
  private stats!: PlayerStats;
  private state!: PlayerState;
  private abilities = new Map<string, Ability>();
  private inventory: InventoryItem[] = [];
  private equipment: EquipmentState = { weapon: null, armor: null, accessory: null };
  private progression!: ProgressionData;

  // Movement
  private moveSpeed = 200;
  private dashCooldownTimer = 0;
  private lastDashDirection = { x: 0, y: 0 };

  // Combat
  private attackTimer = 0;
  private comboCount = 0;
  private comboTimer = 0;

  // Transient action states are driven by simulation time, never wall-clock
  // timers: the game loop and headless replays must stay deterministic.
  private simTime = 0;
  private attackAnimTimer = 0;
  private dashStateTimer = 0;
  private interactTimer = 0;

  // Memory Surge: chained pickups/kills within a window multiply fragment XP.
  private surgeStreak = 0;
  private surgeTimer = 0;

  // A Keeper kill completes the current run once; another kill only counts
  // after death starts a new run.
  private runCompleted = false;

  // RNG for deterministic behavior
  private rng: () => number;

  constructor(eventBus: EventBus, config: GameplayConfig) {
    this.eventBus = eventBus;
    this.config = config;
    this.rng = this.createRNG(config.world.seed + 1000);

    this.initializeStats();
    this.initializeState();
    this.initializeAbilities();
    this.initializeProgression();
  }

  private createRNG(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  private initializeStats(): void {
    const pc = this.config.player;
    const cc = this.config.combat;

    this.stats = {
      health: pc.baseHealth,
      maxHealth: pc.baseHealth,
      mana: 50,
      maxMana: 50,
      stamina: 100,
      maxStamina: 100,
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      vitality: 10,
      damage: pc.baseDamage,
      attackSpeed: 1.0,
      moveSpeed: pc.baseSpeed,
      dashCooldown: pc.dashCooldown,
      dashDistance: pc.dashDistance,
      critChance: cc.criticalChance,
      critMultiplier: cc.criticalMultiplier,
      armor: 0,
      resistance: 0,
      level: 1,
    };
  }

  private initializeState(): void {
    this.state = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      facing: 1,
      grounded: false,
      dashing: false,
      attacking: false,
      interacting: false,
      invincible: false,
      invincibilityTimer: 0,
      knockbackTimer: 0,
    };
  }

  private initializeAbilities(): void {
    const abilityList: Ability[] = [
      {
        id: 'dash',
        name: 'Phase Dash',
        type: 'active',
        cooldown: 1.0,
        currentCooldown: 0,
        manaCost: 0,
        level: 1,
        maxLevel: 3,
        unlocked: true,
      },
      {
        id: 'slash',
        name: 'Memory Slash',
        type: 'active',
        cooldown: 0.3,
        currentCooldown: 0,
        // The basic attack is free. Mana is the resource for abilities, so a
        // player never runs out of their primary weapon mid-fight.
        manaCost: 0,
        level: 1,
        maxLevel: 5,
        unlocked: true,
      },
      {
        id: 'heal',
        name: 'Recollection',
        type: 'active',
        cooldown: 10.0,
        currentCooldown: 0,
        manaCost: 20,
        level: 1,
        maxLevel: 3,
        unlocked: false,
      },
      {
        id: 'shield',
        name: 'Mnemonic Barrier',
        type: 'active',
        cooldown: 15.0,
        currentCooldown: 0,
        manaCost: 30,
        level: 1,
        maxLevel: 3,
        unlocked: false,
      },
      {
        id: 'ultimate',
        name: 'Reconstruction',
        type: 'ultimate',
        cooldown: 60.0,
        currentCooldown: 0,
        manaCost: 50,
        level: 1,
        maxLevel: 1,
        unlocked: false,
      },
      {
        id: 'passive_regen',
        name: 'Memory Flow',
        type: 'passive',
        cooldown: 0,
        currentCooldown: 0,
        manaCost: 0,
        level: 1,
        maxLevel: 5,
        unlocked: true,
      },
      {
        id: 'passive_crit',
        name: 'Keen Insight',
        type: 'passive',
        cooldown: 0,
        currentCooldown: 0,
        manaCost: 0,
        level: 1,
        maxLevel: 3,
        unlocked: false,
      },
    ];

    for (const ability of abilityList) {
      this.abilities.set(ability.id, ability);
    }
  }

  private initializeProgression(): void {
    this.progression = {
      level: 1,
      experience: 0,
      experienceToNext: this.experienceForLevel(1),
      statPoints: 0,
      memoryFragments: 0,
      unlockedAbilities: ['dash', 'slash'],
      completedRuns: 0,
      deepestDepth: 0,
      totalPlayTime: 0,
      enemiesDefeated: 0,
      deaths: 0,
    };
  }

  async initialize(context: ModuleContext): Promise<void> {
    this.inputSystem = context.sharedState.get('inputSystem');
    this.worldSystem = context.sharedState.get('worldSystem');

    // Event listeners
    this.eventBus.on(GameEvents.PLAYER_MOVE, (data: any) => this.onMove(data));
    this.eventBus.on(GameEvents.PLAYER_ATTACK, () => this.onAttack());
    this.eventBus.on(GameEvents.PLAYER_DAMAGE, (data: any) => this.onDamage(data));
    this.eventBus.on(GameEvents.PLAYER_HEAL, (data: any) => this.onHeal(data));
    this.eventBus.on('player:dash', () => this.onDash());
    this.eventBus.on('player:interact', () => this.onInteract());
    this.eventBus.on('player:useAbility', (data: any) => this.useAbility(data.id));
    this.eventBus.on('player:addExperience', (data: any) => this.addExperience(data.amount));
    this.eventBus.on('player:addMemory', (data: any) =>
      this.grantMemoryFragments(data?.amount ?? 1)
    );
    this.eventBus.on('player:addItem', (data: any) => this.addItem(data.item));
    this.eventBus.on('player:grantLevel', () => this.onLevelUp());
    // Hit-confirm: the combo chain advances only after CombatSystem reports
    // that a swing connected, so whiffing cannot inflate damage.
    this.eventBus.on('combat:attackResolved', (data: any) => this.onAttackResolved(data));
    // Run telemetry: depth is chunk-derived and boss kills close a run.
    this.eventBus.on('world:depthChanged', (data: any) => this.onDepthChanged(data));
    this.eventBus.on('combat:bossDefeated', (data: any) => this.onBossDefeated(data));

    this.eventBus.emit('playerSystem:ready', { stats: this.stats });
  }

  update(deltaTime: number): void {
    this.simTime += deltaTime;
    // Integrate movement before timers transition states, so the last frame of
    // a dash still applies its full velocity.
    this.updateMovement(deltaTime);
    this.updateTimers(deltaTime);
    this.updateAbilities(deltaTime);
    this.updateProgression(deltaTime);
    this.emitPlayerState();
  }

  private updateTimers(deltaTime: number): void {
    // Invincibility
    if (this.state.invincible) {
      this.state.invincibilityTimer -= deltaTime;
      if (this.state.invincibilityTimer <= 0) {
        this.state.invincible = false;
      }
    }

    // Knockback lock: keep the impulse alive for a few frames instead of
    // letting the next movement update overwrite it instantly.
    if (this.state.knockbackTimer > 0) {
      this.state.knockbackTimer -= deltaTime;
    }

    // Dash cooldown
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= deltaTime;
    }

    // Attack timer
    if (this.attackTimer > 0) {
      this.attackTimer -= deltaTime;
    }

    // Transient action states
    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer -= deltaTime;
      if (this.attackAnimTimer <= 0) this.state.attacking = false;
    }
    if (this.dashStateTimer > 0) {
      this.dashStateTimer -= deltaTime;
      if (this.dashStateTimer <= 0) {
        this.state.dashing = false;
        this.state.velocity.x *= 0.1;
        this.state.velocity.y *= 0.1;
      }
    }
    if (this.interactTimer > 0) {
      this.interactTimer -= deltaTime;
      if (this.interactTimer <= 0) this.state.interacting = false;
    }

    // Combo window: the chain drops when the player stops applying pressure
    if (this.comboTimer > 0) {
      this.comboTimer -= deltaTime;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Memory Surge window decays independently of the combo chain
    if (this.surgeTimer > 0) {
      this.surgeTimer -= deltaTime;
      if (this.surgeTimer <= 0) this.surgeStreak = 0;
    }
  }

  private updateMovement(deltaTime: number): void {
    // A dash owns the velocity for its whole duration; knockback also owns it
    // briefly so a hit visibly shoves the player before control returns.
    if (!this.state.dashing && this.state.knockbackTimer <= 0) {
      if (!this.inputSystem) return;

      const movement = this.inputSystem.getMovementVector();

      // Apply movement velocity
      if (movement.x !== 0 || movement.y !== 0) {
        this.state.velocity.x = movement.x * this.stats.moveSpeed;
        this.state.velocity.y = movement.y * this.stats.moveSpeed;

        // Update facing
        if (movement.x !== 0) {
          this.state.facing = movement.x > 0 ? 1 : -1;
        }
      } else {
        // Deceleration
        this.state.velocity.x *= 0.8;
        this.state.velocity.y *= 0.8;
        if (Math.abs(this.state.velocity.x) < 5) this.state.velocity.x = 0;
        if (Math.abs(this.state.velocity.y) < 5) this.state.velocity.y = 0;
      }
    } else if (this.state.knockbackTimer > 0) {
      // Friction while the impulse plays out, so knockback is a shove and not
      // a teleport across the room.
      this.state.velocity.x *= 0.9;
      this.state.velocity.y *= 0.9;
    }

    // Collision-aware position integration (no async feedback loop)
    this.resolveMovement(deltaTime);

    // Inform WorldSystem for streaming
    this.eventBus.emit('player:position', {
      x: this.state.position.x,
      y: this.state.position.y,
    });
  }

  private resolveMovement(deltaTime: number): void {
    const margin = 10;
    const dx = this.state.velocity.x * deltaTime;
    const dy = this.state.velocity.y * deltaTime;

    if (dx !== 0) {
      const nextX = this.state.position.x + dx;
      const testX = nextX + (dx > 0 ? margin : -margin);
      if (this.worldSystem && this.worldSystem.isSolidAt(testX, this.state.position.y)) {
        this.state.velocity.x = 0;
      } else {
        this.state.position.x = nextX;
      }
    }

    if (dy !== 0) {
      const nextY = this.state.position.y + dy;
      const testY = nextY + (dy > 0 ? margin : -margin);
      if (this.worldSystem && this.worldSystem.isSolidAt(this.state.position.x, testY)) {
        this.state.velocity.y = 0;
        this.state.grounded = dy >= 0;
      } else {
        this.state.position.y = nextY;
      }
    }
  }

  private updateAbilities(deltaTime: number): void {
    for (const ability of this.abilities.values()) {
      if (ability.currentCooldown > 0) {
        ability.currentCooldown = Math.max(0, ability.currentCooldown - deltaTime);
      }
    }

    // Passive regeneration
    const regen = this.abilities.get('passive_regen');
    if (regen?.unlocked && regen.level > 0) {
      const healAmount = regen.level * 0.5 * deltaTime;
      this.heal(healAmount);
      // Mana recovers fast enough that abilities are usable each fight, while
      // their cooldowns still gate burst value.
      const manaRegen = (1 + regen.level * 0.5) * deltaTime;
      this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana + manaRegen);
    }

    // Stamina gates chained dashes; the dash cooldown still gates single ones.
    this.stats.stamina = Math.min(
      this.stats.maxStamina,
      this.stats.stamina + this.config.player.staminaRegen * deltaTime
    );
  }

  private updateProgression(deltaTime: number): void {
    this.progression.totalPlayTime += deltaTime;
  }

  private emitPlayerState(): void {
    this.eventBus.emitSync('player:stateUpdate', {
      position: this.state.position,
      velocity: this.state.velocity,
      stats: this.stats,
      state: this.state,
    });
  }

  // Event Handlers

  private onMove(data: { x: number; y: number }): void {
    this.state.position.x = data.x;
    this.state.position.y = data.y;
  }

  private onAttack(): void {
    if (this.attackTimer > 0 || this.state.attacking) return;

    const slash = this.abilities.get('slash');
    if (!slash?.unlocked) return;

    if (this.stats.mana < slash.manaCost) return;

    this.stats.mana -= slash.manaCost;
    const attackCooldown = slash.cooldown / Math.max(0.1, this.stats.attackSpeed);
    this.attackTimer = attackCooldown;
    slash.currentCooldown = attackCooldown;
    this.state.attacking = true;
    this.attackAnimTimer = 0.1;

    // The combo count is the chain *already confirmed* by previous hits. A
    // swing uses that multiplier; only a connecting hit extends the chain in
    // onAttackResolved(), so attacking empty air cannot farm damage.
    const comboMultiplier = 1 + this.comboCount * this.config.combat.comboDamageStep;

    // The combat system applies the critical multiplier, so the intent carries
    // base damage plus the crit flag instead of a pre-multiplied value.
    const isCrit = this.rng() < this.stats.critChance;
    const damage = this.stats.damage * comboMultiplier;

    this.eventBus.emit(GameEvents.COMBAT_ATTACK, {
      sourceId: 'player',
      x: this.state.position.x + this.state.facing * this.config.combat.meleeOffset,
      y: this.state.position.y,
      radius: this.config.combat.meleeRange,
      damage,
      critical: isCrit,
      knockbackForce: this.config.combat.knockbackForce,
      statusEffects: [],
      facing: this.state.facing,
      arc: this.config.combat.meleeArc,
      combo: this.comboCount,
    });
  }

  /** Called once per resolved swing, after CombatSystem counts actual hits. */
  private onAttackResolved(data: { sourceId?: string; hits?: number; ultimate?: boolean }): void {
    if (data?.sourceId !== 'player') return;
    if (typeof data.hits !== 'number' || !Number.isFinite(data.hits) || data.hits <= 0) return;

    const comboMax = this.config.combat.comboMax;
    this.comboCount = Math.min(this.comboCount + 1, comboMax);
    this.comboTimer = this.config.combat.comboWindow;

    this.eventBus.emit('player:combo', {
      count: this.comboCount,
      max: comboMax,
      damageMultiplier: 1 + this.comboCount * this.config.combat.comboDamageStep,
      hits: data.hits,
      ultimate: Boolean(data.ultimate),
    });
  }

  private onDash(): void {
    if (this.dashCooldownTimer > 0 || this.state.dashing) return;

    const dash = this.abilities.get('dash');
    if (!dash?.unlocked) return;

    const staminaCost = this.config.player.dashStaminaCost;
    if (this.stats.stamina < staminaCost) return;

    const movement = this.inputSystem?.getMovementVector() ?? { x: 0, y: 0 };

    // Default to facing direction if no input
    if (movement.x === 0 && movement.y === 0) {
      movement.x = this.state.facing;
    }

    // Normalize
    const len = Math.sqrt(movement.x * movement.x + movement.y * movement.y);
    if (len > 0) {
      movement.x /= len;
      movement.y /= len;
    }

    this.lastDashDirection = { ...movement };
    this.state.dashing = true;
    this.dashCooldownTimer = this.stats.dashCooldown;
    dash.currentCooldown = dash.cooldown;
    this.stats.stamina = Math.max(0, this.stats.stamina - staminaCost);

    // Constant dash speed over a fixed duration covers exactly dashDistance.
    const dashDuration = 0.15;
    this.dashStateTimer = dashDuration;
    const dashSpeed = this.stats.dashDistance / dashDuration;
    this.state.velocity.x = movement.x * dashSpeed;
    this.state.velocity.y = movement.y * dashSpeed;

    // Invincibility during dash
    this.state.invincible = true;
    this.state.invincibilityTimer = 0.3;

    // Visual effect
    this.eventBus.emit(GameEvents.GRAPHICS_EFFECT, {
      type: 'dash',
      x: this.state.position.x,
      y: this.state.position.y,
      scale: 1.5,
      tint: 0x00ffff,
    });
  }

  private onInteract(): void {
    this.state.interacting = true;
    this.interactTimer = 0.2;
    this.eventBus.emit('player:interactCheck', {
      x: this.state.position.x,
      y: this.state.position.y,
      facing: this.state.facing,
    });
  }

  private onDamage(data: {
    amount: number;
    source: string;
    knockback?: { x: number; y: number };
    critical?: boolean;
  }): void {
    if (this.state.invincible) return;

    // Enemy criticals use the global combat multiplier. Player gear may raise
    // the player's outgoing crit multiplier, but it must not make incoming
    // enemy crits stronger.
    const criticalMultiplier = data.critical ? this.config.combat.criticalMultiplier : 1;
    const reduction = this.stats.armor / (this.stats.armor + 100);
    const finalDamage = Math.max(1, Math.floor(data.amount * criticalMultiplier * (1 - reduction)));

    this.stats.health = Math.max(0, this.stats.health - finalDamage);

    // Invincibility frames
    this.state.invincible = true;
    this.state.invincibilityTimer = this.config.player.invincibilityFrames;

    // Taking a hit breaks both reward chains: aggressive play is rewarded,
    // sloppy play is punished.
    this.comboCount = 0;
    this.comboTimer = 0;
    this.surgeStreak = 0;
    this.surgeTimer = 0;

    // Knockback: hold control for a short window so the shove reads on screen
    // instead of being erased by the next input frame.
    if (data.knockback) {
      this.state.velocity.x += data.knockback.x;
      this.state.velocity.y += data.knockback.y;
      this.state.knockbackTimer = 0.25;
    }

    // Visual feedback
    this.eventBus.emit(GameEvents.GRAPHICS_SCREEN_SHAKE, { intensity: 5, duration: 0.2 });
    this.eventBus.emit(GameEvents.GRAPHICS_EFFECT, {
      type: 'damage',
      x: this.state.position.x,
      y: this.state.position.y,
      tint: 0xff0000,
    });

    // Check death
    if (this.stats.health <= 0) {
      this.onDeath();
    }

    // PLAYER_DAMAGE is an input command (CombatSystem emits it when an attack
    // connects). Do not re-emit it here: a self-subscribed re-emit would run
    // this handler twice per hit. Health is published via player:stateUpdate.
  }

  private onHeal(data: { amount: number; source: string }): void {
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + data.amount);
    // Likewise, PLAYER_HEAL is an input command and must not be re-emitted:
    // this handler used to emit it, which recursed until the stack overflowed.
  }

  private onDepthChanged(data: { depth?: number }): void {
    if (typeof data?.depth !== 'number' || !Number.isFinite(data.depth)) return;
    if (data.depth <= this.progression.deepestDepth) return;
    this.progression.deepestDepth = data.depth;
    this.eventBus.emit('player:depthChanged', { depth: data.depth });
  }

  private onBossDefeated(data: { type?: string }): void {
    if (data?.type !== 'keeper') return;
    if (this.runCompleted) return;
    this.runCompleted = true;
    this.progression.completedRuns++;
    this.eventBus.emit('player:runCompleted', {
      completedRuns: this.progression.completedRuns,
      deepestDepth: this.progression.deepestDepth,
      level: this.progression.level,
      memoryFragments: this.progression.memoryFragments,
    });
  }

  private onDeath(): void {
    this.progression.deaths++;
    this.runCompleted = false;
    const permadeath = this.config.roguelike.permadeath;

    // A normal death is a setback: blur part of the current level's unspent XP
    // while keeping levels, fragments and meta progress. Permadeath resets the
    // run itself but keeps the meta record (deaths, depth, completed runs).
    const lostXp = permadeath
      ? this.progression.experience
      : Math.floor(this.progression.experience * this.config.roguelike.deathXpLoss);

    if (permadeath) {
      this.resetRunState();
    } else {
      this.progression.experience = Math.max(0, this.progression.experience - lostXp);
    }

    this.eventBus.emit(GameEvents.PLAYER_DEATH, {
      position: this.state.position,
      depth: this.progression.deepestDepth,
      lostXp,
      permadeath,
    });
    this.eventBus.emit('player:runEnded', {
      deaths: this.progression.deaths,
      deepestDepth: this.progression.deepestDepth,
      lostXp,
      permadeath,
    });

    this.respawn();
  }

  /** Reset run-scoped progression while preserving meta statistics. */
  private resetRunState(): void {
    this.initializeStats();
    this.initializeAbilities();
    this.progression.level = 1;
    this.progression.experience = 0;
    this.progression.experienceToNext = this.experienceForLevel(1);
    this.progression.statPoints = 0;
    this.progression.memoryFragments = 0;
    this.progression.unlockedAbilities = ['dash', 'slash'];
    this.inventory = [];
    this.equipment = { weapon: null, armor: null, accessory: null };
    this.runCompleted = false;
  }

  private respawn(): void {
    this.stats.health = this.stats.maxHealth;
    this.stats.mana = this.stats.maxMana;
    this.stats.stamina = this.stats.maxStamina;
    this.state.position = { x: 0, y: 0 };
    this.state.velocity = { x: 0, y: 0 };
    this.state.invincible = true;
    this.state.invincibilityTimer = 3.0;
    this.state.knockbackTimer = 0;
    this.state.dashing = false;
    this.state.attacking = false;
    this.state.interacting = false;
    this.dashStateTimer = 0;
    this.attackAnimTimer = 0;
    this.interactTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.surgeStreak = 0;
    this.surgeTimer = 0;
  }

  private useAbility(abilityId: string): void {
    const ability = this.abilities.get(abilityId);
    if (!ability || !ability.unlocked) return;
    if (ability.currentCooldown > 0) return;
    if (this.stats.mana < ability.manaCost) return;

    this.stats.mana -= ability.manaCost;
    ability.currentCooldown = ability.cooldown;

    switch (abilityId) {
      case 'heal':
        this.heal(this.stats.maxHealth * 0.3);
        this.eventBus.emit(GameEvents.GRAPHICS_EFFECT, {
          type: 'heal',
          x: this.state.position.x,
          y: this.state.position.y,
          tint: 0x00ff00,
        });
        break;
      case 'shield':
        this.state.invincible = true;
        this.state.invincibilityTimer = 3.0;
        this.eventBus.emit(GameEvents.GRAPHICS_EFFECT, {
          type: 'shield',
          x: this.state.position.x,
          y: this.state.position.y,
          tint: 0x0088ff,
        });
        break;
      case 'ultimate':
        this.activateUltimate();
        break;
    }
  }

  private activateUltimate(): void {
    // Full heal, clear cooldowns, massive damage aura
    this.stats.health = this.stats.maxHealth;
    this.stats.mana = this.stats.maxMana;

    for (const ability of this.abilities.values()) {
      ability.currentCooldown = 0;
    }

    this.eventBus.emit(GameEvents.COMBAT_ATTACK, {
      sourceId: 'player',
      x: this.state.position.x,
      y: this.state.position.y,
      radius: 200,
      damage: this.stats.damage * 10,
      critical: true,
      knockbackForce: this.config.combat.knockbackForce * 2,
      statusEffects: [],
      ultimate: true,
    });

    this.eventBus.emit(GameEvents.GRAPHICS_EFFECT, {
      type: 'ultimate',
      x: this.state.position.x,
      y: this.state.position.y,
      scale: 3,
      tint: 0xffd700,
    });
  }

  private heal(amount: number): void {
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
  }

  private grantMemoryFragments(amount: number): void {
    if (!Number.isFinite(amount)) return;

    const fragments = Math.floor(amount);
    if (fragments <= 0) return;

    const fragmentConfig = this.config.progression.fragments;

    // Memory Surge: pickups and kills chained inside the window compound the
    // reward, so a player who keeps moving and fighting is paid more than one
    // who stops to rest. The chain breaks on the timer or on taking damage.
    if (this.surgeTimer > 0) {
      this.surgeStreak = Math.min(this.surgeStreak + 1, fragmentConfig.surgeMaxStreak);
    } else {
      this.surgeStreak = 1;
    }
    this.surgeTimer = fragmentConfig.surgeWindow;

    const surgeMultiplier = 1 + (this.surgeStreak - 1) * fragmentConfig.surgeStep;

    this.progression.memoryFragments += fragments;
    this.addExperience(fragmentConfig.xpValue * fragments * surgeMultiplier);

    this.eventBus.emit('player:memoryChanged', {
      memoryFragments: this.progression.memoryFragments,
      amount: fragments,
    });
    this.eventBus.emit('player:memorySurge', {
      streak: this.surgeStreak,
      multiplier: surgeMultiplier,
    });
  }

  private addExperience(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;

    this.progression.experience += amount;

    const maxLevel = this.config.progression.maxLevel;
    while (
      this.progression.experience >= this.progression.experienceToNext &&
      this.progression.level < maxLevel
    ) {
      this.progression.experience -= this.progression.experienceToNext;
      this.levelUp();
    }

    this.eventBus.emit('player:experienceChanged', {
      current: this.progression.experience,
      required: this.progression.experienceToNext,
    });
  }

  /**
   * XP required to reach the next level. The authored curve wins while it
   * covers the level; past its end the requirement keeps growing by 1.5x.
   * `curve[level]` is the cost of advancing from `level` to `level + 1`.
   */
  private experienceForLevel(level: number): number {
    const curve = this.config.progression.xpCurve;
    if (level < curve.length && curve[level] > 0) {
      return curve[level];
    }

    let value = curve.length > 0 ? curve[curve.length - 1] || 100 : 100;
    for (let current = curve.length - 1; current < level; current++) {
      value = Math.floor(value * 1.5);
    }
    return value;
  }

  private levelUp(): void {
    this.progression.level++;
    this.progression.statPoints += this.config.progression.statPointsPerLevel;
    this.progression.experienceToNext = this.experienceForLevel(this.progression.level);

    // Increase base stats
    this.stats.maxHealth += 10;
    this.stats.health = this.stats.maxHealth;
    this.stats.maxMana += 5;
    this.stats.mana = this.stats.maxMana;
    this.stats.damage += 2;

    this.eventBus.emit(GameEvents.PLAYER_LEVEL_UP, {
      level: this.progression.level,
      statPoints: this.progression.statPoints,
    });

    for (const unlock of this.config.progression.abilityUnlocks) {
      if (unlock.level !== this.progression.level) continue;
      const ability = this.abilities.get(unlock.ability);
      if (ability && this.unlockAbility(unlock.ability)) {
        this.eventBus.emit('player:abilityUnlocked', {
          abilityId: ability.id,
          name: ability.name,
          level: this.progression.level,
        });
      }
    }
  }

  private onLevelUp(): void {
    // External grant path (e.g., a debug command or UI reward). The
    // PLAYER_LEVEL_UP event is an output and must not loop back into levelUp.
    this.levelUp();
  }

  private addItem(item: InventoryItem): void {
    const maxStack = Math.max(1, Math.floor(Number(item.maxStack) || 1));
    let remaining = Math.max(1, Math.floor(Number(item.quantity) || 1));

    // Fill existing stacks first, then create as many stacks as the quantity
    // needs. Loot tables can award several maxStack-1 items at once, and those
    // must become separate inventory entries instead of an illegal stack.
    for (const existing of this.inventory) {
      if (remaining <= 0) break;
      if (existing.id !== item.id || existing.maxStack <= 1) continue;
      const space = existing.maxStack - existing.quantity;
      if (space <= 0) continue;
      const added = Math.min(space, remaining);
      existing.quantity += added;
      remaining -= added;
    }

    while (remaining > 0) {
      const stack = Math.min(maxStack, remaining);
      this.inventory.push({ ...item, maxStack, quantity: stack });
      remaining -= stack;
    }

    this.eventBus.emit('player:inventoryChanged', { inventory: this.inventory });
  }

  useItem(itemId: string): boolean {
    const item = this.inventory.find((entry) => entry.id === itemId);
    if (!item) return false;

    const stats = item.stats as Record<string, any>;
    let consumed = false;

    const heal = Number(stats.heal) || 0;
    if (heal > 0 && this.stats.health < this.stats.maxHealth) {
      this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + heal);
      consumed = true;
    }

    const manaRestore = Number(stats.manaRestore) || 0;
    if (manaRestore > 0 && this.stats.mana < this.stats.maxMana) {
      this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana + manaRestore);
      consumed = true;
    }

    const invincibility = Number(stats.invincibility) || 0;
    if (invincibility > 0) {
      this.state.invincible = true;
      this.state.invincibilityTimer = Math.max(this.state.invincibilityTimer, invincibility);
      consumed = true;
    }

    const fragmentValue = Number(stats.fragmentValue) || 0;
    if (fragmentValue > 0) {
      this.grantMemoryFragments(fragmentValue);
      consumed = true;
    }

    if (item.type === 'memory') {
      this.grantMemoryFragments(Math.max(1, Math.floor(Number(stats.memoryValue) || 1)));
      if (typeof stats.unlocksAbility === 'string') {
        this.unlockAbility(stats.unlocksAbility);
      }
      consumed = true;
    }

    if (!consumed) return false;

    this.consumeItem(item);
    this.eventBus.emit('player:itemUsed', { itemId: item.id, name: item.name });
    return true;
  }

  equipItem(itemId: string): boolean {
    const item = this.inventory.find((entry) => entry.id === itemId);
    if (!item || (item.type !== 'weapon' && item.type !== 'armor' && item.type !== 'accessory')) {
      return false;
    }

    const slot: EquipmentSlot = item.type;
    const previous = this.equipment[slot];
    this.consumeItem(item, 1, false);
    this.equipment[slot] = { ...item, quantity: 1 };
    if (previous) this.addItem(previous);
    this.recalculateDerivedStats();
    this.eventBus.emit('player:equipmentChanged', {
      equipment: this.equipment,
      slot,
      item: this.equipment[slot],
    });
    this.eventBus.emit('player:inventoryChanged', { inventory: this.inventory });
    return true;
  }

  unequipSlot(slot: EquipmentSlot): boolean {
    const item = this.equipment[slot];
    if (!item) return false;
    this.equipment[slot] = null;
    this.addItem(item);
    this.recalculateDerivedStats();
    this.eventBus.emit('player:equipmentChanged', {
      equipment: this.equipment,
      slot,
      item: null,
    });
    return true;
  }

  private consumeItem(item: InventoryItem, amount = 1, emit = true): void {
    item.quantity -= amount;
    if (item.quantity <= 0) {
      this.inventory = this.inventory.filter((entry) => entry !== item);
    }
    if (emit) this.eventBus.emit('player:inventoryChanged', { inventory: this.inventory });
  }

  // Public API

  getStats(): Readonly<PlayerStats> {
    return this.stats;
  }
  getState(): Readonly<PlayerState> {
    return this.state;
  }
  getAbilities(): Readonly<Map<string, Ability>> {
    return this.abilities;
  }
  getInventory(): Readonly<InventoryItem[]> {
    return this.inventory;
  }

  getEquipment(): Readonly<EquipmentState> {
    return this.equipment;
  }
  getProgression(): Readonly<ProgressionData> {
    return this.progression;
  }

  /** Read-only view for HUD feedback on the two reward chains. */
  getCombatChains(): Readonly<{
    comboCount: number;
    comboMax: number;
    comboTimer: number;
    comboTimerMax: number;
    surgeStreak: number;
    surgeMultiplier: number;
    surgeTimer: number;
  }> {
    const fragments = this.config.progression.fragments;
    return {
      comboCount: this.comboCount,
      comboMax: this.config.combat.comboMax,
      comboTimer: this.comboTimer,
      comboTimerMax: this.config.combat.comboWindow,
      surgeStreak: this.surgeStreak,
      surgeMultiplier: this.surgeStreak > 0 ? 1 + (this.surgeStreak - 1) * fragments.surgeStep : 1,
      surgeTimer: this.surgeTimer,
    };
  }

  collectMemoryFragments(amount = 1): void {
    this.grantMemoryFragments(amount);
  }

  setPosition(x: number, y: number): void {
    this.state.position = { x, y };
  }

  grantStarterKit(): void {
    const starterWeapon: InventoryItem = {
      id: 'memory_blade',
      type: 'weapon',
      name: 'Memory Blade',
      description: 'A blade forged from crystallized memories.',
      rarity: 'rare',
      stats: { damage: 15, critChance: 0.1, speed: 1.2 },
      quantity: 1,
      maxStack: 1,
    };
    const starterArmor: InventoryItem = {
      id: 'scavenger_vest',
      type: 'armor',
      name: "Scavenger's Vest",
      description: 'Patchwork armor stitched from ruins.',
      rarity: 'common',
      stats: { armor: 15, moveSpeed: 10 },
      quantity: 1,
      maxStack: 1,
    };
    const starterElixirs: InventoryItem = {
      id: 'memory_elixir',
      type: 'consumable',
      name: 'Memory Elixir',
      description: 'Restores health and mana.',
      rarity: 'common',
      stats: { heal: 50, manaRestore: 30 },
      quantity: 3,
      maxStack: 10,
    };

    this.addItem(starterWeapon);
    this.addItem(starterArmor);
    this.addItem(starterElixirs);
    this.equipItem('memory_blade');
    this.equipItem('scavenger_vest');
  }

  addStatPoints(stat: keyof PlayerStats, amount: number): void {
    if (this.progression.statPoints >= amount) {
      (this.stats as any)[stat] += amount;
      this.progression.statPoints -= amount;
      this.recalculateDerivedStats();
    }
  }

  private recalculateDerivedStats(): void {
    // Attribute bonuses are measured from the starting value of 10, so the
    // level-1 stat block (damage 10, armor 0, speed 200) matches the formula
    // exactly. Spending the first stat point no longer causes a sudden jump.
    const levelDamageBonus = (this.progression.level - 1) * 2;
    const gear = {
      damage: 0,
      armor: 0,
      resistance: 0,
      moveSpeed: 0,
      critChance: 0,
      critMultiplier: 0,
      attackSpeed: 0,
      mana: 0,
      dashCooldownReduction: 0,
      dashDistance: 0,
    };

    for (const item of Object.values(this.equipment)) {
      if (!item) continue;
      const stats = item.stats ?? {};
      gear.damage += Number(stats.damage) || 0;
      gear.armor += Number(stats.armor) || 0;
      gear.resistance += Number(stats.resistance) || 0;
      gear.moveSpeed += Number(stats.moveSpeed) || 0;
      gear.critChance += Number(stats.critChance) || 0;
      gear.critMultiplier += Number(stats.critMultiplier) || 0;
      gear.mana += Number(stats.mana) || 0;
      gear.dashCooldownReduction += Number(stats.dashCooldownReduction) || 0;
      gear.dashDistance += Number(stats.dashDistance) || 0;
      // Weapon `speed` is authored as a multiplier (1.5 = 50% faster).
      const speed = Number(stats.speed);
      if (Number.isFinite(speed) && speed > 0) gear.attackSpeed += speed - 1;
    }

    this.stats.damage =
      this.config.player.baseDamage +
      (this.stats.strength - 10) * 2 +
      levelDamageBonus +
      gear.damage;
    this.stats.moveSpeed =
      this.config.player.baseSpeed + (this.stats.dexterity - 10) * 2 + gear.moveSpeed;
    this.stats.armor = (this.stats.vitality - 10) * 3 + gear.armor;
    this.stats.resistance = (this.stats.intelligence - 10) * 2 + gear.resistance;
    this.stats.critChance =
      this.config.combat.criticalChance + (this.stats.dexterity - 10) * 0.005 + gear.critChance;
    this.stats.critMultiplier = this.config.combat.criticalMultiplier + gear.critMultiplier;
    this.stats.attackSpeed = Math.max(0.1, 1 + gear.attackSpeed);
    this.stats.dashCooldown = Math.max(
      0.1,
      this.config.player.dashCooldown * (1 - Math.min(0.9, gear.dashCooldownReduction))
    );
    this.stats.dashDistance = this.config.player.dashDistance + gear.dashDistance;
    this.stats.maxMana = 50 + (this.progression.level - 1) * 5 + gear.mana;
    this.stats.mana = Math.min(this.stats.mana, this.stats.maxMana);
  }

  unlockAbility(abilityId: string): boolean {
    const ability = this.abilities.get(abilityId);
    if (ability && !ability.unlocked) {
      ability.unlocked = true;
      this.progression.unlockedAbilities.push(abilityId);
      return true;
    }
    return false;
  }

  upgradeAbility(abilityId: string): boolean {
    const ability = this.abilities.get(abilityId);
    if (ability && ability.level < ability.maxLevel) {
      ability.level++;
      return true;
    }
    return false;
  }

  upgradeOrUnlockAbility(abilityId: string): boolean {
    const ability = this.abilities.get(abilityId);
    if (!ability) return false;
    if (this.progression.statPoints <= 0) return false;

    if (!ability.unlocked) {
      if (this.unlockAbility(abilityId)) {
        this.progression.statPoints--;
        this.eventBus.emit('player:abilityUnlocked', { abilityId });
        return true;
      }
    } else if (ability.level < ability.maxLevel) {
      if (this.upgradeAbility(abilityId)) {
        this.progression.statPoints--;
        this.eventBus.emit('player:abilityUpgraded', { abilityId, level: ability.level });
        return true;
      }
    }
    return false;
  }

  async shutdown(): Promise<void> {
    // no-op
  }

  serialize(): ModuleState {
    return {
      version: this.version,
      timestamp: Date.now(),
      data: {
        stats: this.stats,
        state: this.state,
        abilities: Array.from(this.abilities.entries()),
        inventory: this.inventory,
        equipment: this.equipment,
        progression: this.progression,
        runCompleted: this.runCompleted,
        combatChains: {
          comboCount: this.comboCount,
          comboTimer: this.comboTimer,
          surgeStreak: this.surgeStreak,
          surgeTimer: this.surgeTimer,
        },
      },
      checksum: 'player',
    };
  }

  deserialize(state: ModuleState): void {
    if (state.data.stats) this.stats = { ...this.stats, ...state.data.stats };
    if (state.data.state) this.state = { ...this.state, ...state.data.state };
    if (state.data.abilities) this.abilities = new Map(state.data.abilities);
    if (state.data.inventory) this.inventory = state.data.inventory;
    if (state.data.equipment) {
      this.equipment = {
        weapon: state.data.equipment.weapon ?? null,
        armor: state.data.equipment.armor ?? null,
        accessory: state.data.equipment.accessory ?? null,
      };
    }
    if (state.data.progression)
      this.progression = { ...this.progression, ...state.data.progression };
    if (typeof state.data.runCompleted === 'boolean') {
      this.runCompleted = state.data.runCompleted;
    }
    const chains = state.data.combatChains;
    if (chains) {
      if (Number.isFinite(chains.comboCount)) this.comboCount = chains.comboCount;
      if (Number.isFinite(chains.comboTimer)) this.comboTimer = chains.comboTimer;
      if (Number.isFinite(chains.surgeStreak)) this.surgeStreak = chains.surgeStreak;
      if (Number.isFinite(chains.surgeTimer)) this.surgeTimer = chains.surgeTimer;
    }
  }
}
