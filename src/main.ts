/**
 * Memory Reconstruction - Main Entry Point
 *
 * This is the primary entry point for the game. It initializes all core systems,
 * sets up the game loop, and manages the application lifecycle.
 *
 * AI COMPATIBILITY: This file is designed to be readable by any AI agent.
 * All initialization is explicit and follows the module contract.
 */

import { GameApplication } from '@core/GameApplication';
import { ModuleRegistry } from '@core/ModuleRegistry';
import { EventBus } from '@core/EventBus';
import { ConfigManager, ConfigSchemas } from '@core/ConfigManager';
import { AssetManager } from '@engine/AssetManager';
import { RenderSystem } from '@graphics/RenderSystem';
import { ActorRenderer } from '@graphics/ActorRenderer';
import { InputSystem } from '@engine/InputSystem';
import { AudioSystem } from '@audio/AudioSystem';
import { WorldSystem } from '@gameplay/WorldSystem';
import { PlayerSystem } from '@gameplay/PlayerSystem';
import { CombatSystem } from '@gameplay/CombatSystem';
import { MemoryFragmentSystem } from '@gameplay/MemoryFragmentSystem';
import { AISystem } from '@ai/AISystem';
import { TestingHarness } from '@testing/TestingHarness';
import { SaveSystem } from '@gameplay/SaveSystem';
import { MenuSystem } from './ui/MenuSystem';

// Import configuration
import graphicsConfig from '@data/graphics.config.json';
import audioConfig from '@data/audio.config.json';
import gameplayConfig from '@data/gameplay.config.json';
import aiConfig from '@data/ai.config.json';

/**
 * Main game initialization
 * Follows the module contract for RLM compatibility
 */
async function main(): Promise<void> {
  // Initialize loading screen
  const loadingScreen = document.getElementById('loading-screen')!;
  const loadingProgress = document.getElementById('loading-progress')!;
  const loadingText = document.getElementById('loading-text')!;

  const updateLoading = (progress: number, text: string) => {
    loadingProgress.style.width = `${progress}%`;
    loadingText.textContent = text;
  };

  try {
    updateLoading(5, 'Initializing core systems...');

    // Create core infrastructure
    const eventBus = new EventBus();
    const configManager = new ConfigManager(eventBus);

    // Register schemas and load configs
    configManager.registerSchema('graphics', ConfigSchemas.graphics, {} as any);
    configManager.registerSchema('audio', ConfigSchemas.audio, {} as any);
    configManager.registerSchema('gameplay', ConfigSchemas.gameplay, {} as any);
    configManager.registerSchema('ai', ConfigSchemas.ai, {} as any);

    configManager.load('graphics', graphicsConfig);
    configManager.load('audio', audioConfig);
    configManager.load('gameplay', gameplayConfig);
    configManager.load('ai', aiConfig);

    // Create module registry (for RLM state management)
    const moduleRegistry = new ModuleRegistry(eventBus);

    updateLoading(15, 'Loading memory fragments...');

    // Create all module instances. Initialization happens through the registry
    // so the registry owns the initialized flags and the update loop.
    const assetManager = new AssetManager(eventBus);
    const renderSystem = new RenderSystem(eventBus, configManager.get('graphics'));
    const audioSystem = new AudioSystem(eventBus, configManager.get('audio'));
    const inputSystem = new InputSystem(eventBus);
    const worldSystem = new WorldSystem(eventBus, configManager.get('gameplay'));
    const playerSystem = new PlayerSystem(eventBus, configManager.get('gameplay'));
    const combatSystem = new CombatSystem(eventBus, configManager.get('gameplay'));
    const memoryFragmentSystem = new MemoryFragmentSystem(eventBus, configManager.get('gameplay'));
    const actorRenderer = new ActorRenderer(eventBus);
    const aiSystem = new AISystem(eventBus, configManager.get('ai'));
    const testingHarness = new TestingHarness(eventBus, moduleRegistry);
    const saveSystem = new SaveSystem(eventBus);
    const menuSystem = new MenuSystem(eventBus);

    updateLoading(35, 'Reconstructing the world...');

    // Create and start the game application
    const game = new GameApplication({
      eventBus,
      configManager,
      moduleRegistry,
      assetManager,
      renderSystem,
      inputSystem,
      audioSystem,
      worldSystem,
      playerSystem,
      combatSystem,
      aiSystem,
      testingHarness,
    });

    // Publish shared dependencies before initialization.
    moduleRegistry.setSharedState('gameApplication', game);
    moduleRegistry.setSharedState('moduleRegistry', moduleRegistry);
    moduleRegistry.setSharedState('assetManager', assetManager);
    moduleRegistry.setSharedState('renderSystem', renderSystem);
    moduleRegistry.setSharedState('audioSystem', audioSystem);
    moduleRegistry.setSharedState('inputSystem', inputSystem);
    moduleRegistry.setSharedState('worldSystem', worldSystem);
    moduleRegistry.setSharedState('playerSystem', playerSystem);
    moduleRegistry.setSharedState('combatSystem', combatSystem);
    moduleRegistry.setSharedState('memoryFragmentSystem', memoryFragmentSystem);
    moduleRegistry.setSharedState('actorRenderer', actorRenderer);
    moduleRegistry.setSharedState('aiSystem', aiSystem);
    moduleRegistry.setSharedState('testingHarness', testingHarness);
    moduleRegistry.setSharedState('saveSystem', saveSystem);
    moduleRegistry.setSharedState('menuSystem', menuSystem);

    moduleRegistry.register(assetManager);
    moduleRegistry.register(renderSystem);
    moduleRegistry.register(audioSystem);
    moduleRegistry.register(inputSystem);
    moduleRegistry.register(worldSystem);
    moduleRegistry.register(playerSystem);
    moduleRegistry.register(combatSystem);
    moduleRegistry.register(memoryFragmentSystem);
    moduleRegistry.register(actorRenderer);
    moduleRegistry.register(aiSystem);
    moduleRegistry.register(testingHarness);
    moduleRegistry.register(saveSystem);
    moduleRegistry.register(menuSystem);

    await moduleRegistry.initializeAll({
      graphics: configManager.get('graphics'),
      audio: configManager.get('audio'),
      gameplay: configManager.get('gameplay'),
      ai: configManager.get('ai'),
    });

    // Grant starter equipment if fresh run without existing save
    if (
      playerSystem.getInventory().length === 0 &&
      !playerSystem.getEquipment().weapon &&
      !saveSystem.hasSave()
    ) {
      playerSystem.grantStarterKit();
    }

    updateLoading(95, 'Starting game...');

    // Hide loading screen
    loadingScreen.classList.add('hidden');

    // Start the game loop
    await game.start();

    // Expose for debugging and AI access
    (window as any).__GAME__ = game;
    (window as any).__MODULE_REGISTRY__ = moduleRegistry;
    (window as any).__TESTING_HARNESS__ = testingHarness;
    (window as any).__SAVE_SYSTEM__ = saveSystem;
    (window as any).__MENU_SYSTEM__ = menuSystem;

    console.log('[Game] Memory Reconstruction initialized successfully');
    console.log('[Game] AI Testing Harness available at window.__TESTING_HARNESS__');
    console.log('[Game] Module Registry available at window.__MODULE_REGISTRY__');
  } catch (error) {
    console.error('[Game] Failed to initialize:', error);
    loadingText.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    loadingText.style.color = '#ff4444';
  }
}

// Start the game
main();

/**
 * RLM STATE EXPORT
 * This allows the entire game state to be serialized for RLM context management
 */
export function exportGameState(): string {
  const game = (window as any).__GAME__;
  if (!game) return '{}';
  return JSON.stringify(game.serialize(), null, 2);
}

/**
 * RLM STATE IMPORT
 * Restore game from serialized state
 */
export async function importGameState(stateJson: string): Promise<void> {
  const game = (window as any).__GAME__;
  if (!game) throw new Error('Game not initialized');
  const state = JSON.parse(stateJson);
  await game.deserialize(state);
}
