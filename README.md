# Memory Reconstruction

[![AIKit Integrated](https://img.shields.io/badge/AIKit-integrated-6f42c1)](https://github.com/Aegean-E/AIKit)

**A top-down action roguelike about rebuilding a shattered world from lost memories.**

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
├── COMMERCIAL.md
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

You are a **Memory Walker** crossing six procedurally generated floors, from the Forgotten Ruins to the Sanctuary of Reconstruction. Each floor is a set of rooms: walk into one and its doors seal until every enemy is gone. Grow stronger by picking upgrades, beat each floor's guardian, and step through the rift it leaves behind. Defeat the Keeper on the sixth floor to win.

Death ends the run, but **memory fragments** you recover are kept forever. Gather all of a memory's fragments to restore it and read its story in the title screen's *Memories* panel.

### Features

- **Readable combat**: every enemy attack has a red ground telegraph (arc, line, circle or aim line) before it lands; enemies never deal contact damage.
- **Three-hit combo** with a wide, heavy finisher; a dash with invulnerability frames and two charges; a mana-powered bolt; hit-stop, screen shake, sparks and damage numbers.
- **Flow streaks and grazes**: kills inside a 3 s window build a Flow streak worth up to +50% XP and shards, and taking a hit drops it; dashing past or through the edge of an attack is a *graze* that refunds mana, part of a dash charge and flow-window time.
- **Variable-ratio loot surges**: shard drops sometimes roll a rich vein (2.5x, ~18%) or a memory surge (5x, ~6%), each with its own sound and banner.
- **Optional floor objective**: clear every combat room and open the chest before the guardian falls for a shard-and-potion *floor restored* bonus; a room cleared without taking damage also pays a *flawless* bonus. Progress is shown in the HUD and on the map, with a tick on cleared rooms and a pulse on unclaimed chests and wells.
- **QoL**: reroll an upgrade offer for shards (key **R**), a pause summary with the run's Flow, graze, surge and floor-restoration record plus the echoes you own, a dimmed HUD behind menus, and map legend/objective lines.
- **Six biomes, thirteen enemies, six bosses**: melee bruisers, skirmishers that circle and lunge, casters that kite and fire spreads, brutes with ground slams, and bosses with three health phases and rotating patterns (bullet rings, charges, volleys, summons).
- **18 upgrades** offered as cards on level-up (common, rare and epic), from treasure chests and from Memory Wells that trade shards for healing and a pick.
- **Top-down 2.5D look**: procedurally painted biome tiles with lit wall faces and ambient occlusion, depth-sorted sprites, glows, a darkness vignette around the player and ambient dust.
- **Synthesized audio**: every sound and the ambient score are generated with the Web Audio API.
- **Saves**: the run is saved at each floor's entrance (*Continue* on the title screen); settings and recovered memories persist in the browser.
- **Keyboard and mouse or gamepad.**

### Why these mechanics

The engagement pass is grounded in the same behavioral-game-design literature that shapes CyberPulse's design notes:

| Principle | Source | In Memory Reconstruction |
| --------- | ------ | ------------------------ |
| Variable-ratio reinforcement, reward prediction error | Skinner; Schultz | Rich vein and memory surge loot rolls per kill |
| Near-miss striatal response | Clark et al., 2009 | Graze rewards for slipping past an attack instead of only avoiding it |
| Loss aversion / prospect theory | Kahneman & Tversky | Flow streak is a stake you can lose: any hit resets it |
| Flow channel | Csikszentmihalyi | Streak multiplier tightens the 3 s window: risk rises with reward |
| Zeigarnik effect | Zeigarnik | Visible floor objective (rooms + chest) and unclaimed markers on the map |
| Competence & autonomy (PENS) | Ryan & Deci | Flawless-room bonus, rerollable offers, mastery recorded on the pause and death screens |
| Goal gradient | Kivetz et al. | Objective line counts down as the floor nears completion |

## Quick Start

```bash
# Zero-friction launcher
start.bat          # on Windows
./start.sh         # on Linux/macOS

# Or via npm
npm install
npm start          # opens the dev server on http://localhost:3000

npm test           # unit and simulation tests
npm run build      # production build in dist/
```

## Controls

| Action           | Keyboard / mouse | Gamepad      |
| ---------------- | ---------------- | ------------ |
| Move             | WASD / arrows    | Left stick   |
| Aim              | Mouse            | Right stick  |
| Strike (hold)    | Left click / J   | RT           |
| Memory bolt      | Right click / K  | LT           |
| Dash             | Space / Shift    | A / RB       |
| Potion           | Q                | X            |
| Interact         | E / F            | Y            |
| Map              | Tab / M          | Back         |
| Pause            | Esc / P          | Start        |
| Pick a card      | 1 / 2 / 3        | -            |
| Reroll cards     | R                | -            |

## How It Is Built

The game is split so the rules never depend on the screen:

```text
src/
  sim/      deterministic game rules: dungeon generation, physics, player,
            enemies, combat, upgrades, run state; no DOM, no PixiJS
  view/     PixiJS renderer: procedural tile art, sprites, telegraphs, effects, camera
  ui/       DOM overlay: HUD, minimap, menus and upgrade cards (ui.css)
  input/    keyboard, mouse and gamepad, turned into one input frame per step
  audio/    Web Audio synthesis for effects and ambience
  save/     localStorage persistence, validated with zod
  app/      the state machine (title, play, pause, choice, death, victory)
  data/     enemies, biomes, lore and sprite atlas JSON
```

The simulation advances in fixed 1/60 s steps from a seed, so a run with the same seed and inputs replays exactly. Tests drive a `World` headlessly. In the browser, `window.__MR__` exposes the running app for automated playtests.

- [Architecture](docs/ARCHITECTURE.md): modules, data flow and the frame loop
- [AI Agent Guide](docs/AI_AGENT_GUIDE.md): how to add enemies, upgrades, bosses and biomes
- [Graphics](docs/Graphics.md): art direction and the asset pipeline
- [Contributing](docs/CONTRIBUTING.md): workflow and checks

## Tech Stack

TypeScript (strict), PixiJS 8, Vite, Vitest, zod and the Web Audio API.

## Development

```bash
npm run dev         # dev server with hot reload
npm test            # all tests
npm run lint        # ESLint + Prettier
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + production bundle

# Regenerate sprites and the sprite atlas (Python + Pillow)
python scripts/generate_art_assets.py
```

`.github/workflows/ci.yml` runs install, lint, typecheck, tests and the build on every push and pull request.

## License

AGPLv3 - see [LICENSE](LICENSE).

## Credits

- **Roguelike design**: inspired by Hades, Enter the Gungeon, The Binding of Isaac and Dead Cells
- **Art style**: inspired by Hyper Light Drifter
