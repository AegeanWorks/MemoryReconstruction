# Architecture

Memory Reconstruction separates **rules** from **presentation**. The simulation
(`src/sim`) is plain TypeScript with no DOM or PixiJS imports. Everything else
reads its state and reacts to the events it emits. See ADR-016 in
`.aikit/decisions.md` for why the earlier module-registry design was replaced.

```text
             InputFrame (one per 1/60 s step)
  input/ ───────────────────────────────┐
                                        ▼
                               ┌──────────────────┐
                               │  sim/World.step  │  deterministic, seeded
                               └───────┬──────────┘
                    SimEvent[]         │        state (read-only)
          ┌────────────────┬───────────┼──────────────┬─────────────┐
          ▼                ▼           ▼              ▼             ▼
     view/Renderer    audio/Sound   ui/Hud     app/App (flow)   save/SaveStore
     (PixiJS)         (Web Audio)   (DOM)      title/pause/      (localStorage)
                                               choice/death
```

## Frame loop (`app/App.ts`)

1. Read the gamepad, then run as many fixed 1/60 s simulation steps as real
   time allows (up to 5 per frame; the backlog is dropped after that).
2. Before each step, `Renderer.beforeStep()` records positions. Each step
   turns input into an `InputFrame`, calls `World.step`, and passes the
   returned events to the renderer, sound, HUD and the App's own flow
   handling (floor exit, death, victory, fragment saving).
3. Render once, interpolating positions between the last two steps, then
   update the HUD.

The App is a state machine: `title → playing ⇄ paused | choice | map →
transition → playing … → dead | victory → title`.

## Simulation (`src/sim`)

| Module         | Responsibility                                                                 |
| -------------- | ------------------------------------------------------------------------------ |
| `rng.ts`       | mulberry32 RNG; `floorSeed(runSeed, depth)` gives each floor its own seed       |
| `tiles.ts`     | `TileGrid`: void/floor/wall/door tiles, decorations, locked doors              |
| `dungeon.ts`   | floor generator: rooms on a 6x6 cell grid, straight 3-wide corridors, room kinds |
| `physics.ts`   | box-versus-tile movement with sub-steps and corner slipping; circle separation  |
| `pathing.ts`   | flow field toward the player so enemies route around pillars                   |
| `content.ts`   | typed views of `enemies.json`, `biomes.json`, `lore.json`; the floor plan       |
| `entities.ts`  | plain-data `Player`, `Enemy`, `Projectile`, `Pickup`, `Interactable`, `InputFrame` |
| `combat.ts`    | the `Arena` interface actors use, plus arc and damage helpers                  |
| `player.ts`    | movement, three-hit combo, dash, bolt, potion                                   |
| `enemies.ts`   | archetype AI (melee, skirmisher, caster, brute, boss) with windup telegraphs    |
| `upgrades.ts`  | upgrade cards; stats are recomputed from the counts taken                      |
| `run.ts`       | `RunState` carried across floors: XP, level-ups, choices, save/restore          |
| `world.ts`     | one floor in play: rooms, waves, loot, projectiles, interactables, `step()`     |

Rules that matter when changing the sim:

- **Determinism.** All randomness goes through the World's `Rng`. Same seed
  plus same inputs gives the same result (tested).
- **Plain data.** Entities and `RunState` are JSON-serializable. A save is
  `JSON.stringify(run)`, and `restoreRun` recomputes derived stats.
- **No import of `world.ts` from actors.** Player and enemy code see only the
  `Arena` interface, which keeps the module graph acyclic.
- **Fairness.** Enemies hurt only through telegraphed attacks: windup, then
  attack, then a recovery window the player can punish.
- **Engagement rewards live in the sim.** `run.ts` holds the Flow streak
  constants and `resonanceMultiplier`; `world.ts` decides every payout: kills
  inside `RESONANCE_WINDOW` build the streak, `graze()` pays a near miss,
  `rollSurge()` rolls the variable-ratio shard drop, `floorObjectives()` and
  `claimFloorBonus()` own the full-clear bonus, and every event is emitted for
  the view, sound and HUD to read. Nothing here depends on the screen.

### Floors

`FLOOR_PLANS` in `content.ts` fixes six floors: biome, enemy roster, boss and
room count. The last is a straight approach to the Keeper's arena. Every room
contains its cell's centre band, so corridors run straight along cell centre
lines and never cut through another room. Obstacles stay off the centre lines,
which keeps every doorway reachable (tested across seeds).

Entering a combat or boss room (fully past its doorway) locks its doors and
spawns waves. Clearing it unlocks the doors. The treasure room holds a chest
(upgrade pick plus a memory fragment), the shrine holds a Memory Well (shards
buy healing and a pick), and the boss drops a fragment and opens the exit rift.

Clearing a room without taking damage pays a flawless bonus. A floor also has
an optional full-clear goal: every combat room and every chest before the
guardian falls, which pays shards and a potion once. `claimFloorBonus` is
checked both when the boss falls and when the last chest is opened, so the
order the player takes them in does not matter.

## View (`src/view`)

- `Renderer.ts`: the PixiJS application, layer stack, camera (smooth follow,
  aim look-ahead, shake, height-based zoom), darkness vignette, hurt flash.
- `LevelView.ts`: tile sprites in 16x16-tile chunks, culled off-screen. Wall
  faces show where a wall has floor to its south, with caps above for height.
  Freestanding single walls render as biome props. Also draws animated door
  barriers and glyph lights.
- `tileArt.ts` / `palette.ts`: biome tiles painted with Canvas2D at load (no
  tileset images), from per-biome render palettes.
- `ActorView.ts`: sprites keyed by entity id; animation, hit flash, wind-up
  telegraphs, health bars, projectiles, pickups, chests, wells and the rift.
- `Effects.ts`: particles, slash arcs, rings, damage numbers, shake, motes.
- `sheets.ts`: cuts the sprite sheets described by `sprite_atlas.json`.

## UI (`src/ui`)

DOM elements over the canvas, styled by `ui.css`. `Hud` writes only changed
values each frame and shows the Flow meter (dimmed when idle) plus the floor
objective line, which is recomputed a few times a second instead of every
frame. `Screens` shows one menu at a time: the pause panel summarises the run,
and an upgrade screen can reroll its offer for shards. `Minimap` draws visited
rooms and their neighbours, ticks cleared rooms, and pulses unclaimed chests
and wells. The HUD fades while a menu is open.

## Persistence (`src/save`)

`SaveStore` keeps two localStorage keys: meta progress (fragments, records,
settings), validated by a zod schema, and the run snapshot written at each
floor's entrance. Missing, corrupt or old-format data falls back to defaults;
storage errors never break the game.
