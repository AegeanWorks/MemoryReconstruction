/**
 * Menu System - User Interface, HUD, Minimap, World Map, Inventory, Skills & Settings
 *
 * Implements Metroidvania HUD & UI overlays adhering to the Memory Light design language:
 * deep indigo backgrounds (#0A0A14, #1F2442), pale gold accents (#FFD98A), and memory cyan highlights (#6FE7FF).
 */

import type { EventBus } from '@core/EventBus';
import type { IGameModule, ModuleContext, ModuleState } from '@core/ModuleRegistry';
import type { GameApplication } from '@core/GameApplication';
import type { SaveSystem } from '@gameplay/SaveSystem';
import type { WorldSystem } from '@gameplay/WorldSystem';
import { buildVictorySummary } from './victorySummary';

const BIOME_COLORS: Record<string, string> = {
  ruins: '#a08a6e',
  forest: '#3d6b1f',
  caves: '#4a4a6a',
  crystal: '#9932cc',
  void: '#16213e',
  sanctuary: '#ffd700',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#a0a6c2',
  uncommon: '#50fa7b',
  rare: '#6fe7ff',
  epic: '#bd93f9',
  legendary: '#ffd98a',
};

export class MenuSystem implements IGameModule {
  readonly name = 'menuSystem';
  readonly version = '1.1.0';
  readonly dependencies: string[] = ['saveSystem', 'playerSystem', 'worldSystem'];
  readonly tokenBudget = 2500;

  private eventBus: EventBus;
  private gameApp: GameApplication | null = null;
  private saveSystem: SaveSystem | null = null;
  private playerSystem: any = null;
  private worldSystem: WorldSystem | null = null;

  private overlayContainer: HTMLDivElement | null = null;
  private isMenuOpen = false;
  private activeSubModal: string | null = null;
  private minimapTimer = 0;
  private visitedChunks = new Set<string>();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async initialize(context: ModuleContext): Promise<void> {
    this.gameApp = context.sharedState.get('gameApplication');
    this.saveSystem = context.sharedState.get('saveSystem');
    this.playerSystem = context.sharedState.get('playerSystem');
    this.worldSystem = context.sharedState.get('worldSystem');

    this.visitedChunks.add('0,0');

    this.createDomOverlay();
    this.setupEventListeners();

    // Event listeners
    this.eventBus.on('game:saved', () => this.showToast('Run saved successfully!'));
    this.eventBus.on('game:loaded', () => {
      this.showToast('Run loaded!');
      this.closeMenu();
    });
    this.eventBus.on('player:runCompleted', (data: any) => this.showVictory(data));
    this.eventBus.on('player:inventoryChanged', () => this.refreshInventoryIfOpen());
    this.eventBus.on('player:equipmentChanged', () => this.refreshInventoryIfOpen());
    this.eventBus.on('player:abilityUnlocked', (data: any) => {
      this.showToast(`Discipline awakened: ${data?.abilityId ?? 'New Ability'}!`);
      this.refreshSkillsIfOpen();
    });
    this.eventBus.on('player:abilityUpgraded', (data: any) => {
      this.showToast(`Discipline upgraded to Rank ${data?.level ?? 2}!`);
      this.refreshSkillsIfOpen();
    });
    this.eventBus.on('player:runEnded', (data: any) => {
      this.showToast(
        data?.permadeath
          ? 'The run ends here. Your memories return to the void.'
          : `Memory blurred: ${data?.lostXp ?? 0} XP lost.`
      );
    });

    this.eventBus.emit('menuSystem:ready', {});
  }

  private createDomOverlay(): void {
    if (typeof document === 'undefined') return;

    const gameContainer = document.getElementById('game-container') || document.body;
    const existing = document.getElementById('menu-system-root');
    if (existing) existing.remove();

    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'menu-system-root';
    this.overlayContainer.innerHTML = `
      <style>
        #menu-system-root {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 200;
          font-family: 'Inter', sans-serif;
          color: #e8e8e8;
        }

        /* Top HUD Bar with Minimap & Quick Actions */
        #hud-top-bar {
          position: absolute;
          top: 14px;
          right: 18px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          pointer-events: auto;
        }

        #hud-minimap-panel {
          background: rgba(15, 17, 34, 0.85);
          border: 1px solid rgba(111, 231, 255, 0.35);
          border-radius: 6px;
          padding: 6px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        #hud-minimap-panel:hover {
          border-color: #ffd98a;
        }

        .minimap-meta {
          width: 100%;
          display: flex;
          justify-content: space-between;
          font-size: 0.68rem;
          color: #a0a6c2;
          margin-bottom: 4px;
          font-family: monospace;
        }

        #hud-minimap-canvas {
          background: #090a12;
          border-radius: 4px;
          display: block;
        }

        .hud-actions-col {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hud-btn {
          background: rgba(15, 17, 34, 0.85);
          border: 1px solid rgba(111, 231, 255, 0.35);
          color: #6fe7ff;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .hud-btn:hover {
          background: rgba(111, 231, 255, 0.22);
          border-color: #ffd98a;
          color: #fff6df;
          transform: translateY(-1px);
        }

        /* Modals & Backdrops */
        .menu-modal-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(10, 10, 20, 0.88);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.25s ease, visibility 0.25s ease;
          pointer-events: auto;
        }

        .menu-modal-backdrop.active {
          opacity: 1;
          visibility: visible;
        }

        .menu-card {
          background: linear-gradient(135deg, rgba(31, 36, 66, 0.96) 0%, rgba(15, 17, 34, 0.98) 100%);
          border: 1px solid rgba(111, 231, 255, 0.25);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7), 0 0 24px rgba(111, 231, 255, 0.15);
          border-radius: 8px;
          padding: 2rem;
          width: 90%;
          max-width: 520px;
          text-align: center;
        }

        .menu-title {
          font-family: 'Cinzel', serif;
          font-size: 2.1rem;
          font-weight: 700;
          letter-spacing: 2px;
          background: linear-gradient(90deg, #ffd98a, #6fe7ff, #ffd98a);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.2rem;
        }

        .menu-subtitle {
          font-size: 0.82rem;
          color: #a0a6c2;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 1.4rem;
        }

        .menu-save-info {
          background: rgba(111, 231, 255, 0.08);
          border: 1px solid rgba(111, 231, 255, 0.2);
          border-radius: 4px;
          padding: 0.6rem;
          margin-bottom: 1.2rem;
          font-size: 0.8rem;
          color: #b0e5ff;
        }

        .menu-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
        }

        .menu-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(111, 231, 255, 0.3);
          color: #ffffff;
          padding: 0.7rem 1.2rem;
          font-size: 0.9rem;
          font-weight: 500;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .menu-btn:hover:not(:disabled) {
          background: rgba(111, 231, 255, 0.2);
          border-color: #6fe7ff;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(111, 231, 255, 0.25);
        }

        .menu-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .menu-btn-primary {
          background: linear-gradient(90deg, rgba(255, 217, 138, 0.25), rgba(111, 231, 255, 0.25));
          border-color: #ffd98a;
          color: #fff6df;
        }

        .sub-modal-content {
          text-align: left;
          max-height: 65vh;
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        /* Equipment & Inventory Grid */
        .equip-slots-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 1.2rem;
        }

        .equip-slot-box {
          background: rgba(20, 24, 48, 0.8);
          border: 1px solid rgba(111, 231, 255, 0.25);
          border-radius: 6px;
          padding: 8px;
          text-align: center;
        }

        .equip-slot-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #a0a6c2;
          margin-bottom: 4px;
        }

        .equip-slot-name {
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .equip-slot-stats {
          font-size: 0.7rem;
          color: #b0e5ff;
          margin-bottom: 6px;
        }

        .char-stats-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          background: rgba(111, 231, 255, 0.05);
          border: 1px solid rgba(111, 231, 255, 0.15);
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 1.2rem;
          font-size: 0.78rem;
          text-align: center;
        }

        .char-stat-val {
          color: #ffd98a;
          font-weight: 600;
          margin-top: 2px;
        }

        .inventory-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          text-align: left;
        }

        .item-rarity-badge {
          display: inline-block;
          font-size: 0.65rem;
          text-transform: uppercase;
          border-radius: 2px;
          padding: 1px 4px;
          margin-left: 4px;
          border: 1px solid currentColor;
        }

        /* Skills & Disciplines */
        .skills-header-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 217, 138, 0.08);
          border: 1px solid rgba(255, 217, 138, 0.25);
          border-radius: 4px;
          padding: 10px 14px;
          margin-bottom: 1.2rem;
          font-size: 0.85rem;
        }

        .stat-points-pill {
          background: #ffd98a;
          color: #0a0a14;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
        }

        .attributes-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 1.4rem;
        }

        .attr-card {
          background: rgba(20, 24, 48, 0.7);
          border: 1px solid rgba(111, 231, 255, 0.2);
          border-radius: 4px;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .attr-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #ffd98a;
        }

        .attr-val {
          font-size: 0.95rem;
          font-weight: 700;
          color: #ffffff;
        }

        .ability-card {
          background: rgba(20, 24, 48, 0.6);
          border: 1px solid rgba(111, 231, 255, 0.2);
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .ability-title {
          font-size: 0.92rem;
          font-weight: 600;
          color: #6fe7ff;
        }

        .ability-meta {
          font-size: 0.75rem;
          color: #a0a6c2;
          margin-top: 2px;
        }

        /* Settings */
        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .setting-slider {
          accent-color: #6fe7ff;
          cursor: pointer;
        }

        /* Map Screen */
        #full-map-canvas {
          background: #07080e;
          border: 1px solid rgba(111, 231, 255, 0.3);
          border-radius: 6px;
          display: block;
          margin: 0 auto 12px auto;
        }

        /* Toast notifications */
        #menu-toast {
          position: absolute;
          bottom: 24px;
          right: 24px;
          background: rgba(15, 20, 40, 0.94);
          border: 1px solid #6fe7ff;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
          color: #e0f7ff;
          padding: 10px 18px;
          border-radius: 4px;
          font-size: 0.85rem;
          opacity: 0;
          transform: translateY(12px);
          transition: all 0.25s ease;
          pointer-events: none;
        }

        #menu-toast.show {
          opacity: 1;
          transform: translateY(0);
        }
      </style>

      <!-- HUD Top Bar with Minimap & Quick Actions -->
      <div id="hud-top-bar">
        <div id="hud-minimap-panel" title="Click or press [M] to open World Map">
          <div class="minimap-meta">
            <span id="minimap-coords">0, 0</span>
            <span id="minimap-biome">RUINS</span>
          </div>
          <canvas id="hud-minimap-canvas" width="96" height="96"></canvas>
        </div>
        <div class="hud-actions-col">
          <button id="btn-quick-map" class="hud-btn">Map [M]</button>
          <button id="btn-quick-inv" class="hud-btn">Inv [I]</button>
          <button id="btn-quick-skills" class="hud-btn">Skills [K]</button>
          <button id="hud-menu-trigger" class="hud-btn">Menu [ESC]</button>
        </div>
      </div>

      <!-- Main Pause / Title Menu Modal -->
      <div id="main-menu-backdrop" class="menu-modal-backdrop">
        <div class="menu-card">
          <div class="menu-title">MEMORY RECONSTRUCTION</div>
          <div class="menu-subtitle">Action-Roguelike Metroidvania</div>
          <div id="menu-save-info" class="menu-save-info" style="display: none;"></div>

          <div class="menu-buttons">
            <button id="btn-resume" class="menu-btn menu-btn-primary">Resume Run</button>
            <button id="btn-map" class="menu-btn">World Map [M]</button>
            <button id="btn-inventory" class="menu-btn">Inventory & Equipment [I]</button>
            <button id="btn-skills" class="menu-btn">Disciplines & Skills [K]</button>
            <button id="btn-save" class="menu-btn">Save Run</button>
            <button id="btn-load" class="menu-btn">Load Run</button>
            <button id="btn-settings" class="menu-btn">Settings</button>
            <button id="btn-tutorial" class="menu-btn">Tutorial & Controls</button>
            <button id="btn-story" class="menu-btn">Story & Lore</button>
          </div>
        </div>
      </div>

      <!-- World Map Modal -->
      <div id="map-backdrop" class="menu-modal-backdrop">
        <div class="menu-card" style="max-width: 680px;">
          <div class="menu-title" style="font-size: 1.8rem;">WORLD MAP</div>
          <div class="menu-subtitle">Explored Chunks & Depth</div>
          <div class="sub-modal-content">
            <canvas id="full-map-canvas" width="600" height="340"></canvas>
            <div id="map-legend" style="display: flex; justify-content: center; gap: 14px; font-size: 0.72rem; margin-bottom: 8px;">
              <span><span style="color: #a08a6e;">■</span> Ruins</span>
              <span><span style="color: #3d6b1f;">■</span> Forest</span>
              <span><span style="color: #4a4a6a;">■</span> Caves</span>
              <span><span style="color: #9932cc;">■</span> Crystal</span>
              <span><span style="color: #16213e;">■</span> Void</span>
              <span><span style="color: #ffd700;">■</span> Sanctuary</span>
            </div>
            <div id="map-summary" class="menu-save-info" style="margin-bottom: 0;"></div>
          </div>
          <button id="btn-close-map" class="menu-btn menu-btn-primary" style="margin-top: 1.2rem; width: 100%;">Return to Run</button>
        </div>
      </div>

      <!-- Inventory & Equipment Modal -->
      <div id="inventory-backdrop" class="menu-modal-backdrop">
        <div class="menu-card" style="max-width: 660px;">
          <div class="menu-title" style="font-size: 1.8rem;">INVENTORY & EQUIPMENT</div>
          <div class="menu-subtitle">Combat Gear, Consumables & Relics</div>
          <div id="inventory-list" class="sub-modal-content"></div>
          <button id="btn-close-inventory" class="menu-btn menu-btn-primary" style="margin-top: 1.2rem; width: 100%;">Close [I]</button>
        </div>
      </div>

      <!-- Skills & Disciplines Modal -->
      <div id="skills-backdrop" class="menu-modal-backdrop">
        <div class="menu-card" style="max-width: 660px;">
          <div class="menu-title" style="font-size: 1.8rem;">DISCIPLINES & SKILLS</div>
          <div class="menu-subtitle">Awaken Latent Disciplines</div>
          <div id="skills-content" class="sub-modal-content"></div>
          <button id="btn-close-skills" class="menu-btn menu-btn-primary" style="margin-top: 1.2rem; width: 100%;">Close [K]</button>
        </div>
      </div>

      <!-- Settings Modal -->
      <div id="settings-backdrop" class="menu-modal-backdrop">
        <div class="menu-card" style="max-width: 460px;">
          <div class="menu-title" style="font-size: 1.8rem;">SETTINGS</div>
          <div class="menu-subtitle">Audio & Presentation</div>
          <div class="sub-modal-content">
            <div class="setting-row">
              <label for="slider-master">Master Volume</label>
              <input type="range" id="slider-master" class="setting-slider" min="0" max="100" value="80">
            </div>
            <div class="setting-row">
              <label for="slider-music">Music Volume</label>
              <input type="range" id="slider-music" class="setting-slider" min="0" max="100" value="70">
            </div>
            <div class="setting-row">
              <label for="slider-sfx">SFX Volume</label>
              <input type="range" id="slider-sfx" class="setting-slider" min="0" max="100" value="80">
            </div>
            <div class="setting-row">
              <label for="toggle-shake">Screen Shake</label>
              <input type="checkbox" id="toggle-shake" checked style="cursor: pointer;">
            </div>
            <div class="setting-row">
              <label for="toggle-bloom">Bloom Lighting</label>
              <input type="checkbox" id="toggle-bloom" checked style="cursor: pointer;">
            </div>
          </div>
          <button id="btn-close-settings" class="menu-btn menu-btn-primary" style="margin-top: 1.2rem; width: 100%;">Save Settings</button>
        </div>
      </div>

      <!-- Story Modal -->
      <div id="story-backdrop" class="menu-modal-backdrop">
        <div class="menu-card" style="max-width: 580px;">
          <div class="menu-title" style="font-size: 1.8rem;">CHRONICLES</div>
          <div class="menu-subtitle">The Fractured Timeline</div>
          <div class="sub-modal-content">
            <h3 style="color: #ffd98a; margin-top: 0.8rem;">The Shattering</h3>
            <p style="font-size: 0.88rem; line-height: 1.5; color: #cdd3ea;">Centuries ago, the Core Memory Crystal of the ancient realm shattered. The catastrophe tore the continuum into drifting biomes, each suspended in deep stasis.</p>
            <h3 style="color: #ffd98a; margin-top: 0.8rem;">The Memory Echoes</h3>
            <p style="font-size: 0.88rem; line-height: 1.5; color: #cdd3ea;">Corrupted by the temporal void, ancient denizens and sentinels wander as scavengers, crystal guardians, and forgotten shadows.</p>
            <h3 style="color: #ffd98a; margin-top: 0.8rem;">Your Purpose</h3>
            <p style="font-size: 0.88rem; line-height: 1.5; color: #cdd3ea;">You awaken as a <strong>Memory Walker</strong>. Guided by sanctuary light, collect glowing fragments, gain levels, awaken latent disciplines, and piece together the true history.</p>
          </div>
          <button id="btn-close-story" class="menu-btn menu-btn-primary" style="margin-top: 1.2rem; width: 100%;">Return</button>
        </div>
      </div>

      <!-- Tutorial Modal -->
      <div id="tutorial-backdrop" class="menu-modal-backdrop">
        <div class="menu-card" style="max-width: 560px;">
          <div class="menu-title" style="font-size: 1.8rem;">HOW TO PLAY</div>
          <div class="menu-subtitle">Controls & Mechanics</div>
          <div class="sub-modal-content">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 0.5rem;">
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><th style="color: #6fe7ff; text-align: left; padding: 6px;">Action</th><th style="color: #6fe7ff; text-align: left; padding: 6px;">Key</th></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);"><td style="padding: 6px;">Movement</td><td style="padding: 6px;"><strong>W A S D</strong> / Arrows</td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);"><td style="padding: 6px;">Melee Slash</td><td style="padding: 6px;"><strong>Space</strong> or <strong>J</strong></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);"><td style="padding: 6px;">Dash</td><td style="padding: 6px;"><strong>Shift</strong></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);"><td style="padding: 6px;">Abilities</td><td style="padding: 6px;"><strong>1</strong> (Heal), <strong>2</strong> (Shield), <strong>3</strong> (Ultimate)</td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);"><td style="padding: 6px;">World Map</td><td style="padding: 6px;"><strong>M</strong></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);"><td style="padding: 6px;">Inventory</td><td style="padding: 6px;"><strong>I</strong> or <strong>B</strong></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);"><td style="padding: 6px;">Skills Tree</td><td style="padding: 6px;"><strong>K</strong></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);"><td style="padding: 6px;">Pause / Back</td><td style="padding: 6px;"><strong>Escape</strong></td></tr>
            </table>
          </div>
          <button id="btn-close-tutorial" class="menu-btn menu-btn-primary" style="margin-top: 1.2rem; width: 100%;">Understood</button>
        </div>
      </div>

      <!-- Victory Modal -->
      <div id="victory-backdrop" class="menu-modal-backdrop">
        <div class="menu-card">
          <div class="menu-title">MEMORY RESTORED</div>
          <div class="menu-subtitle">The Keeper Has Fallen</div>
          <div id="victory-stats" class="menu-save-info" style="display: block;"></div>
          <button id="btn-victory-continue" class="menu-btn menu-btn-primary" style="margin-top: 1.2rem; width: 100%;">Continue Walking</button>
        </div>
      </div>

      <!-- Toast Element -->
      <div id="menu-toast">Notification</div>
    `;

    gameContainer.appendChild(this.overlayContainer);
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Hotkey navigation
      if (e.code === 'Escape') {
        if (this.activeSubModal) {
          this.closeSubModal(this.activeSubModal);
        } else {
          this.toggleMenu();
        }
      } else if (e.code === 'KeyI' || e.code === 'KeyB') {
        this.toggleSubModal('inventory-backdrop', () => this.renderInventory());
      } else if (e.code === 'KeyK') {
        this.toggleSubModal('skills-backdrop', () => this.renderSkills());
      } else if (e.code === 'KeyM') {
        this.toggleSubModal('map-backdrop', () => this.renderWorldMap());
      }
    });

    // HUD triggers
    document.getElementById('hud-menu-trigger')?.addEventListener('click', () => this.toggleMenu());
    document.getElementById('hud-minimap-panel')?.addEventListener('click', () => {
      this.renderWorldMap();
      this.openSubModal('map-backdrop');
    });
    document.getElementById('btn-quick-map')?.addEventListener('click', () => {
      this.renderWorldMap();
      this.openSubModal('map-backdrop');
    });
    document.getElementById('btn-quick-inv')?.addEventListener('click', () => {
      this.renderInventory();
      this.openSubModal('inventory-backdrop');
    });
    document.getElementById('btn-quick-skills')?.addEventListener('click', () => {
      this.renderSkills();
      this.openSubModal('skills-backdrop');
    });

    // Pause menu triggers
    document.getElementById('btn-resume')?.addEventListener('click', () => this.closeMenu());
    document.getElementById('btn-map')?.addEventListener('click', () => {
      this.renderWorldMap();
      this.openSubModal('map-backdrop');
    });
    document.getElementById('btn-inventory')?.addEventListener('click', () => {
      this.renderInventory();
      this.openSubModal('inventory-backdrop');
    });
    document.getElementById('btn-skills')?.addEventListener('click', () => {
      this.renderSkills();
      this.openSubModal('skills-backdrop');
    });
    document.getElementById('btn-save')?.addEventListener('click', () => {
      if (this.saveSystem) {
        this.saveSystem.saveGame();
        this.refreshSaveInfo();
      }
    });
    document.getElementById('btn-load')?.addEventListener('click', async () => {
      if (this.saveSystem) {
        await this.saveSystem.loadGame();
      }
    });
    document
      .getElementById('btn-story')
      ?.addEventListener('click', () => this.openSubModal('story-backdrop'));
    document
      .getElementById('btn-tutorial')
      ?.addEventListener('click', () => this.openSubModal('tutorial-backdrop'));
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.populateSettings();
      this.openSubModal('settings-backdrop');
    });

    // Close buttons
    document
      .getElementById('btn-close-map')
      ?.addEventListener('click', () => this.closeSubModal('map-backdrop'));
    document
      .getElementById('btn-close-inventory')
      ?.addEventListener('click', () => this.closeSubModal('inventory-backdrop'));
    document
      .getElementById('btn-close-skills')
      ?.addEventListener('click', () => this.closeSubModal('skills-backdrop'));
    document
      .getElementById('btn-close-story')
      ?.addEventListener('click', () => this.closeSubModal('story-backdrop'));
    document
      .getElementById('btn-close-tutorial')
      ?.addEventListener('click', () => this.closeSubModal('tutorial-backdrop'));
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.applyAndSaveSettings();
      this.closeSubModal('settings-backdrop');
    });

    // Inventory clicks (equip / unequip / use)
    document.getElementById('inventory-list')?.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest(
        '[data-inventory-action]'
      ) as HTMLElement | null;
      if (!target || !this.playerSystem) return;

      const action = target.dataset.inventoryAction;
      const itemId = target.dataset.itemId;
      const slot = target.dataset.slot;

      if (action === 'use' && itemId) this.playerSystem.useItem(itemId);
      else if (action === 'equip' && itemId) this.playerSystem.equipItem(itemId);
      else if (action === 'unequip' && slot) this.playerSystem.unequipSlot(slot);

      this.renderInventory();
    });

    // Skills & Attribute clicks
    document.getElementById('skills-content')?.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest(
        '[data-skill-action]'
      ) as HTMLElement | null;
      if (!target || !this.playerSystem) return;

      const action = target.dataset.skillAction;
      const stat = target.dataset.stat;
      const abilityId = target.dataset.abilityId;

      if (action === 'add-stat' && stat) {
        this.playerSystem.addStatPoints(stat, 1);
        this.renderSkills();
      } else if (action === 'upgrade-ability' && abilityId) {
        if (typeof this.playerSystem.upgradeOrUnlockAbility === 'function') {
          this.playerSystem.upgradeOrUnlockAbility(abilityId);
        } else {
          this.playerSystem.unlockAbility(abilityId) || this.playerSystem.upgradeAbility(abilityId);
        }
        this.renderSkills();
      }
    });

    document.getElementById('btn-victory-continue')?.addEventListener('click', () => {
      document.getElementById('victory-backdrop')?.classList.remove('active');
      this.gameApp?.resume();
    });
  }

  private toggleSubModal(modalId: string, onOpen?: () => void): void {
    if (this.activeSubModal === modalId) {
      this.closeSubModal(modalId);
    } else {
      if (this.activeSubModal) {
        this.closeSubModal(this.activeSubModal);
      }
      onOpen?.();
      this.openSubModal(modalId);
    }
  }

  private openSubModal(id: string): void {
    this.activeSubModal = id;
    document.getElementById(id)?.classList.add('active');
    this.gameApp?.pause();
  }

  private closeSubModal(id: string): void {
    document.getElementById(id)?.classList.remove('active');
    if (this.activeSubModal === id) this.activeSubModal = null;
    if (!this.isMenuOpen) {
      this.gameApp?.resume();
    }
  }

  toggleMenu(): void {
    if (this.isMenuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu(): void {
    this.isMenuOpen = true;
    document.getElementById('main-menu-backdrop')?.classList.add('active');
    this.refreshSaveInfo();
    this.gameApp?.pause();
  }

  closeMenu(): void {
    this.isMenuOpen = false;
    this.activeSubModal = null;
    document.querySelectorAll('.menu-modal-backdrop').forEach((m) => m.classList.remove('active'));
    this.gameApp?.resume();
  }

  private renderInventory(): void {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('inventory-list');
    if (!container || !this.playerSystem) return;

    const inventory = this.playerSystem.getInventory?.() ?? [];
    const equipment = this.playerSystem.getEquipment?.() ?? {};
    const stats = this.playerSystem.getStats?.() ?? {};

    const escape = (val: any) =>
      String(val ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c
      );

    const statSummary = (item: any) =>
      Object.entries(item.stats ?? {})
        .map(([k, v]) => `${escape(k)} +${escape(v)}`)
        .join(' &middot; ');

    // Character Combat Sheet
    let html = `
      <div class="char-stats-strip">
        <div><div>ATK Damage</div><div class="char-stat-val">${stats.damage ?? 10}</div></div>
        <div><div>Armor / DEF</div><div class="char-stat-val">${stats.armor ?? 0}</div></div>
        <div><div>Move Speed</div><div class="char-stat-val">${stats.moveSpeed ?? 200}</div></div>
        <div><div>Crit Chance</div><div class="char-stat-val">${Math.round((stats.critChance ?? 0.05) * 100)}%</div></div>
      </div>
    `;

    // Equipment Slots
    html +=
      '<h3 style="font-family: Cinzel, serif; color: #ffd98a; margin-bottom: 8px;">Equipped Gear</h3>';
    html += '<div class="equip-slots-container">';
    const slots = ['weapon', 'armor', 'accessory'] as const;
    for (const slot of slots) {
      const item = equipment[slot];
      const rarityColor = item ? RARITY_COLORS[item.rarity] || '#6fe7ff' : '#a0a6c2';
      html += `
        <div class="equip-slot-box" style="border-color: ${rarityColor};">
          <div class="equip-slot-label">${slot}</div>
          <div class="equip-slot-name" style="color: ${rarityColor};">${item ? escape(item.name) : 'Empty Slot'}</div>
          <div class="equip-slot-stats">${item ? statSummary(item) : 'No item equipped'}</div>
          ${item ? `<button class="menu-btn" style="padding: 3px 8px; font-size: 0.72rem; margin: 0 auto;" data-inventory-action="unequip" data-slot="${slot}">Unequip</button>` : ''}
        </div>
      `;
    }
    html += '</div>';

    // Backpack
    html +=
      '<h3 style="font-family: Cinzel, serif; color: #ffd98a; margin-top: 1rem; margin-bottom: 8px;">Backpack</h3>';
    if (inventory.length === 0) {
      html +=
        '<p style="color: #a0a6c2; font-size: 0.85rem;">Your backpack is empty. Defeat enemies or discover memory crypts to find gear.</p>';
    } else {
      for (const item of inventory) {
        const canEquip =
          item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory';
        const canUse = item.type === 'consumable' || item.type === 'memory';
        const rarityColor = RARITY_COLORS[item.rarity] || '#ffffff';

        const actionBtn = canEquip
          ? `<button class="menu-btn" data-inventory-action="equip" data-item-id="${escape(item.id)}">Equip</button>`
          : canUse
            ? `<button class="menu-btn" data-inventory-action="use" data-item-id="${escape(item.id)}">Use</button>`
            : '';

        html += `
          <div class="inventory-row">
            <div>
              <strong style="color: ${rarityColor};">${escape(item.name)}</strong>
              <span class="item-rarity-badge" style="color: ${rarityColor};">${escape(item.rarity)}</span>
              <span style="font-size: 0.75rem; color: #a0a6c2;">&times;${item.quantity}</span>
              <div style="font-size: 0.75rem; color: #b0e5ff; margin-top: 2px;">${statSummary(item)}</div>
              <div style="font-size: 0.75rem; color: #8f96b3; margin-top: 2px;">${escape(item.description)}</div>
            </div>
            ${actionBtn ? `<div class="inventory-actions">${actionBtn}</div>` : ''}
          </div>
        `;
      }
    }

    container.innerHTML = html;
  }

  private renderSkills(): void {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('skills-content');
    if (!container || !this.playerSystem) return;

    const progression = this.playerSystem.getProgression?.() ?? {};
    const stats = this.playerSystem.getStats?.() ?? {};
    const abilities = this.playerSystem.getAbilities?.() ?? new Map();
    const statPoints = progression.statPoints ?? 0;

    const escape = (val: any) =>
      String(val ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c
      );

    let html = `
      <div class="skills-header-banner">
        <div>
          <strong>Level ${progression.level ?? 1} Walker</strong> &middot;
          <span>XP: ${progression.experience ?? 0} / ${progression.experienceToNext ?? 100}</span> &middot;
          <span style="color: #6fe7ff;">Fragments: ${progression.memoryFragments ?? 0}</span>
        </div>
        <div>
          <span class="stat-points-pill">${statPoints} Stat Points</span>
        </div>
      </div>

      <h3 style="font-family: Cinzel, serif; color: #ffd98a; margin-bottom: 8px;">Core Attributes</h3>
      <div class="attributes-grid">
        <div class="attr-card">
          <div><div class="attr-name">Strength</div><div style="font-size: 0.7rem; color: #a0a6c2;">+1 ATK Damage</div></div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="attr-val">${stats.strength ?? 10}</span>
            ${statPoints > 0 ? `<button class="menu-btn" style="padding: 2px 8px; font-size: 0.75rem;" data-skill-action="add-stat" data-stat="strength">+1</button>` : ''}
          </div>
        </div>
        <div class="attr-card">
          <div><div class="attr-name">Dexterity</div><div style="font-size: 0.7rem; color: #a0a6c2;">+Speed &amp; Crit</div></div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="attr-val">${stats.dexterity ?? 10}</span>
            ${statPoints > 0 ? `<button class="menu-btn" style="padding: 2px 8px; font-size: 0.75rem;" data-skill-action="add-stat" data-stat="dexterity">+1</button>` : ''}
          </div>
        </div>
        <div class="attr-card">
          <div><div class="attr-name">Intelligence</div><div style="font-size: 0.7rem; color: #a0a6c2;">+Mana &amp; Cooldowns</div></div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="attr-val">${stats.intelligence ?? 10}</span>
            ${statPoints > 0 ? `<button class="menu-btn" style="padding: 2px 8px; font-size: 0.75rem;" data-skill-action="add-stat" data-stat="intelligence">+1</button>` : ''}
          </div>
        </div>
        <div class="attr-card">
          <div><div class="attr-name">Vitality</div><div style="font-size: 0.7rem; color: #a0a6c2;">+Max Health</div></div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="attr-val">${stats.vitality ?? 10}</span>
            ${statPoints > 0 ? `<button class="menu-btn" style="padding: 2px 8px; font-size: 0.75rem;" data-skill-action="add-stat" data-stat="vitality">+1</button>` : ''}
          </div>
        </div>
      </div>

      <h3 style="font-family: Cinzel, serif; color: #ffd98a; margin-bottom: 8px;">Awakened Disciplines</h3>
    `;

    for (const [id, ability] of abilities.entries()) {
      const unlocked = ability.unlocked;
      const canUpgrade = unlocked ? ability.level < ability.maxLevel : true;
      const btnLabel = unlocked
        ? ability.level < ability.maxLevel
          ? `Rank Up (${ability.level}/${ability.maxLevel})`
          : 'Mastered'
        : 'Awaken Discipline';

      html += `
        <div class="ability-card" style="border-color: ${unlocked ? 'rgba(111, 231, 255, 0.35)' : 'rgba(255,255,255,0.1)'}; opacity: ${unlocked ? '1' : '0.8'};">
          <div>
            <div class="ability-title">${escape(ability.name)} <span style="font-size: 0.75rem; color: #ffd98a;">[${ability.type}]</span></div>
            <div class="ability-meta">Cooldown: ${ability.cooldown}s &middot; Mana: ${ability.manaCost} MP &middot; Status: ${unlocked ? `Rank ${ability.level}` : 'Dormant'}</div>
          </div>
          <div>
            ${canUpgrade && statPoints > 0 ? `<button class="menu-btn menu-btn-primary" style="padding: 4px 10px; font-size: 0.75rem;" data-skill-action="upgrade-ability" data-ability-id="${id}">${btnLabel}</button>` : `<span style="font-size: 0.75rem; color: #a0a6c2;">${btnLabel}</span>`}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  private renderWorldMap(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.getElementById('full-map-canvas') as HTMLCanvasElement | null;
    if (!canvas || !this.worldSystem) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const loaded = this.worldSystem.getLoadedChunks?.() ?? [];
    for (const chunk of loaded) {
      this.visitedChunks.add(`${chunk.x},${chunk.y}`);
    }

    const current = this.worldSystem.getCurrentChunk?.() ?? { x: 0, y: 0 };
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const tileSize = 28;
    const gap = 4;

    // Draw grid background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw visited chunks
    for (const key of this.visitedChunks) {
      const [cx, cy] = key.split(',').map(Number);
      const biome = this.worldSystem.getBiomeAt?.(cx * 512, cy * 512) ?? 'ruins';
      const color = BIOME_COLORS[biome] || '#a08a6e';

      const screenX = centerX + (cx - current.x) * (tileSize + gap) - tileSize / 2;
      const screenY = centerY + (cy - current.y) * (tileSize + gap) - tileSize / 2;

      if (
        screenX < -tileSize ||
        screenX > canvas.width ||
        screenY < -tileSize ||
        screenY > canvas.height
      )
        continue;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(screenX, screenY, tileSize, tileSize);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeRect(screenX, screenY, tileSize, tileSize);

      // Coordinate marker
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText(`${cx},${cy}`, screenX + 3, screenY + 12);
    }

    // Draw current player position
    ctx.strokeStyle = '#6fe7ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      centerX - tileSize / 2 - 2,
      centerY - tileSize / 2 - 2,
      tileSize + 4,
      tileSize + 4
    );

    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    const summaryEl = document.getElementById('map-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `Explored Chunks: <strong>${this.visitedChunks.size}</strong> &middot; Current Chunk: <strong>[${current.x}, ${current.y}]</strong> &middot; Biome: <strong>${(this.worldSystem.getBiomeAt?.(current.x * 512, current.y * 512) ?? 'ruins').toUpperCase()}</strong>`;
    }
  }

  private updateMinimap(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.getElementById('hud-minimap-canvas') as HTMLCanvasElement | null;
    if (!canvas || !this.worldSystem) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const current = this.worldSystem.getCurrentChunk?.() ?? { x: 0, y: 0 };
    this.visitedChunks.add(`${current.x},${current.y}`);

    const coordsEl = document.getElementById('minimap-coords');
    const biomeEl = document.getElementById('minimap-biome');
    const biome = this.worldSystem.getBiomeAt?.(current.x * 512, current.y * 512) ?? 'ruins';

    if (coordsEl) coordsEl.textContent = `${current.x}, ${current.y}`;
    if (biomeEl) biomeEl.textContent = biome.toUpperCase();

    const boxSize = 16;
    const gap = 2;
    const originX = canvas.width / 2;
    const originY = canvas.height / 2;

    // Draw local 5x5 chunks
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const cx = current.x + dx;
        const cy = current.y + dy;
        const key = `${cx},${cy}`;
        const isVisited = this.visitedChunks.has(key);

        const x = originX + dx * (boxSize + gap) - boxSize / 2;
        const y = originY + dy * (boxSize + gap) - boxSize / 2;

        if (isVisited) {
          const b = this.worldSystem.getBiomeAt?.(cx * 512, cy * 512) ?? 'ruins';
          ctx.fillStyle = BIOME_COLORS[b] || '#4a4a6a';
          ctx.globalAlpha = 0.85;
          ctx.fillRect(x, y, boxSize, boxSize);
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.globalAlpha = 0.5;
          ctx.fillRect(x, y, boxSize, boxSize);
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeRect(x, y, boxSize, boxSize);
      }
    }

    // Highlight current chunk
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#6fe7ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(originX - boxSize / 2, originY - boxSize / 2, boxSize, boxSize);

    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(originX, originY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private refreshInventoryIfOpen(): void {
    if (typeof document !== 'undefined' && this.activeSubModal === 'inventory-backdrop') {
      this.renderInventory();
    }
  }

  private refreshSkillsIfOpen(): void {
    if (typeof document !== 'undefined' && this.activeSubModal === 'skills-backdrop') {
      this.renderSkills();
    }
  }

  private refreshSaveInfo(): void {
    const infoEl = document.getElementById('menu-save-info');
    const loadBtn = document.getElementById('btn-load') as HTMLButtonElement | null;
    if (!infoEl || !this.saveSystem) return;

    if (this.saveSystem.hasSave()) {
      const meta = this.saveSystem.getSaveMetadata();
      if (meta) {
        infoEl.style.display = 'block';
        infoEl.innerHTML = `<strong>Saved Run</strong>: Level ${meta.level} • Fragments: ${meta.fragments} • Time: ${meta.playTime}`;
      }
      if (loadBtn) loadBtn.disabled = false;
    } else {
      infoEl.style.display = 'none';
      if (loadBtn) loadBtn.disabled = true;
    }
  }

  private populateSettings(): void {
    if (!this.saveSystem) return;
    const settings = this.saveSystem.loadSettings();

    const master = document.getElementById('slider-master') as HTMLInputElement | null;
    const music = document.getElementById('slider-music') as HTMLInputElement | null;
    const sfx = document.getElementById('slider-sfx') as HTMLInputElement | null;
    const shake = document.getElementById('toggle-shake') as HTMLInputElement | null;

    if (master) master.value = String(settings.masterVolume);
    if (music) music.value = String(settings.musicVolume);
    if (sfx) sfx.value = String(settings.sfxVolume);
    if (shake) shake.checked = settings.screenShake;
  }

  private applyAndSaveSettings(): void {
    if (!this.saveSystem) return;

    const master = Number(
      (document.getElementById('slider-master') as HTMLInputElement)?.value ?? 80
    );
    const music = Number(
      (document.getElementById('slider-music') as HTMLInputElement)?.value ?? 70
    );
    const sfx = Number((document.getElementById('slider-sfx') as HTMLInputElement)?.value ?? 80);
    const shake = (document.getElementById('toggle-shake') as HTMLInputElement)?.checked ?? true;

    this.saveSystem.saveSettings({
      masterVolume: master,
      musicVolume: music,
      sfxVolume: sfx,
      screenShake: shake,
    });

    void this.eventBus.emit('audio:volume', {
      master: master / 100,
      music: music / 100,
      sfx: sfx / 100,
    });

    this.showToast('Settings saved!');
  }

  private showVictory(data: any): void {
    if (typeof document === 'undefined') return;
    const stats = document.getElementById('victory-stats');
    if (stats) {
      const summary = buildVictorySummary(data);
      stats.innerHTML = `
        <div>Depth reached: <strong>${summary.depth}</strong></div>
        <div>Runs completed: <strong>${summary.runs}</strong></div>
        <div>Memory Walker level: <strong>${summary.level}</strong></div>
        <div>Fragments carried: <strong>${summary.fragments}</strong></div>
      `;
    }
    document.getElementById('victory-backdrop')?.classList.add('active');
    this.gameApp?.pause();
  }

  showToast(message: string): void {
    const toast = document.getElementById('menu-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  update(deltaTime: number): void {
    this.minimapTimer += deltaTime;
    if (this.minimapTimer >= 0.15) {
      this.minimapTimer = 0;
      this.updateMinimap();
    }
  }

  async shutdown(): Promise<void> {
    this.overlayContainer?.remove();
    await Promise.resolve();
  }

  serialize(): ModuleState {
    return {
      version: this.version,
      timestamp: Date.now(),
      data: { isMenuOpen: this.isMenuOpen, visitedChunks: Array.from(this.visitedChunks) },
      checksum: 'menuSystem',
    };
  }

  deserialize(state: ModuleState): void {
    if (state.data?.isMenuOpen !== undefined) this.isMenuOpen = state.data.isMenuOpen;
    if (Array.isArray(state.data?.visitedChunks)) {
      this.visitedChunks = new Set(state.data.visitedChunks);
    }
  }
}
