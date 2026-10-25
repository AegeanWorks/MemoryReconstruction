# Game Project Principles

**This document must be read by every AI agent working on this project.**

> **Current architecture:** the module-contract, event-bus and RLM sections
> below describe the original design, which was replaced by a deterministic
> `src/sim` core with separate view, UI and app layers (ADR-016). The goals
> still apply: readable code, seeded determinism, a headless simulation,
> serializable state and layered visuals. For how they are met now, see
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Core Principles

### 1. AI Compatibility (Universal)
- All code must be readable and understandable by any AI model
- Use clear, descriptive naming conventions
- Avoid obscure patterns or "clever" code
- Document intent, not just implementation
- Provide type hints and contracts for all public APIs

### 2. Modularity & Extensibility
- **Plugin Architecture**: Core systems are swappable modules
- **Interface-First Design**: Define contracts before implementations
- **Event-Driven Communication**: Loose coupling via event bus
- **Dependency Injection**: No hardcoded dependencies
- **Versioned APIs**: Breaking changes require major version bump

### 3. RLM (Recursive Language Model) Compatibility
- **State Externalization**: Game state lives in structured data, not context
- **Deterministic Snapshots**: Full game state serializable to JSON
- **Incremental Updates**: Only changed state transmitted
- **Context Budgeting**: Each system declares its token cost
- **Streaming State**: Large worlds streamed in chunks

### 4. AI Testability
- **Deterministic Seeds**: All randomness controllable via seed
- **Headless Mode**: Full simulation without rendering
- **Replay System**: Record/playback for regression testing
- **AI Benchmark Scenarios**: Standardized test cases
- **Observable Metrics**: Performance, balance, fun metrics exposed

### 5. Development Environment
- **VS Code Native**: Tasks, debugging, extensions configured
- **Hot Reload**: Code and asset changes without restart
- **Type Safety**: Strict TypeScript/Python with full inference

### 6. Visual Quality (2.5D Minimum)
- **Layered Rendering**: Background, midground, foreground, UI layers
- **Parallax Depth**: Multiple scroll speeds for depth illusion
- **Dynamic Lighting**: Normal maps, bloom, shadows
- **Particle Systems**: GPU-accelerated effects
- **Post-Processing**: Color grading, vignette, CRT/shader effects

### 7. Human Appeal Requirements

#### Genre
- **Primary**: Action-Roguelike with Metroidvania exploration
- **Why**: High replayability, clear progression, AI-friendly state space

#### Visual Style
- **Aesthetic**: Hand-painted 2D sprites with 3D lighting (Octopath Traveler style)
- **Color Theory**: Harmonious palettes, clear readability
- **Animation**: 12-frame smooth animations, squash & stretch

#### Story
- **Theme**: "Memory Reconstruction" - Player rebuilds fragmented world
- **Delivery**: Environmental storytelling, minimal text
- **Emotional Arc**: Discovery → Loss → Hope → Creation

#### Music
- **Style**: Adaptive orchestral/ambient hybrid
- **System**: Vertical layering (intensity), horizontal (transitions)
- **Themes**: Character leitmotifs, location themes

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      GAME APPLICATION                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Core    │  │ Engine   │  │Graphics  │  │ Audio    │     │
│  │  Systems │  │ Systems  │  │ Systems  │  │ Systems  │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│       │             │             │             │            │
│       └─────────────┼─────────────┼─────────────┘            │
│                     ▼                                           │
│           ┌─────────────────┐                                  │
│           │   EVENT BUS     │ ◄── Decoupled Communication      │
│           └────────┬────────┘                                  │
│                    │                                           │
│       ┌───────────┼───────────┐                                 │
│       ▼           ▼           ▼                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐                              │
│  │Gameplay│ │   AI   │ │Testing │                              │
│  │Modules │ │ Layer  │ │Framework│                             │
│  └────────┘ └────────┘ └────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## Module Contract

Every module MUST implement:
```typescript
interface IGameModule {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  readonly tokenBudget: number;  // For RLM
  
  initialize(context: ModuleContext): Promise<void>;
  update(deltaTime: number): void;
  shutdown(): Promise<void>;
  serialize(): ModuleState;
  deserialize(state: ModuleState): void;
}
```

## RLM State Protocol

```json
{
  "version": "1.0",
  "timestamp": 1234567890,
  "seed": 42,
  "modules": {
    "world": { "chunks": [...], "entities": [...] },
    "player": { "position": [x,y], "stats": {...}, "inventory": [...] },
    "quest": { "active": "...", "progress": {...} }
  },
  "checksum": "sha256..."
}
```

## AI Testing Interface

```typescript
interface AITestHarness {
  // Deterministic simulation
  runScenario(scenario: TestScenario, seed: number): TestResult;
  
  // Headless tick
  tick(steps: number): GameStateSnapshot;
  
  // Metrics collection
  getMetrics(): GameMetrics;
  
  // State inspection
  inspectState(path: string): any;
}
```

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Core Systems | `*System.ts` | `RenderSystem.ts` |
| Components | `*Component.ts` | `HealthComponent.ts` |
| Entities | `*Entity.ts` | `PlayerEntity.ts` |
| Events | `*Event.ts` | `DamageEvent.ts` |
| Interfaces | `I*.ts` | `IRenderable.ts` |
| Types | `*.types.ts` | `combat.types.ts` |
| Config | `*.config.json` | `graphics.config.json` |
| Shaders | `*.glsl` / `*.wgsl` | `sprite.wgsl` |

## Extension Points

| Extension Point | Interface | Example Use |
|----------------|-----------|-------------|
| New Entity Types | `IEntityFactory` | Custom enemies |
| Game Modes | `IGameMode` | Speedrun, pacifist |
| Render Effects | `IPostProcessEffect` | CRT, pixelate |
| AI Behaviors | `IBehaviorTree` | Boss patterns |
| World Generators | `IWorldGenerator` | Biome types |
| Audio Layers | `IAudioLayer` | Dynamic music |

## Versioning Policy

- **MAJOR**: Breaking API changes, principle violations
- **MINOR**: New modules, features, non-breaking additions
- **PATCH**: Bug fixes, performance, balance

## Code Quality Gates

All PRs must pass:
- [ ] TypeScript strict mode (no `any`)
- [ ] ESLint + Prettier
- [ ] Unit tests > 80% coverage
- [ ] AI benchmark scenarios pass
- [ ] Deterministic replay verification
- [ ] Token budget audit (RLM)
- [ ] Visual regression tests
- [ ] Audio quality check

---

**Remember**: This project exists to be a showcase of AI-human collaboration. Every decision should ask: "Would another AI understand this? Would a human enjoy this?"