/**
 * AI System - RLM Compatibility Layer and AI Testing Interface
 *
 * Provides deterministic state management, serialization for RLM context,
 * and interfaces for AI agents to interact with the game.
 */

import type { EventBus } from '@core/EventBus';
import { GameEvents } from '@core/EventBus';
import type { IGameModule, ModuleContext, ModuleState } from '@core/ModuleRegistry';
import type { AIConfig } from '@core/ConfigManager';
import type { GameApplication } from '@core/GameApplication';
import type { ModuleRegistry } from '@core/ModuleRegistry';

export interface RLMState {
  version: string;
  timestamp: number;
  seed: number;
  frame: number;
  playTime: number;
  modules: Record<string, any>;
  checksum: string;
}

export interface AIAction {
  type: 'move' | 'attack' | 'dash' | 'interact' | 'ability' | 'wait';
  params: Record<string, any>;
  priority: number;
}

export interface AIDecisionContext {
  player: {
    position: { x: number; y: number };
    health: number;
    maxHealth: number;
    mana: number;
    maxMana: number;
    stamina: number;
    facing: number;
    velocity: { x: number; y: number };
    state: string;
  };
  world: {
    biome: string;
    nearbyEntities: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      health: number;
      maxHealth: number;
      distance: number;
    }>;
    nearbyItems: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      distance: number;
    }>;
    chunkPosition: { x: number; y: number };
  };
  input: {
    movement: { x: number; y: number };
    actions: Record<string, boolean>;
  };
  timestamp: number;
}

export interface AIObservation {
  screen: Float32Array; // Compressed screen buffer
  entities: Float32Array; // Entity positions and states
  player: Float32Array; // Player state vector
  metadata: {
    width: number;
    height: number;
    entityCount: number;
    timestamp: number;
  };
}

export class AISystem implements IGameModule {
  readonly name = 'aiSystem';
  readonly version = '1.0.0';
  readonly dependencies: string[] = [];
  readonly tokenBudget = 5000; // aikit:allow-secret

  private eventBus: EventBus;
  private config: AIConfig;
  private gameApp: GameApplication | null = null;
  private moduleRegistry: ModuleRegistry | null = null;

  // RLM State management
  private rlmEnabled = true;
  private rlmTokenBudget = 50000;
  private snapshotInterval = 60; // frames
  private frameSinceSnapshot = 0;
  private stateHistory: RLMState[] = [];
  private maxHistorySize = 100;

  // AI Agents
  private agents = new Map<string, AIAgent>();
  private activeAgent: string | null = null;

  // Decision making
  private decisionInterval = 100; // ms
  private lastDecisionTime = 0;

  // Observation buffer
  private observationBuffer: AIObservation | null = null;

  constructor(eventBus: EventBus, config: AIConfig) {
    this.eventBus = eventBus;
    this.config = config;
    this.rlmEnabled = config.rlm.enabled;
    this.rlmTokenBudget = config.rlm.tokenBudget; // aikit:allow-secret
    this.snapshotInterval = config.rlm.snapshotInterval;
  }

  async initialize(context: ModuleContext): Promise<void> {
    this.gameApp = context.sharedState.get('gameApplication');
    this.moduleRegistry = context.sharedState.get('moduleRegistry');

    // Event listeners
    this.eventBus.on('ai:registerAgent', (data: any) => this.registerAgent(data));
    this.eventBus.on('ai:unregisterAgent', (data: any) => this.unregisterAgent(data.id));
    this.eventBus.on('ai:setActiveAgent', (data: any) => this.setActiveAgent(data.id));
    this.eventBus.on('ai:requestDecision', (data: any) => this.requestDecision(data.context));
    this.eventBus.on('ai:requestObservation', () => this.provideObservation());
    this.eventBus.on('ai:requestState', () => this.provideState());
    this.eventBus.on(GameEvents.RLM_STATE_SNAPSHOT, () => this.createSnapshot(true));
    this.eventBus.on(GameEvents.RLM_STATE_RESTORE, (data: any) => this.restoreState(data.state));

    this.eventBus.emit('aiSystem:ready', { rlmEnabled: this.rlmEnabled });
  }

  // Agent Management

  registerAgent(data: {
    id: string;
    name: string;
    type: 'player' | 'enemy' | 'observer';
    config: any;
  }): void {
    const agent: AIAgent = {
      id: data.id,
      name: data.name,
      type: data.type,
      config: data.config,
      active: false,
      lastDecision: null,
      decisionCount: 0,
    };

    this.agents.set(data.id, agent);
    this.eventBus.emit('ai:agentRegistered', { id: data.id, name: data.name });
  }

  unregisterAgent(id: string): void {
    this.agents.delete(id);
    if (this.activeAgent === id) this.activeAgent = null;
    this.eventBus.emit('ai:agentUnregistered', { id });
  }

  setActiveAgent(id: string): void {
    if (this.agents.has(id)) {
      // Deactivate previous
      if (this.activeAgent) {
        const prev = this.agents.get(this.activeAgent)!;
        prev.active = false;
      }

      this.activeAgent = id;
      const agent = this.agents.get(id)!;
      agent.active = true;
      this.eventBus.emit('ai:activeAgentChanged', { id });
    }
  }

  getActiveAgent(): AIAgent | null {
    return this.activeAgent ? this.agents.get(this.activeAgent)! : null;
  }

  getAgents(): AIAgent[] {
    return Array.from(this.agents.values());
  }

  // Decision Making

  private async requestDecision(context: AIDecisionContext): Promise<void> {
    const agent = this.getActiveAgent();
    if (!agent) return;

    const now = Date.now();
    if (now - this.lastDecisionTime < this.decisionInterval) return;
    this.lastDecisionTime = now;

    // Get decision from agent (would be implemented by specific AI)
    const decision = await this.getAgentDecision(agent, context);

    if (decision) {
      agent.lastDecision = decision;
      agent.decisionCount++;
      this.executeDecision(decision);
      this.eventBus.emit(GameEvents.AI_DECISION, { agentId: agent.id, decision });
    }
  }

  private async getAgentDecision(
    agent: AIAgent,
    context: AIDecisionContext
  ): Promise<AIAction | null> {
    // This would be implemented by specific AI agents
    // For now, return a basic heuristic decision
    return this.heuristicDecision(context);
  }

  private heuristicDecision(context: AIDecisionContext): AIAction {
    const { player, world, input } = context;

    // Find nearest enemy
    let nearestEnemy = null;
    let nearestDist = Infinity;

    for (const entity of world.nearbyEntities) {
      if (entity.distance < nearestDist) {
        nearestDist = entity.distance;
        nearestEnemy = entity;
      }
    }

    // Low health - heal or flee
    if (player.health / player.maxHealth < 0.3) {
      const healAbility = { type: 'ability' as const, params: { id: 'heal' }, priority: 10 };
      if (player.mana >= 20) return healAbility;

      // Flee from nearest enemy
      if (nearestEnemy) {
        const dx = player.position.x - nearestEnemy.position.x;
        const dy = player.position.y - nearestEnemy.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          return {
            type: 'move',
            params: { x: (dx / dist) * 200, y: (dy / dist) * 200 },
            priority: 9,
          };
        }
      }
    }

    // Enemy in range - attack
    if (nearestEnemy && nearestDist < 50) {
      return {
        type: 'attack',
        params: { targetId: nearestEnemy.id },
        priority: 8,
      };
    }

    // Enemy in chase range - move toward
    if (nearestEnemy && nearestDist < 300) {
      const dx = nearestEnemy.position.x - player.position.x;
      const dy = nearestEnemy.position.y - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        return {
          type: 'move',
          params: { x: dx / dist, y: dy / dist },
          priority: 5,
        };
      }
    }

    // Explore - move toward unexplored
    return {
      type: 'move',
      params: {
        x: input.movement.x || Math.random() - 0.5,
        y: input.movement.y || Math.random() - 0.5,
      },
      priority: 1,
    };
  }

  private executeDecision(decision: AIAction): void {
    switch (decision.type) {
      case 'move':
        this.eventBus.emit(GameEvents.PLAYER_MOVE, decision.params as any);
        break;
      case 'attack':
        this.eventBus.emit(GameEvents.PLAYER_ATTACK, {});
        break;
      case 'dash':
        this.eventBus.emit('player:dash', {});
        break;
      case 'interact':
        this.eventBus.emit('player:interact', {});
        break;
      case 'ability':
        this.eventBus.emit('player:useAbility', decision.params as any);
        break;
      case 'wait':
        // Do nothing
        break;
    }
  }

  // Observation System

  private provideObservation(): void {
    const observation = this.createObservation();
    this.observationBuffer = observation;
    this.eventBus.emit('ai:observation', observation);
  }

  private createObservation(): AIObservation {
    const playerSystem = this.moduleRegistry?.get('playerSystem') as any;
    const combatSystem = this.moduleRegistry?.get('combatSystem') as any;

    // Create compressed observation
    const player = playerSystem?.getState();
    const stats = playerSystem?.getStats();
    const entities = combatSystem?.getEntities();

    // Player state vector (16 floats)
    const playerVector = new Float32Array(16);
    if (player && stats) {
      playerVector[0] = player.position.x / 1000; // Normalized
      playerVector[1] = player.position.y / 1000;
      playerVector[2] = player.velocity.x / 500;
      playerVector[3] = player.velocity.y / 500;
      playerVector[4] = player.facing;
      playerVector[5] = player.grounded ? 1 : 0;
      playerVector[6] = player.dashing ? 1 : 0;
      playerVector[7] = player.attacking ? 1 : 0;
      playerVector[8] = stats.health / stats.maxHealth;
      playerVector[9] = stats.mana / stats.maxHealth;
      playerVector[10] = stats.stamina / stats.maxStamina;
      playerVector[11] = stats.damage / 100;
      playerVector[12] = stats.moveSpeed / 500;
      playerVector[13] = stats.critChance;
      playerVector[14] = stats.armor / 200;
      playerVector[15] = stats.level / 50;
    }

    // Entity array (max 50 entities, 8 floats each = 400 floats)
    const maxEntities = 50;
    const entityVector = new Float32Array(maxEntities * 8);
    let entityCount = 0;

    if (entities) {
      for (const [_id, entity] of entities) {
        if (entityCount >= maxEntities) break;
        if (!entity.state.alive) continue;

        const base = entityCount * 8;
        entityVector[base] = entity.position.x / 1000;
        entityVector[base + 1] = entity.position.y / 1000;
        entityVector[base + 2] = entity.velocity.x / 500;
        entityVector[base + 3] = entity.velocity.y / 500;
        entityVector[base + 4] = entity.stats.health / entity.stats.maxHealth;
        entityVector[base + 5] = entity.ai.behavior === 'attack' ? 1 : 0;
        entityVector[base + 6] = this.getEntityTypeIndex(entity.type);
        entityVector[base + 7] = entity.sprite.facing;
        entityCount++;
      }
    }

    // Screen buffer placeholder (would be actual rendered frame)
    const screenBuffer = new Float32Array(64 * 64 * 3); // 64x64 RGB

    return {
      screen: screenBuffer,
      entities: entityVector,
      player: playerVector,
      metadata: {
        width: 64,
        height: 64,
        entityCount,
        timestamp: Date.now(),
      },
    };
  }

  private getEntityTypeIndex(type: string): number {
    const types = [
      'scavenger',
      'guardian',
      'memoryEcho',
      'wildling',
      'spirit',
      'caveDweller',
      'crystalGolem',
      'shadow',
      'crystalGuardian',
      'prismEntity',
      'voidWalker',
      'forgotten',
      'keeper',
    ];
    return types.indexOf(type) + 1;
  }

  // RLM State Management

  private createSnapshot(force = false): void {
    if (!this.rlmEnabled || !this.gameApp) return;

    if (!force) {
      this.frameSinceSnapshot++;
      if (this.frameSinceSnapshot < this.snapshotInterval) return;
    }
    this.frameSinceSnapshot = 0;

    const gameState = this.gameApp.serialize();
    const moduleStates = this.moduleRegistry?.serializeAll() ?? {};

    const snapshot: RLMState = {
      version: '1.0',
      timestamp: Date.now(),
      seed: (this.gameApp as any).seed,
      frame: gameState.frameCount,
      playTime: gameState.playTime,
      modules: moduleStates,
      checksum: this.computeChecksum(moduleStates),
    };

    this.stateHistory.push(snapshot);
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    this.eventBus.emit(GameEvents.RLM_STATE_SNAPSHOT + ':result', snapshot);
  }

  private restoreState(state: RLMState): void {
    if (!this.gameApp || !this.moduleRegistry) return;

    this.gameApp.deserialize(state as any);
    this.moduleRegistry.deserializeAll(state.modules);

    this.eventBus.emit('ai:stateRestored', { timestamp: state.timestamp });
  }

  private provideState(): void {
    if (!this.gameApp) return;

    const gameState = this.gameApp.serialize();
    const moduleStates = this.moduleRegistry?.serializeAll() ?? {};

    const fullState: RLMState = {
      version: '1.0',
      timestamp: Date.now(),
      seed: (this.gameApp as any).seed,
      frame: gameState.frameCount,
      playTime: gameState.playTime,
      modules: moduleStates,
      checksum: this.computeChecksum(moduleStates),
    };

    this.eventBus.emit('ai:state', fullState);
  }

  private computeChecksum(modules: Record<string, any>): string {
    let hash = 0;
    const str = JSON.stringify(modules);
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }

  private createRNG(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  // Headless Simulation for Testing

  async runHeadlessScenario(scenario: string, steps: number, seed: number): Promise<any> {
    if (!this.gameApp) throw new Error('Game not initialized');

    // Set deterministic seed
    (this.gameApp as any).seed = seed;
    (this.gameApp as any).rng = this.createRNG(seed);

    // Run headless
    const result = await this.gameApp.runHeadless(steps);

    return {
      scenario,
      seed,
      steps,
      finalState: result,
      metrics: this.collectMetrics(result),
    };
  }

  private collectMetrics(state: any): any {
    return {
      frameCount: state.frameCount,
      playTime: state.playTime,
      tokenBudget: this.moduleRegistry?.getTotalTokenBudget() ?? 0, // aikit:allow-secret
      moduleCount: this.moduleRegistry?.getAllMetadata().length ?? 0,
    };
  }

  // Token Budget Management

  getTokenBudget(): number {
    return this.rlmTokenBudget;
  }

  getCurrentTokenUsage(): number {
    return this.moduleRegistry?.getTotalTokenBudget() ?? 0;
  }

  canAfford(tokens: number): boolean {
    return this.getCurrentTokenUsage() + tokens <= this.rlmTokenBudget;
  }

  // State History for RLM

  getStateHistory(): RLMState[] {
    return [...this.stateHistory];
  }

  getLatestState(): RLMState | null {
    return this.stateHistory[this.stateHistory.length - 1] ?? null;
  }

  update(_deltaTime: number): void {
    // Auto-snapshot only when an active AI agent is observing or benchmark is running
    if (this.rlmEnabled && this.gameApp && this.activeAgent) {
      this.createSnapshot();
    }
  }

  async shutdown(): Promise<void> {
    this.agents.clear();
    this.stateHistory = [];
  }

  serialize(): ModuleState {
    return {
      version: this.version,
      timestamp: Date.now(),
      data: {
        rlmEnabled: this.rlmEnabled,
        tokenBudget: this.rlmTokenBudget, // aikit:allow-secret
        activeAgent: this.activeAgent,
        agents: Array.from(this.agents.entries()),
        stateHistory: this.stateHistory.slice(-10), // Keep last 10
      },
      checksum: 'ai',
    };
  }

  deserialize(state: ModuleState): void {
    if (state.data.rlmEnabled !== undefined) this.rlmEnabled = state.data.rlmEnabled;
    if (state.data.tokenBudget) this.rlmTokenBudget = state.data.tokenBudget; // aikit:allow-secret
    if (state.data.activeAgent) this.activeAgent = state.data.activeAgent;
    if (state.data.agents) this.agents = new Map(state.data.agents);
    if (state.data.stateHistory) this.stateHistory = state.data.stateHistory;
  }
}

export interface AIAgent {
  id: string;
  name: string;
  type: 'player' | 'enemy' | 'observer';
  config: any;
  active: boolean;
  lastDecision: AIAction | null;
  decisionCount: number;
}
