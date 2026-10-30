# AI Agent Guide

Read [ARCHITECTURE.md](ARCHITECTURE.md) first. This guide covers common changes.

## Commands

```bash
npm install
npm run dev        # play at http://localhost:3000
npm test                  # vitest: sim, save and asset tests
npm run test:mechanics    # headless sim gate declared in .aikit/project.json
npm run lint && npm run typecheck && npm run build
```

## Where things live

- Game rules: `src/sim/`. Change behaviour here, and test it here.
- Looks: `src/view/`. Menus and HUD: `src/ui/`. Sounds: `src/audio/Sound.ts`.
- Names, stats and lore: `src/data/*.json`. Sprite sheet layout: `src/data/sprite_atlas.json`.

## Recipes

**Add an enemy.** Add a record to `src/data/enemies.json` (stats, `ai.behavior`,
hitbox, sprite height). Add its sheet to `sprite_atlas.json` `enemies`, and
map its id in `SPRITE_KEYS` (`src/sim/content.ts`) if the atlas key differs.
If it reuses an existing sheet, give it an `ENEMY_TINTS` entry so it reads as
its own enemy; prefer a mid-tone sheet, since a tint cannot lift a near-black
one. Put it in a roster in `FLOOR_PLANS`. The behaviour string picks an
archetype via `ARCHETYPES`.

**Add an upgrade.** Add an entry to `UPGRADES` in `src/sim/upgrades.ts`. If it
needs a new stat, add the stat to `PlayerStats` and `BASE_STATS`, then read it
in `player.ts` or `world.ts`.

**Change a boss.** Edit its pattern list in `BOSS_PATTERNS` (`src/sim/enemies.ts`).
Attack kinds are `strike, lunge, slam, shot, spread, ring, charge, volley, summon, beam, mortar, mines, spiral, blink, bomb, quake, hook`.
`ActorView.drawTelegraph` draws each kind's warning.

**Add or retheme a biome.** Add the biome to `biomes.json`, give it a render
palette in `src/view/palette.ts`, an obstacle prop in `LevelView.ts`
`OBSTACLE_PROPS` and an ambience root in `Sound.ts`, then reference it from
`FLOOR_PLANS`.

**Tune difficulty.** The levers are `ENEMY_DAMAGE_SCALE` and `BOSS_HEALTH_SCALE`
(`content.ts`), the per-depth `scale` and wave size in `World.spawnEnemy` and
`World.spawnWave`, `xpForLevel` (`run.ts`), and `BASE_STATS`.

**Add a Sanctuary restoration or checkpoint.** Restorations live in `RESTORATIONS`
(`src/sim/hub.ts`) and grant free starting stacks of one upgrade; checkpoints
come from `checkpointDepths()` (every third section plus the last). Echo prices,
banking (`echoesEarned`) and skipped-start math (`createExpedition`) are tested in
`tests/hub.test.ts`.

## Testing a change

- Unit and simulation tests create a `World` from `createRun(seed, [])` and
  call `world.step(input, 1/60)` with scripted `InputFrame`s. See
  `tests/sim/world.test.ts`.
- In the browser, `window.__MR__` is the running `App`: `__MR__.state`,
  `__MR__.world` (player, enemies, rooms). Playwright playtests use it to
  teleport into rooms and read state.

## Rules of thumb

- Keep `src/sim` free of DOM and PixiJS imports, so it stays testable headlessly.
- Route every random decision through the World's `Rng`, never `Math.random`.
- Enemy damage only through telegraphed attacks; give new attacks a windup
  and a telegraph shape.
- Keep entity records plain data (no classes), so saves stay `JSON.stringify`.
