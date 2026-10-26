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

The App is a state machine: `title → sanctuary ⇄ hub → playing ⇄ paused | choice | map | inventory →
transition → playing … → dead | victory → sanctuary`.

## Simulation (`src/sim`)

| Module         | Responsibility                                                                     |
| -------------- | ---------------------------------------------------------------------------------- |
| `rng.ts`       | mulberry32 RNG; `floorSeed(runSeed, depth)` gives each floor its own seed          |
| `tiles.ts`     | `TileGrid`: void/floor/wall/door tiles, decorations, locked doors                  |
| `dungeon.ts`   | floor generator: rooms on a 7x6 cell grid, straight 3-wide corridors, room kinds   |
| `sanctuary.ts` | hand-built Sanctuary hall: 10 stations, 5 NPCs, expedition gate, furniture decor   |
| `physics.ts`   | box-versus-tile movement with sub-steps and corner slipping; circle separation     |
| `pathing.ts`   | flow field toward the player so enemies route around pillars                       |
| `content.ts`   | typed views of `enemies.json`, `biomes.json`, `lore.json`; the 16-section plan     |
| `entities.ts`  | plain-data `Player`, `Enemy`, `Projectile`, `Pickup`, `Interactable`, `InputFrame` |
| `combat.ts`    | the `Arena` interface actors use, plus arc and damage helpers                      |
| `weapons.ts`   | three melee stances (`sword`, `spear`, `greatsword`), combo steps, swing styles    |
| `equipment.ts` | run-scoped relics (`weapon`, `armor`, `trinket`), stat modifiers, rarity rolls     |
| `player.ts`    | movement, stance combos, weapon arts, dash, bolt, potion, bombs, traps             |
| `enemies.ts`   | archetype AI (melee, skirmisher, caster, brute, boss) with windup telegraphs       |
| `upgrades.ts`  | upgrade cards; stats are recomputed from the counts taken                          |
| `hub.ts`       | Sanctuary restorations, checkpoint math, echo banking, `createExpedition`          |
| `quests.ts`    | NPC definitions, quest catalogue, save-derived progress snapshots                  |
| `run.ts`       | `RunState` carried across floors: XP, level-ups, choices, save/restore             |
| `world.ts`     | one floor in play: rooms, waves, loot, projectiles, interactables, `step()`        |

Rules that matter when changing the sim:

- **Determinism.** All randomness goes through the World's `Rng`. Same seed
  plus same inputs gives the same result (tested).
- **Plain data.** Entities and `RunState` are JSON-serializable. A save is
  `JSON.stringify(run)`, and `restoreRun` recomputes derived stats.
- **No import of `world.ts` from actors.** Player and enemy code see only the
  `Arena` interface, which keeps the module graph acyclic.
- **Fairness.** Enemies hurt only through telegraphed attacks: windup, then
  attack, then a recovery window the player can punish.
- **The hub is a sim module, not a screen.** `hub.ts` owns the restoration
  table, checkpoint maths, echo banking (`echoesEarned`) and `createExpedition`,
  which turns meta progress into a fresh `RunState` (free starting upgrades,
  vestige picks and level for a skipped start). `SaveStore` persists the extra
  meta fields with zod defaults, so pre-hub saves still load. The App only
  shows menus and calls these pure helpers.
- **Engagement rewards live in the sim.** `run.ts` holds the Flow streak
  constants and `resonanceMultiplier`; `world.ts` decides every payout: kills
  inside `RESONANCE_WINDOW` build the streak, `graze()` pays a near miss,
  `rollSurge()` rolls the variable-ratio shard drop, `floorObjectives()` and
  `claimFloorBonus()` own the full-clear bonus, and every event is emitted for
  the view, sound and HUD to read. Nothing here depends on the screen.

### Floors

`FLOOR_PLANS` in `content.ts` fixes sixteen sections, including two boss-only
Echo Trial episodes: biome, enemy roster, boss,
room count and a `layout` (`branch`, `ring`, `spine`, `grid`, `diamond` or `cross`).
Each room also has a shape (`rect`, `rounded`, `octagon`, `cave`) cut into the
rectangle before corridors; `arena` and `library` are extra room kinds, and a
`bossOnly` plan generates one octagonal arena with no trash. `layoutCells`
builds the cell pattern for each style before the existing Prim linking, so
routes and sightlines change by section. The last is a straight approach to
the Keeper's arena. Every room contains its cell's centre band, so corridors
run straight along cell centre lines and never cut through another room.
Obstacles stay off the centre lines, which keeps every doorway reachable
(tested across seeds).

Entering a combat or boss room (fully past its doorway) locks its doors and
spawns waves. Clearing it unlocks the doors. The treasure room holds a chest
(upgrade pick plus a memory fragment), the shrine holds a Memory Well (shards
buy healing and a pick), and the boss drops a fragment and opens the exit rift.

Later sections field larger waves (up to four per room) and summons draw from
the section roster, so the pressure and the faces both escalate.

Clearing a room without taking damage pays a flawless bonus. A floor also has
an optional full-clear goal: every combat room and every chest before the
guardian falls, which pays shards and a potion once. `claimFloorBonus` is
checked both when the boss falls and when the last chest is opened, so the
order the player takes them in does not matter.

Rooms also generate `hazards`: spike plates, flame vents, poison pools,
rockfall markers and explosive barrels. `updateHazards` runs their
warning/active cycle; burst damage goes through `damagePlayer`/`damageEnemy`,
so traps can be used against enemies. A lever interactable disables every trap
in its room. Barrels are destructible through `hitHazards`, which player
swings, dashes and bolts call. `blasts` (mortars, rockfall, mines) are separate
delayed entities with their own update and view telegraph.

### Combat and relics

`AttackKind` includes the original melee/ranged set plus `beam` (a lane attack
with segment collision), `mortar` (delayed blasts), `mines`, `spiral` and
`blink`. `WINDUP`/`ACTIVE` tables and `BOSS_PATTERNS` are exhaustive records,
so a new kind cannot be forgotten. Casters pick late attacks by section depth,
and bosses rotate unique silhouettes and patterns.

Boss sheets are authored at 192px and the runtime renders with nearest
filtering, so they stay sharp at their large display size. Melee stances live
in `weapons.ts`: three `WeaponDef` combo tables with reach, arc, knockback,
timing, movement commitment, swing style and animation speed. The player
stores `weapon`; `1/2/3` (or the gamepad D-pad) switches it through
`InputFrame.weapon`. Each stance has its own idle, walk and attack strips, so
the held model is visible at all times, and `V` fires a weapon art on a 7 s
cooldown. Effects draw the matching crescent, thrust or wide arc.

Bombs are `Bomb` entities in `World.bombs`: they travel, bounce off walls, fuse,
chain-detonate nearby bombs, and damage both sides. `bomb` is also an `AttackKind`
used by bombardiers/hive drones. Player traps are `hazard` entries of kind
`trap`; they arm after a moment and then fire once when any body enters, which
is why they are dangerous to the player too.

Relics are run-scoped `{ uid, defId }` instances in `equipment.ts`, with mods
in `equipment.json`. `applyEquipment` runs after `computeStats`, so upgrades
and gear compose; percentage stats multiply, everything else adds. Bosses,
elites, chests and the merchant drop them; `World.equipItem` swaps slots and
`refreshStats` re-applies. Gear is lost with the run; quest rewards go into
`Meta.vault` and are granted again by `createExpedition`.

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
  telegraphs (including beams, mortars, mines, spirals and blinks), health
  bars, projectiles, pickups, chests, wells, hazard shapes, blast/mine
  telegraphs, Sanctuary stations with floating labels, and the rift.
- `Effects.ts`: particles, slash arcs, rings, damage numbers, shake, motes.
- `sheets.ts`: cuts the sprite sheets described by `sprite_atlas.json`.

## UI (`src/ui`)

DOM elements over the canvas, styled by `ui.css`. `Hud` writes only changed
values each frame and shows the Flow meter (dimmed when idle) plus the floor
objective line, which is recomputed a few times a second instead of every
frame. `Screens` shows one menu at a time: the pause panel summarises the run,
an upgrade screen selects then confirms (or rerolls for shards), the relic
screen equips/swaps/discards, and NPC dialogue accepts or claims a quest.
`Minimap` draws visited rooms and their neighbours, ticks cleared rooms, and
pulses unclaimed chests and wells. The HUD fades while a menu is open.

### The Sanctuary map

`World` takes `{ sanctuary: true }` and builds `sanctuary.ts`'s hand-made hall
instead of a procedural floor: no enemies or hazards, ten labeled stations
(seven restorations plus Training Yard, Meditation Stone and Notice Board),
five labeled NPCs, the gate, and non-interactive `decor` furniture (shelves,
tables, chairs, crates, planters, lanterns) placed by `SANCTUARY_DECOR`. Each station has its own prop silhouette; labels fade in only near the walker so they never clip at the viewport edge. The App runs it as the `sanctuary`
state, shows a prompt for the nearest station, and routes interaction events
to the rebuild ledger, NPC dialogue or the checkpoint picker. `quests.ts`
derives progress from the save (`fragments`, `kills`, `restored`, `depth`,
`bosses`) rather than storing counters twice; claims write echoes and an
optional vault relic. `questLogScreen` renders the whole quest section from the
same definitions, reachable from the pause menu and the Notice Board. The
Training Yard writes `Meta.startingWeapon`; the Meditation Stone buys a
one-expedition `Meta.boon`, consumed by `createExpedition`.

## Persistence (`src/save`)

`SaveStore` keeps two localStorage keys: meta progress (fragments, records,
settings), validated by a zod schema, and the run snapshot written at each
floor's entrance. Missing, corrupt or old-format data falls back to defaults;
storage errors never break the game.
