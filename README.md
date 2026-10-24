# Memory Reconstruction

[![AIKit Integrated](https://img.shields.io/badge/AIKit-integrated-6f42c1)](https://github.com/Aegean-E/AIKit)

**Action-Roguelike Metroidvania about rebuilding a fragmented world from lost memories.**

![Game Banner](assets/banner.png)

## ⚡ 30-Second Cold-Start Quick Reference

- **Runtime Prerequisites**: Node.js >= 18, npm >= 9
- **Canonical Regression Shield Gate**:
  ```bash
  npm test
  ```

### 🛠️ AIKit Commands (run from the AIKit folder)

| Role                              | Command                                       |
| --------------------------------- | --------------------------------------------- |
| Status, task and gates            | `python aikit.py status MemoryReconstruction` |
| Phase 4: every gate               | `python aikit.py check MemoryReconstruction`  |
| Repair memory and map, then check | `python aikit.py fix MemoryReconstruction`    |
| Resume an interrupted task        | `python aikit.py resume MemoryReconstruction` |

## 📦 What's Inside

```text
MemoryReconstruction/
├── .aikit/                   <- this project's memory: record, ledger, decisions
├── .github/
├── .gitattributes            <- LF normalization and binary asset rules
├── .gitignore                <- transient AIKit state excluded
├── .prettierrc
├── PROJECT_PRINCIPLES.md
├── README.md
├── assets/
├── docs/
├── eslint.config.js
├── index.html
├── LICENSE
├── package-lock.json
├── package.json
├── scripts/
├── src/
├── start.bat
├── start.sh
├── tests/
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Overview

Memory Reconstruction is a 2.5D action-roguelike metroidvania where you play as a **Memory Walker** - a being capable of navigating the fragmented remains of a shattered world. Each run explores procedurally generated biomes, combats memory-corrupted entities, and collects **Memory Fragments** to reconstruct the world's true history.

### Key Features

- **2.5D Graphics**: Hand-painted Memory Light sprites, biome tile atlases, parallax backdrops, dynamic lighting and post-processing
- **Adaptive Music**: Vertical layering system that responds to combat intensity
- **Memory Fragment Loop**: Collect glowing fragments, earn experience, level up, and unlock new abilities
- **Combo Combat**: Chained hits build a capped damage bonus that drops on damage or after a timed window
- **Memory Surge**: Pickups and kills chained within a short window multiply fragment experience
- **Depth-Scaled Threats**: Enemies grow tougher and more rewarding the deeper you explore
- **Roguelike Runs**: Procedural worlds with meta-progression across runs
- **AI-Native Architecture**: Built for AI testing, RLM compatibility, and deterministic simulation
- **Modular Design**: Plugin architecture for easy extension
- **Smooth Streaming**: batched per-chunk tile graphics and chunk-crossing streaming keep corner navigation at 60fps

### Core Loop Mechanics

| Mechanic         | Behaviour                                                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Combo chain      | Up to 5 **confirmed** hits (+10% damage each). A swing extends the chain only when it connects; whiffing does not. Drops after 2s without a hit or when the player is hit.                                  |
| Melee arc        | Punches a 120° cone in the facing direction, so positioning and facing matter instead of every swing being a radial burst.                                                                                  |
| Enemy telegraphs | Melee, ranged and skirmisher archetypes hold a 0.18–0.8s windup before striking. Stun, freeze or a hit at/above `staggerThreshold` cancels it; ordinary knockback does not, so melee enemies can retaliate. |
| Bestiary         | All 13 authored enemy types spawn from the biome tables, each with its own stats, attack range and archetype. Ranged enemies kite and fire projectiles; skirmishers disengage after striking.               |
| Memory Surge     | Fragment pickups and kills chained within 4s compound up to 2.75x XP. Breaks on damage.                                                                                                                     |
| Run progress     | Chunk-derived depth is tracked as `deepestDepth`; normal death blurs 25% of current-level XP; killing the Keeper increments `completedRuns`.                                                                |
| Items            | The Inventory & Equipment panel consumes healing/cleanse/memory items and equips weapons, armor and accessories with live derived-stat updates.                                                             |
| Loot             | Kills roll the authored per-enemy loot table; memory currency becomes a 30s pickup and equipment becomes inventory loot.                                                                                    |
| Elites           | Deep spawns can roll the authored Veteran, Champion or Nightmare modifiers, scaling health, damage, speed, armor and rewards with a visible tint.                                                           |
| Boss phases      | The Forgotten and Keeper cross authored health thresholds that raise stats and execute phase abilities: summoned echoes, projectile rings, teleports and aimed beams. Bosses never roll random elites.      |
| Permadeath       | With `roguelike.permadeath` enabled, death resets level, XP, fragments, abilities and run inventory while preserving deaths, deepest depth and completed runs.                                              |
| Victory          | Killing the Keeper opens the Memory Restored screen with depth, run count, level and fragments carried.                                                                                                     |
| Hit feedback     | Every resolved hit, including player melee and projectiles, spawns a pooled floating damage number; criticals are larger and gold.                                                                          |
| Depth scaling    | Enemy health +5%, damage +2.5%, and rewards +10% per depth unit.                                                                                                                                            |
| Dash             | Costs 40 stamina (20/s regen), covers 150px, and grants brief invincibility.                                                                                                                                |
| Progression      | XP follows the authored curve, levels cap at 50, and per-level stat gains survive stat-point spending.                                                                                                      |

All combat timing uses accumulated simulation time, so headless runs and seeded replays stay deterministic.

## Quick Start

```bash
# Zero-friction launcher
start.bat          # on Windows
./start.sh         # on Linux/macOS

# Or via npm
npm start          # or npm run dev

# Test
npm test

# Build
npm run build

# Regenerate the themed sprites, tilesets, UI and atlas metadata
python scripts/generate_art_assets.py
```

## Controls

| Action   | Keyboard          | Gamepad    |
| -------- | ----------------- | ---------- |
| Move     | WASD / Arrow Keys | Left Stick |
| Attack   | Space / J         | A / X      |
| Dash     | Shift / K         | B / RB     |
| Interact | E / L             | Y          |
| Pause    | Escape            | Start      |

## Architecture

This project follows strict principles for **AI compatibility**, **modularity**, **RLM support**, and **testability**. See:

- [AI Agent Guide](docs/AI_AGENT_GUIDE.md) - For any AI working on this project
- [Architecture](docs/ARCHITECTURE.md) - System design and data flow
- [Contributing](docs/CONTRIBUTING.md) - Development workflow
- [Project Principles](PROJECT_PRINCIPLES.md) - Core philosophy

## Tech Stack

- **Language**: TypeScript (strict)
- **Rendering**: PixiJS v8 + WebGPU/WebGL
- **Audio**: Web Audio API
- **ECS**: Custom module system (ecsy-compatible)
- **Testing**: Vitest + custom deterministic harness
- **Config**: Zod-validated JSON
- **Shaders**: WGSL (WebGPU Shading Language)

## Game Design

### Genre

Action-Roguelike Metroidvania - High replayability, clear progression, exploration-focused

### Visual Style

Octopath Traveler-inspired: 2D hand-painted sprites with 3D normal-mapped lighting

### Story

**Theme**: Memory Reconstruction
**Delivery**: Environmental storytelling, minimal text
**Arc**: Discovery → Loss → Hope → Creation

### Music

Adaptive orchestral/ambient hybrid with vertical layering (intensity) and horizontal transitions

## Development

### Project Structure

```
src/
  core/       # EventBus, ModuleRegistry, ConfigManager, GameApplication
  engine/     # AssetManager, InputSystem
  graphics/   # RenderSystem, ActorRenderer, atlases, HUD
  audio/      # AudioSystem
  gameplay/   # WorldSystem, PlayerSystem, CombatSystem, MemoryFragmentSystem,
              # enemyCatalog, itemCatalog
  ui/         # MenuSystem, victorySummary
  data/       # gameplay.config.json, enemies.json, items.json, biomes.json
  ai/         # AISystem (RLM, agents, observation)
  testing/    # TestingHarness (scenarios, replay, benchmarks)
  utils/      # Math, color, string, time helpers
```

### Adding Features

See [AI_AGENT_GUIDE.md](docs/AI_AGENT_GUIDE.md#adding-a-new-module) for patterns.

### Testing

```bash
# Run all scenarios
npm test

# Specific scenario
npm test -- --testNamePattern="basic_combat"

# Benchmark
npm run ai:benchmark

# Headless replay
npm run ai:replay -- --scenario=basic_combat --seed=12345

# Static checks
npm run lint
npm run typecheck

# Deterministic balance matrix (PowerShell)
$env:BALANCE_REPORT=1; npx vitest run tests/balance.test.ts
```

### Continuous Integration

`.github/workflows/ci.yml` runs `npm ci`, lint, typecheck, tests and the production build on every push and pull request. The same four commands are the local pre-push gate.

## RLM Compatibility

The game implements **Recursive Language Model** compatibility:

- Full state serializable to JSON (< 50k tokens)
- Deterministic simulation with seeded RNG
- Incremental state updates
- Token budgeting per module
- Headless mode for AI training/evaluation

```javascript
// In browser console
const state = window.__GAME__.serialize();
// Send to RLM context...

// Restore
await window.__GAME__.deserialize(state);
```

## License

AGPLv3 - see [LICENSE](LICENSE).

## Credits

- **Architecture**: Designed for AI-human collaboration
- **Art Style**: Inspired by Octopath Traveler, Hyper Light Drifter
- **Music System**: Inspired by Celeste, Hollow Knight adaptive audio
- **Roguelike Design**: Inspired by Dead Cells, Hades, Slay the Spire

---

_Built with ❤️ for AI and human developers alike_
