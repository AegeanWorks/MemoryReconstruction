# Commit-Range Audit

Cumulative audit of `projects/MemoryReconstruction`, starting at commit 1
(`407e047`, initial project setup). Each range is `1 -> N`; the audit inspects
the range's diff, compares it with the current implementation, and runs the
relevant gates. Findings are fixed in the working tree with failing-first tests
where the defect is behavioural.

## Range 1 -> 3 (`407e047..889c341`)

**Commits:** initial project setup, `ConfigManager.patch` deep-merge fix,
placeholder 2.5D sprites.

**Verification:** current `SaveStore` suite; full `npm test`.

**Finding (fixed):** the deep-merge principle from commit 2 was lost in the
rebuild. `SettingsSchema` required `masterVolume`, `musicVolume`, `sfxVolume`
and `screenShake`, so a pre-volume save with a partial `settings` object failed
the whole `MetaSchema` parse and `loadMeta()` silently returned `defaultMeta()`:
all fragments, runs, victories, echoes and checkpoints were lost.

**Fix:** every settings field now has a per-field zod default, so a partial
object is merged with defaults instead of rejecting the save.

**Evidence:** `tests/save.test.ts` added `keeps progress when settings are
partial (pre-volume saves)`. Before the fix it failed with
`expected [] to deeply equal [ 'fragment_001' ]`; after the fix the file passes
11/11. The same test asserts `sfxVolume` defaults to 0.8 and `screenShake` to
true while the saved `masterVolume`/`musicVolume` survive.

## Range 1 -> 6 (`407e047..fc88543`)

**Commits:** graphics documentation, generated asset manifest, asset existence
tests.

**Verification:** `tests/assets.test.ts` (4 tests) and the
`maps every enemy to a sprite in the atlas` case in
`tests/sim/content.test.ts` pass. The new Ossuary Chanter reuses the existing
`voidCantor` atlas sheet, so the atlas gate stays green without new art.

**Finding:** none.

## Range 1 -> 9 (`407e047..2da1dd8`)

**Commits:** RLM compatibility docs and validator, AIKit governance integration.

**Verification:** `python aikit.py check MemoryReconstruction` reports 8/8
gates. The old module-registry architecture was intentionally replaced by the
top-down rebuild (ADR-016); the current game keeps the governance and the
testable sim/view split, and no runtime RLM path is needed.

**Finding:** none.

## Range 1 -> 12 (`407e047..4188569`)

**Commits:** Memory Light art pipeline and animated renderer, README tree sync,
AGPL-3.0 license switch.

**Verification:** the current renderer paints top-down tiles with Canvas2D and
uses Pixi filters for the vignette; `docs/Graphics.md` states the `.wgsl`
shaders are unused, and a source search finds no `sprite_lit`/`light.wgsl`
references. The license later moved to AGL-1.1 in `e5ce830`, so AGPL-3.0 is
historical rather than current.

**Finding (fixed):** `docs/Graphics.md` still said "five hooded residents" and
listed five role props. The Sanctuary has six residents; the Hearthkeeper's
ladle and steaming bowl were missing. The count and prop list are corrected.

## Range 1 -> 15 (`407e047..cffa6ce`)

**Commits:** LICENSE tree entry, stale Stellar Drift cleanup, memory fragment
collection and progression loop.

**Verification:** the fragment/lore and systems suites pass in the full
`npm test` run.

**Finding (fixed):** `docs/ARCHITECTURE.md` had stale counts from before the
late-content expansion: 16 sections and two Echo Trials (actual: 23 sections
and four trials), five Sanctuary NPCs and ten stations (actual: six NPCs and
eight places), up to four waves per room (actual: up to ten), and "a straight
approach to the Keeper's arena" for the last floor (actual: a ring around the
First Memory's arena). The document now matches the current floor plan.

## Range 1 -> 18 (`407e047..95067a9`)

**Commits:** player-melee resolution, `start.bat`/`start.sh`/`npm start`,
engine UX, menu, save and story systems.

**Verification:** `start.bat`, `start.sh` and `npm start` exist; the Vite server
port in `vite.config.ts` is 3000, matching the launcher message. The melee,
save and story suites pass. The save suite also covers the range 1 -> 3 fix.

**Finding:** none new.

## Range 1 -> 21 (`407e047..bb6b2d5`)

**Commits:** engine UX/menu/save/story, ledger bookkeeping, batched chunk
rendering that stopped per-frame streaming churn.

**Verification:** `tests/save.test.ts` 11/11, `tests/hub.test.ts` 25/25,
`tests/sim/dungeon.test.ts` 25/25 and `tests/sim/world.test.ts` 44/44 pass.
`LevelView.ts` still renders 16x16-tile chunks and culls off-screen; the
architecture doc describes that path. The save suite includes the range 1 -> 3
partial-settings regression.

**Finding:** none.

## Range 1 -> 24 (`407e047..6243984`)

**Commits:** ledger bookkeeping, atlas axis-aligned comment, completed combat,
run, loot and boss systems.

**Verification:** `tests/sim/systems.test.ts` 79/79, `tests/sim/arsenal.test.ts`
10/10 and `tests/sim/world.test.ts` 44/44 pass. These cover run state, combat,
loot, boss flow and world stepping.

**Finding:** none.

## Range 1 -> 27 (`407e047..ff5aa28`)

**Commits:** ledger bookkeeping, README AIKit badge, terrain generator overhaul,
lag elimination, minimap, inventory and skills UI.

**Verification:** `tests/sim/dungeon.test.ts` 25/25 covers floor generation and
connectivity; `tests/sim/arsenal.test.ts` 10/10 covers the stance/art kit;
`tests/sim/world.test.ts` 44/44 covers room flow. The README still carries the
AIKit badge (`README.md:5`), and `src/ui/Minimap.ts` is present.

**Finding:** none.

## Range 1 -> 30 (`407e047..1d48d93`)

**Commits:** the top-down rebuild and Flow streaks, grazes and loot surges.

**Verification:** `tests/sim/systems.test.ts` 79/79, `tests/sim/arsenal.test.ts`
10/10 and `tests/sim/world.test.ts` 44/44 pass. Flow/grazes are covered in the
systems and engagement suites inside the full `npm test` run.

**Finding:** none.

## Range 1 -> 33 (`407e047..ca495e0`)

**Commits:** walkable Sanctuary and Echo Trials, AGL-1.1 licensing, reviewed
media/project identity.

**Verification:** `tests/hub.test.ts` 25/25, `tests/sim/tide-trial.test.ts` 5/5
and the Echo Trial coverage in `tests/sim/frontier-world.test.ts` 5/5 pass.
`LICENSE`, `COMMERCIAL.md`, `assets/banner.png`, `assets/logo.jpg` and
`assets/social-preview.svg` exist.

**Finding (fixed):** the README said "twenty-three sector bosses and four unique
Trial guardians", double-counting the four boss-only Echo Trials. The game has
23 bosses total, four of which are Trial guardians. The line now reads
"twenty-three bosses, including four unique Trial guardians".

## Range 1 -> 36 (`407e047..eac0e52`)

**Commits:** the reviewed media and project-identity pass.

**Verification:** the reviewed media and brand assets exist and the README
links them.

**Finding:** none.

## Range 1 -> 39 (`407e047..5ac5734`)

**Commits:** the model-rendered, individually reviewed identity assets.

**Verification:** the identity assets exist and the README has the brand
section.

**Finding:** none.

## Range 1 -> 42 (`407e047..db5d79d`)

**Commits:** README brand-asset documentation and license tags.

**Verification:** the README documents the generated brand assets and their
licenses.

**Finding:** none.

## Range 1 -> 45 (`407e047..e585415`)

**Commits:** license tags, topic tags and README badges.

**Verification:** `ui-hub-layout` 3/3 and `hub` 25/25 pass.

**Finding:** none.

## Range 1 -> 48 (`407e047..59b5f60`)

**Commits:** the Sanctuary hub rebuild, the UI baseline and the short-click /
wall-gap fix.

**Verification:** `attack-buffer` 3/3 and `wall-gap` 3/3 pass.

**Finding:** none.

## Range 1 -> 51 (`407e047..9fa9f7b`)

**Commits:** the rest-resume fix and its UI baselines.

**Verification:** `hub` 25/25 passes; `healRunForRest` keeps depth and seed and
refills health, mana and potions.

**Finding (test gap closed):** the heal half of the rest-resume fix had no
dedicated test; `healRunForRest` now covers it. Recorded as ADR-159.

## Range 1 -> 54 (`407e047..468c97a`)

**Commits:** overlay containment and keyboard screen navigation.

**Verification:** `Screens.show` focuses the first control and each screen
registers its key handler.

**Finding:** none.

## Range 1 -> 57 (`407e047..743feca`)

**Commits:** the run-lifecycle audit and the biome backdrop/resident art pass.

**Verification:** `atmosphere` 3/3 passes; the biome backdrops and resident
props exist.

**Finding:** none.

## Range 1 -> 60 (`407e047..599cb86`)

**Commits:** the remaining biome prop and backdrop sprites.

**Verification:** the prop and backdrop sprites exist; `assets` 4/4 passes.

**Finding:** none.

## Range 1 -> 63 (`407e047..a55b909`)

**Commits:** the Memory Walker's shadowed face and glowing eyes, the shrine's
own gabled sprite, and the refreshed atlas/manifests.

**Verification:** the player sheets and `scripts/generate_art_assets.py` still
draw the hood cavity and two eyes; `shrine` is present in both
`assets/data/sprite_atlas.json` and `src/data/sprite_atlas.json`, in
`assets/data/graphics.assets.json` and `assets/manifest.json`, and
`ActorView.interactableLook` maps `shrine` to the new prop. `tests/assets.test.ts`
passes 4/4.

**Finding (fixed):** commit `1334604` gave the shrine its own gabled sprite but
left the fountain's animated water pool in `ActorView`: both the creation branch
and the per-frame update still matched `it.kind === 'shrine'`. The shrine
therefore drew a blue water ellipse and ripples under its memory flame, so it
still read as a second fountain.

**Fix:** add `hasWaterEffect(kind, structureId)` in `src/view/propFx.ts` (true
for fountains and the wellspring, false for shrines) and use it in both
`ActorView` branches. `tests/ui-shrine-water.test.ts` failed first with
`Failed to load url ../src/view/propFx`, then passes 1/1.

**Evidence:** `docs/qa/cycle-range63-shrine-before.png` shows the water pool and
ripples under the gabled shrine; `cycle-range63-shrine-after.png` shows the same
shrine with the memory flame and no water. Both runs are the same depth-0 seed,
viewport and camera, with zero console errors.

## Range 1 -> 66 (`407e047..3116cb5`)

**Commits:** UI baseline after the shrine fix, enemy-family eye motifs, and the
regenerated banner copy removed from tracking.

**Verification:** `scripts/generate_art_assets.py` contains `_enemy_eyes` with
the `slits`, `single`, `many`, `hollow` and `glare` modes plus the paired
default; the affected enemy sheets exist and `tests/assets.test.ts` passes 4/4.
The `assets/data/sprite_atlas.json` and `src/data/sprite_atlas.json` mirrors
normalize to identical JSON (28,745 compressed characters), so the refresh did
not leave them semantically out of step. `assets/banner.png` is ignored by
`.gitignore:56`, `git ls-files assets/banner.png` is empty, and the file exists
as the intended generated local copy.

**Finding:** none. The eye motifs are generator/art-only, the UI baseline is
bookkeeping, and the banner is intentionally generated and untracked.

## Range 1 -> 69 (`407e047..cd59c8b`)

**Commits:** per-tile floor weathering variants, UI baseline, and wall-side
room dressing.

**Verification:** `src/view/tileArt.ts` paints four floor variants with
variant-specific cracks and wear; `LevelView.addDressing` is deterministic per
room, only uses floor tiles with a wall above, skips glyph tiles, and is
view-only so it never enters the simulation. `tests/sim/overlap.test.ts` passes
18/18 and the full suite covers room flow.

**Finding:** none. The dressing cannot block movement or loot because it is a
view-layer sprite, and the doorway/glyph exclusions hold.

## Range 1 -> 72 (`407e047..5224425`)

**Commits:** room-dressing UI baseline, the Keeper's radiant-judge rebuild, and
the Keeper UI baseline.

**Verification:** the Keeper sheet is a 192x192 frame; `enemyDef('keeper', true)`
returns sprite `keeper` with `displayHeight` 192. `tests/ui-boss-focus.test.ts`
passes 4/4 and `tests/sim/frontier-content.test.ts` passes 5/5. The
room-dressing baseline is bookkeeping; the 1 -> 69 deep dive covers the
dressing code.

**Finding (test gap closed):** the Keeper's display height was only covered
indirectly through the First Memory. Added `keeps the rebuilt Keeper on the
192px boss frame`, which pins the sprite key and 192px height. No runtime
change.

## Range 1 -> 75 (`407e047..5603625`)

**Commits:** Bone Tyrant rebuild and Void Cantor's own body, six borrowed late
mobs given dedicated sheets, and the late-mob UI baseline.

**Verification:** `SPRITE_KEYS` maps the six to `magmaHound`, `tideCaller`,
`petalWitch`, `ashHerald`, `cinderHound` and `frostOracle`; all six atlas keys
exist and the six redundant tint entries are gone. `tests/sim/content.test.ts`
17/17 maps every enemy to an atlas sprite, and `tests/sim/melee-human.test.ts`
6/6, `tests/assets.test.ts` 4/4 and `tests/sim/catacomb-roster.test.ts` 2/2 (the
Void Cantor reuse) pass. The Bone Tyrant and Void Cantor sheets are present in
both atlases.

**Finding:** none.

## Range 1 -> 78 (`407e047..7a0db8b`)

**Commits:** per-biome atmosphere profiles, the ambient particle field, and the
atmosphere ledger close.

**Verification:** `ATMOSPHERE` defines exactly one profile for every biome (16),
each with 32-48 motes, valid texture/motion/blend keys and ordered numeric
ranges; `tests/atmosphere.test.ts` passes 3/3. `Effects` builds a fresh field
from `atmosphereFor(biome)` for each floor and recycles motes inside the camera
view, so tide/storm/void fields do not leak between sections.

**Finding (fixed):** `docs/Graphics.md` listed the atmosphere fields for 14
biomes but omitted **tide** and **storm**. Added "tide bubbles" and "storm
sleet" to the per-biome list. No runtime change.

## Range 1 -> 81 (`407e047..39a654b`)

**Commits:** the Memory Walker's flowing two-tail scarf, the scarf ledger close,
and the six early mobs' dedicated bodies.

**Verification:** `scripts/generate_art_assets.py` has `player_scarf` and
`scarf_ribbon` for the forked tails, plus dedicated body functions for the
scavenger, bombardier, cave crawler, plague caster, hive guard and archer.
`tests/assets.test.ts` 4/4, `tests/sim/content.test.ts` 17/17 and
`tests/sim/melee-human.test.ts` 6/6 pass. `docs/Graphics.md` describes the
forked scarf and all six silhouettes.

**Finding:** none.

## Range 1 -> 84 (`407e047..284ffc6`)

**Commits:** early-mob ledger close, a real walk sway for every enemy, and the
renderer switch to the walk rows.

**Verification:** `_enemy_common` clamps the walk step to `sin(t*2pi) * 0.05`;
`sheets.ts` now builds `walk: row('walk')`; `ActorView` plays `sheet.walk` for
chasing enemies at `walkRateFor(speed)`. All atlas enemy sheets carry a
four-frame walk row. The new `tests/ui-enemy-walk.test.ts` passes 2/2 and
`tests/assets.test.ts` 4/4.

**Finding (test gap closed):** the idle-to-walk-row switch had no regression
test. Added `ui-enemy-walk` covering every atlas sheet's four-frame walk row
and the `walkRateFor` clamps (0.75/1/1.5). No runtime change.

## Range 1 -> 87 (`407e047..1155dd5`)

**Commits:** walk ledger close, click-to-equip relic bag/single-click skill
choice/bottom HUD, and six wisp-kind silhouettes.

**Verification:** `Screens.ts` inventory rows are clickable (`gear-row
clickable`), equip/swap/discard-confirm and the gear-stat strip are present;
`World.equipItem`/`unequip`/`discardItem` back them. The `_wisp` generator has
shard, rift, antler, hollow, slit and orb branches, and all wisp sheets exist.
`tests/assets.test.ts` 4/4 and `tests/sim/content.test.ts` 17/17 pass.

**Finding (fixed):** `docs/Graphics.md` still described the Memory Echo as
"floating tatters" and the Shadow as "tall void silhouette". Corrected them to
the current orb-with-orbiting-crystal and hooded-cloak silhouettes, and added
the Solder Wisp and Hive Drone rows. No runtime change.

## Range 1 -> 90 (`407e047..5cd6d58`)

**Commits:** beast silhouettes (cog hound, bog leech, wildling), hound variant
reads (grave, magma, cinder), and warden variant reads (cinder, frost).

**Verification:** the generator has the `mechanical`, `slug`, `magma`, `cinder`
and `frost` branches; `bogLeech.png`, `cogHound.png`, `cinderHound.png`,
`magmaHound.png`, `cinderWarden.png` and `frostWarden.png` are present.
`tests/assets.test.ts` 4/4 and `tests/sim/content.test.ts` 17/17 pass. The
`grave` flag is metadata only; the base skull hound is the grave read.

**Finding (fixed):** `docs/Graphics.md` did not record the new hound/warden
silhouette language. Added the paragraph describing the grave base, magma
cracks/flame tail, cinder smoke plumes and the cinder/frost warden signatures.
No runtime change.

## Range 1 -> 93 (`407e047..ff50e46`)

**Commits:** melee finisher on wounded enemies, melee hits interrupting
windups, and overkill carrying to nearby enemies.

**Verification:** `tests/sim/world.test.ts` covers the finisher's +50% damage
and mana restore, the windup interrupt plus boss immunity, and the half-excess
overkill spill to the nearest enemy. All pass in the full suite.

**Finding:** none.

## Range 1 -> 96 (`407e047..f6fa0fc`)

**Commits:** critical hits restoring mana and extending flow, duelist reads
(crystal guardian, bone knight), and oracle reads (tide caller, frost oracle).

**Verification:** `World.damageEnemy` adds 3 mana, extends `resonanceTime` by
0.5 and triggers a 0.05s hitstop on a crit. `tests/sim/world.test.ts` passes
44/44; the crit case now sets a 1.2s flow window and asserts the exact
`min(6, 1.7)` result. The generator has `crystal`/`bone` duelist signatures and
`tide`/`frost` oracle signatures; the four sheets exist. `tests/assets.test.ts`
4/4 and `tests/sim/content.test.ts` 17/17 pass.

**Finding (test gap closed):** the crit test used `resonanceTime >= flowBefore`,
which would pass even if the +0.5 extension were removed. Strengthened it to
assert the exact extended window. Also added the missing duelist/oracle
signature paragraph to `docs/Graphics.md` (crystal shards, rib lines/skull
crest, water ribbons, ice spikes). No runtime change.

## Range 1 -> 99 (`407e047..ec0ef6e`)

**Commits:** construct-kind silhouette reads, limited relic bag slots with
shard/echo selling routes, and the graphics/FX/HUD enhancement pass.

**Verification:** the generator's `_construct` variants are present; the relic
bag limit and selling routes are covered by `tests/sim/world.test.ts` (full bag
blocks unequip, selling routes pay out). `tests/assets.test.ts` 4/4,
`tests/sim/content.test.ts` 17/17 and the full suite pass.

**Finding:** none.

## Range 1 -> 102 (`407e047..7184f8b`)

**Commits:** floating health bar/combat FX, luminescent floor glyphs and
telegraph contours, and stance-specific weapon models.

**Verification:** `ActorView.drawHealthBar` draws non-boss floating bars;
`tileArt.paintDeco` gives glyphs a glow halo; `sheets.ts` selects the spear and
greatsword idle/walk/attack strips. `tests/sim/arsenal.test.ts` 10/10 and the
telegraph suites pass. The new `tests/sim/windup-duration.test.ts` passes 2/2.

**Finding (fixed):** the strike/slam telegraph contour used a hardcoded 0.8s
windup, so a 0.42s strike started roughly two-thirds full and the fill did not
match the attack. Exported `windupDuration(enemy)` from `src/sim/enemies.ts`,
used it in `beginWindup` and in `ActorView.drawTelegraph`, and added the
failing-first `windup-duration` test (`windupDuration is not a function` before
the fix). Recorded as ADR-161.

## Range 1 -> 105 (`407e047..b6390a3`)

**Commits:** unified combat text/low-health vignette/button depth, grand
chambers and multi-wave rooms, elite floor ward aura and choice-card pills.

**Verification:** `Renderer` draws the pulsing red edge below 28% health;
`dungeon.ts` creates grand chambers and runic glyph rings; `world.ts` announces
multi-wave rooms with `totalWaves`; `ActorView.drawEliteAura` draws the amber
elite ward. `tests/sim/dungeon.test.ts` 25/25, `tests/sim/world.test.ts` 44/44
and `tests/ui-boss-aura.test.ts` 2/2 pass.

**Finding (fixed):** `docs/Graphics.md` did not mention the low-health edge
warning or the elite ward aura. Added both to the runtime lighting/actor notes.
No runtime change.

## Range 1 -> 108 (`407e047..9111450`)

**Commits:** one-way enemy spawn gates and portcullis visuals, studded
portcullis lattice/minimap gate markers, and enemy knockback tilt/attack
lunge/floating pickups.

**Verification:** `ActorView.drawGateWarnings` only pulses gates while the room
is active and still owes waves; `Minimap` blinks reinforcing hatches and dims
spent ones; `LevelView` draws the studded portcullis with teeth in all four
directions. `tests/sim/dungeon.test.ts` 25/25, `tests/sim/physics.test.ts`
12/12 and `tests/sim/world.test.ts` 44/44 pass. The knockback tilt, attack
lunge and per-pickup float are present in `ActorView`.

**Finding:** none.

## Range 1 -> 111 (`407e047..2b6e53d`)

**Commits:** duellist AI, the mirror trial, breakable props and chain ignition;
the gate pulse; the audit ledger.

**Verification:** `tests/sim/melee-human.test.ts` 6/6 covers duellist AI,
`tests/sim/systems.test.ts` 79/79 covers the mirror trial, breakable props and
chain ignition, `tests/sim/mirror-combo.test.ts` 1/1 and
`tests/sim/overlap.test.ts` 18/18 pass. The gate pulse/minimap states are
covered above.

**Finding:** none.

## Range 1 -> 114 (`407e047..6f5dceb`)

**Commits:** prop breaks limited to the swing arc with props kept off
interactables, spent gate hatches dimmed on the minimap, and the five-push
audit ledger.

**Verification:** `tests/sim/systems.test.ts` 79/79 includes `breaks only the
props inside the swing arc`; `tests/sim/overlap.test.ts` 18/18 confirms hazards
stay separated from interactables. `Minimap` uses a 0.32 spent-hatch glow, and
`ActorView.drawGateWarnings` still pulses only while a room is active and owes
waves.

**Finding:** none.

## Range 1 -> 117 (`407e047..8a14cdf`)

**Commits:** weapon-model icons/stance UI/gate-drop safety, upgrade-card emblems
and enemy stagger visuals, and well water/wall levers/teleporters/melee bosses.

**Verification:** `tests/sim/systems.test.ts` 79/79 covers wall-mounted levers,
teleporter blink, melee bosses and safe drop positions; `tests/assets.test.ts`
4/4 covers the three weapon icons; `tests/sim/content.test.ts` 17/17 and
`tests/hub.test.ts` 25/25 pass.

**Finding:** none.

## Range 1 -> 120 (`407e047..07ece6d`)

**Commits:** UI-history digest for well/lever visuals, gate teeth/teleport
telegraphs/relic FX/NPC avatars, and the README campaign-length update.

**Verification:** `Screens.dialogueScreen` renders the resident portrait;
`Effects` colors equipment pickups by rarity; `ActorView` draws the blink
singularity and landing-zone rings. `tests/assets.test.ts` 4/4 covers the NPC
portrait assets. The README said 19 sections at this commit; the current README
says 23 after the later expansion.

**Finding (fixed):** the blink collapse/lock rings still used `e.stateTime / 0.8`
although the blink windup is 0.4s, so they started half-finished. Reused the
`windupDuration` progress and added the blink case to
`tests/sim/windup-duration.test.ts` (3/3). Recorded as ADR-162.

## Range 1 -> 123 (`407e047..dc33403`)

**Commits:** near-miss clutch surge/flow overdrive/boss frenzy, dynamic wall
torches/minimap markers/aim reticle, and stance-weighted swing audio with
finisher glints.

**Verification:** `tests/sim/engagement.test.ts` 7/7 covers the clutch/flow
mechanics, `tests/sim/audio-cues.test.ts` 4/4 the stance-weighted cues,
`tests/ui-boss-aura.test.ts` 2/2 the boss frenzy aura, and
`tests/sim/world.test.ts` 44/44 the clutch reset paths. `ActorView.drawAimReticle`,
the torch wash, minimap archive/merchant markers and the finisher star are
present.

**Finding:** none.

## Range 1 -> 126 (`407e047..3ea49e8`)

**Commits:** variable-ratio surge drops and safe pickup boundaries, gate floor
tiling/torch ambient wash/room mastery, and the banner split card.

**Verification:** `tests/sim/engagement.test.ts` 7/7 covers the surge odds,
`tests/sim/systems.test.ts` 79/79 the safe drop positions, and
`tests/hub.test.ts` 25/25 the room-mastery progression. `LevelView` paints gate
tiles as floor with thresholds and gives torches a wide wash plus embers;
`Minimap` shows cyan ticks while secrets remain and gold when mastered. The
README now points at `assets/social-preview.svg`; the PNG is gone.

**Finding (fixed):** the Graphics/README docs did not mention gate floor
tiling, the torch ambient wash, or the minimap mastery tick. Added those notes.
No runtime change.

## Range 1 -> 129 (`407e047..2918da8`)

**Commits:** data-driven audio for every enemy telegraph/hook/shockwave,
deferred ADR bookkeeping, and the short-window hub CSS fit.

**Verification:** `tests/sim/audio-cues.test.ts` 4/4 checks all 25 `AttackKind`
presets, shared shot throttling, quiet dedicated-event attacks and distinct
heavy keys. `tests/ui-hub-layout.test.ts` 3/3 checks the compact hub blocks and
footer fit.

**Finding:** none.

## Range 1 -> 132 (`407e047..9128d1d`)

**Commits:** ADR-087's short-window hub record, the data-driven stance-art
impact table with its freeze, and ADR-088's record of that change.

**Verification:** `tests/sim/art-impact.test.ts` 4/4 checks every stance's
table entry and a live sim firing each art, including the emitted shake
strength. The current `WEAPON_ART_IMPACT` table is sword/spear 0.07s/5 and
greatsword 0.09s/9; `World.hitstop` uses `Math.max`, so the art's freeze cannot
be weakened by a preceding hit. `tests/ui-hub-layout.test.ts` 3/3 still guards
the compact hub blocks.

**Finding (fixed later by `3e983da`):** the original table shipped sword and
spear at 0.06s, below the 0.07s finisher that the same comment claimed the art
must at least match. `3e983da` raised both to 0.07s and added
`tests/sim/weapon-art-impact.test.ts` (1/1), which asserts the floor directly.
Current code and tests are correct. Separately, ADR-087 says `2918da8` staged
only the short-window hub hunks, but that commit's `src/ui/ui.css` diff also
contains the co-mingled `.bar` restyle (height 16px -> 18px) and other
unrelated UI work. ADR-174 keeps the 18px bar and pins it in
`tests/ui-health-bar.test.ts` (2/2), so the restyle is now deliberate rather
than an open review item.

## Range 1 -> 135 (`407e047..914acd1`)

**Commits:** fan/wall windup tracking, ADR-089's record, and the big-room
cover guarantee with ADR-090's record.

**Verification:** `tests/sim/windup-tracking.test.ts` 6/6 confirms shot, spread,
volley, fan and wall track a strafing walker to dot > 0.99, while slam stays
committed. `tests/sim/big-cover.test.ts` now checks every combat/arena/
colosseum room of area >= 200 has at least three interior walls and passes.

**Finding (fixed):** the big-room backstop only ran when `countWalls() === 0`,
so a fixed-offset layout that landed one or two stones skipped the retry even
though ADR-090 promises at least three. A census of 200 seeds x 11 depths found
475 big rooms with one or two interior walls (162 with one, 313 with two). The
strengthened test failed first with 27 thin rooms in the existing 60-seed x
3-depth sample. Changing the guard to `countWalls() < 3` makes the promise true;
generation only, and saves store the seed/depth rather than the grid. ADR-090
now says the backstop counts landed walls; `8afb5dd` corrected the earlier
`pillar()`-returns-boolean wording.

## Range 1 -> 138 (`407e047..8afb5dd`)

**Commits:** ADR-090's big-room cover record, the wall telegraph gap guide,
and ADR-091's record of that fix plus the ADR-090 wording correction.

**Verification:** `WALL_BOLT_OFFSETS`, `wallGapIndex` and `wallGapCenter` are
still the single source in `src/sim/enemies.ts`; the `wall` launch and
`ActorView`'s telegraph both read them, and the view tracks the same
`dirX`/`dirY` the sim updates during the 0.65s windup. `furnish()` still remaps
`open` to `scatter` at area >= 200 and its backstop counts landed walls with
the `< 3` guard. ADR-090's current "counts landed walls since `pillar()`
silently skips blocked spots" wording is the corrected text from `8afb5dd`;
the "returns boolean" line only exists in the pre-correction history.

**Finding (test gap closed):** `tests/sim/wall-gap.test.ts` pinned the helper
math but not the cyan segment the view draws, so a regression to the original
fixed +40..+80 lane would still pass. The segment geometry now lives in
`wallGapGuideSegment` in `src/view/telegraph.ts`, is used by `ActorView`, and
the test has two failing-first cases: for ids 0-11 the guide midpoint equals
`wallGapCenter` and the segment stays inside the corridor between the surviving
bolts, and the old +60 center is explicitly rejected. Before the helper
existed the new cases failed with `wallGapGuideSegment is not a function`; the
file now passes 5/5. Recorded as ADR-164.

**Note:** ADR-163's trailing sentence saying ADR-090 still claims `pillar()`
returns a boolean is stale: `8afb5dd` already corrected ADR-090. The backstop
counts landed walls, as the current ADR-090 says.

## Range 1 -> 141 (`407e047..0e256b1`)

**Commits:** the corrupt-snapshot restore guard, the standalone-clean test
errata, and ADR-092's record.

**Verification:** `restoreRun` still rejects a snapshot without `run.stats`,
defaults the frame-incremented counters and fragment lists, and clamps corrupted
vitals; `tests/sim/restore-run.test.ts` covers the run-level cases.
`big-cover.test.ts` compares the room kind as a plain string, and the healthy
round-trip asserts base fields rather than the later `difficulty`, so both
standalone errata are current. The tide/storm drone roots in `Sound.ts` are no
longer foreign: `content.ts` ships those biomes in the working tree.

**Finding (fixed):** the guard covered `run.stats` but not `player.stats`.
`refreshStats` dereferences the saved block for its delta before the vitals are
repaired, so a snapshot with no player-level stats threw
`TypeError: Cannot read properties of undefined (reading 'maxHealth')` instead
of degrading. Non-finite health also passed the `typeof` guard and loaded as
NaN, although ADR-092 says non-finite vitals are refilled to full. Rebuilt a
missing/non-object `player.stats` from `computeStats(player.upgrades)` and
refilled non-finite health like mana and dash. The two new cases failed first
(`expected 'threw' not to be 'threw'` and `expected true to be false`); the file
now passes 8/8. Recorded as ADR-165.

## Range 1 -> 144 (`407e047..99e2e29`)

**Commits:** ADR-093's zero-finding combat sweep, the full-range sweep
telegraph, and ADR-094's record.

**Verification:** `SWEEP_SPAN`/`SWEEP_RANGE` still feed the sim resolution, the
windup arc and the live beam; `clipLaneToRoom` keeps both inside the current
room. `sweep-honesty` confirms the sim hurts at 400px and the quake blasts use
the shared 40px radius. ADR-093's zero-finding sweep remains accurate: the melee
suites still cover the slashes, dashes and hitstop it inspected.

**Finding (test gap closed):** `ActorView.drawSweepBeam` still hardcoded the
sweep duration as `0.7` while the sim read `ACTIVE.sweep`. They agreed today,
but any duration change would rotate the drawn beam at a different rate than
the sim resolves it. Exported `SWEEP_ACTIVE`, added `sweepBeamAngle(enemy)` and
used it in both the sim and the view; the new endpoint case failed first with
`sweepBeamAngle is not a function`, then `sweep-honesty` passed 4/4. Recorded as
ADR-166.

## Range 1 -> 147 (`407e047..3c643da`)

**Commits:** ADR-095's zero-finding rooms sweep, the phantom-relic load
boundary, and ADR-096's record.

**Verification:** `equipmentExists()` still gates `restoreRun`'s inventory
filter and worn-slot nulling before `refreshStats`; the relic tests cover the
exists predicate, a dropped phantom bag entry and a nulled phantom slot.
ADR-095's zero-finding rooms sweep remains accurate: the seeded generation,
overlap and big-cover suites still pass.

**Finding (fixed):** the trust boundary stopped at equipment. `pendingChoices`
is persisted run data, and `choiceScreen` calls `upgradeDef(id)` directly with
no catch, so a corrupt or forward-incompatible save naming a removed upgrade
would crash on Continue. Added `upgradeExists()` and sanitized pending choices
at the load boundary (drop malformed choices, filter unknown options, keep an
empty list for the screen's Continue button). The new case failed first
(`expected [ ... ] to have a length of 2 but got 4`), then `restore-run` passed
9/9. Recorded as ADR-167.

## Range 1 -> 150 (`407e047..a7429c1`)

**Commits:** ADR-097's mortar landing-zone warning, ADR-097's record, and the
gate-spawn arrival cue.

**Verification:** the sim launch still reads `MORTAR_OFFSETS`/`mortarRadius`
and the telegraph rings the live walker with the same values;
`mortar-warning` confirms three blasts across the walker and none at the
caster. `ENEMY_SPAWN_AUDIO` still has its own `spawn` throttle, `Sound.handle`
plays it on `enemySpawned`, and `spawn-audio` confirms `spawnEnemy` emits the
event.

**Finding (fixed):** a later clipping pass made `mortarRingPoints` filter
centres only, on the assumption that every blast outside the room was
unreachable. That is true for the 40px non-boss radius but not the 52px boss
radius: a ring centred 50px outside the wall reaches 2px into the room, so a
walker against the wall could be hit with no warning. Added a `radius`
parameter and filtered by circle intersection like `quakeRingPoints`, letting
the room mask clip the overhang. The boss case failed first (`expected [] to
have a length of 3 but got 0`); the mortar files now pass 5/5. Recorded as
ADR-168.

## Range 1 -> 153 (`407e047..d2d917f`)

**Commits:** ADR-098's gate-spawn cue record, the phantom-vault load boundary,
and ADR-099's record.

**Verification:** `dropPhantomRelics()` still filters the meta vault, nulls a
phantom attuned relic and drops phantom ranks in `loadMeta`, and the vault test
keeps valid entries while dropping the phantom. `ENEMY_SPAWN_AUDIO` and the
`enemySpawned` case are present; `spawn-audio` and `save` pass. Other persisted
meta ids are safe: `questDef` returns undefined for unknown ids and every
caller guards it, `MetaSchema` bounds relic ranks to integers 0-3, and the
pause-screen echo chips already fall back on an unknown upgrade name.

**Finding:** none.

## Range 1 -> 156 (`407e047..7ab2f68`)

**Commits:** ADR-100's zero-finding combat sweep, ADR-101's zero-finding
enemies sweep, and ADR-102's zero-finding rooms sweep.

**Verification:** the combat suites (`melee-human` 6/6, `arsenal` 10/10,
`systems` 79/79, `world` 44/44) still cover the dash/potion/trap/switch paths
ADR-100 inspected. The enemy audit's separation and stalker claims still hold
in the same suites. For rooms, `dungeon` 25/25 plus `overlap` 18/18 and
`big-cover` 1/1 still enforce the door/gate reachability and cover guarantees
ADR-102's censuses measured.

**Finding:** none.

## Range 1 -> 159 (`407e047..7b997e1`)

**Commits:** ADR-103's zero-finding UI sweep, ADR-104's zero-finding graphics
sweep, and ADR-105's zero-finding audio sweep.

**Verification:** the screen-fit guards (`ui-hub-layout` 3/3, `hub` 25/25) and
the asset/atmosphere suites (4/4 and 3/3) still cover the measured states.
`audio-cues` 4/4 still checks the shared throttle and every telegraph preset.
The graphics sweep's documented beam taper and the audio sweep's 45-event map
are unchanged in the current code; the port-3000 note is historical
housekeeping, not a runtime contract.

**Finding:** none.

## Range 1 -> 162 (`407e047..86b8dee`)

**Commits:** universal grazes for enemy attacks, melee warlords closing to
blade range, and terrace cell dedupe.

**Verification:** `damagePlayer` still takes the `grazeable` flag and the enemy
attack cases pass it; the graze tests cover a strike, the i-frame-only case and
a telegraphed blast. `boss-approach` 3/3 still pins the melee warlords to blade
range, and `terrace-layout` 2/2 still proves the deduped cells never overlap.

**Finding (fixed):** the universal-graze change missed the bomb explosion.
`World.explodeBomb` called `damagePlayer` without the flag, so a dash through
an enemy bomb paid no graze; the walker's own bomb should not pay one. Passed
`b.owner === 'enemy'` and added failing-first positive/negative cases. The
enemy-bomb case failed first with `expected +0 to be 1`; `graze-attacks` now
passes 6/6. Recorded as ADR-169.

## Range 1 -> 165 (`407e047..3f5b4cc`)

**Commits:** the 800x600 shrine-screen fit, the large-boss player locator
ring, and the soul anchor's dedicated shatter cue.

**Verification:** `.screen.place-screen` still uses `justify-content: safe
center` plus the `max-height: 700px` compact block, so a tall shrine screen
top-aligns instead of clipping. `drawPlayerLocator` still draws above the
actor layer only when a much larger, living body overlaps the walker. The soul
anchor still consumes the trinket, refills to 40% and emits `soulAnchor`;
`soul-anchor-cue` 2/2 covers the cue and its absence.

**Finding:** none.

## Range 1 -> 168 (`407e047..6435698`)

**Commits:** the missing-settings career-progress guard, the strike input
buffer, and ADR-114's zero-finding enemies sweep.

**Verification:** `MetaSchema.settings` still defaults to `DEFAULT_SETTINGS`,
and the guarded test loads a meta without a settings block with fragments, runs
and echoes intact. `updatePlayer` still queues a tap during a swing or dash,
clears it when a swing starts, and refuses to spend it while staggered; the
three `attack-buffer` cases pass. ADR-114's telegraph and steering claims still
hold in `melee-human` 6/6 and `world` 44/44.

**Finding:** none.

## Range 1 -> 171 (`407e047..3e983da`)

**Commits:** the wide-laptop hub fit, resident speech balloons, and the
stance-art hitstop match.

**Verification:** `ui-hub-layout` 3/3 still pins the six-card row, the
900p trims and the compact block order; `ui-balloon` 3/3 still covers the
flip/clamp math. `WEAPON_ART_IMPACT` still floors sword/spear at the finisher
freeze, and `weapon-art-impact` 1/1 plus `art-impact` 4/4 pass.

**Finding:** none.

## Range 1 -> 174 (`407e047..33e2c72`)

**Commits:** the honest Reliquary empty state, the dedicated attunement chime
and pulse, and ADR-120's zero-finding enemies/levels sweep.

**Verification:** `reliquaryCaption` still switches on the attuned state and
`ui-reliquary` 2/2 covers both captions. `Sound.attune` is still the Reliquary's
handler, the pulse keyframes and reduced-motion opt-out are present, and
`ui-reliquary-attune` 3/3 passes. ADR-120's enemy, boss and layout censuses
still match the current content and generation suites.

**Finding (fixed):** the empty-state contract assumed the attuned id belonged
to the vault, but `dropPhantomRelics` checked existence only. A valid
`attunedRelic` outside the vault survived, so the Reliquary caption claimed a
relic waited while no row existed; expedition creation and the carry plan
already required membership. The load boundary now nulls a non-vault attuned
relic. The new save case failed first (`expected 'echo_dagger' to be null`);
the save/reliquary files pass 17/17. Recorded as ADR-170.

## Range 1 -> 177 (`407e047..39b8ae6`)

**Commits:** the tide/storm story grouping, the First Walker memory rename,
and the enemy tuning pass.

**Verification:** `lore-completeness` still groups every fragment into a core
and requires distinct titles; the tide/storm cores are named. `enemy-balance`
and `balance-pass` still pass, and the content/roster suites cover the tuned
enemy stats.

**Finding (fixed):** the runtime lore grew "The First Remembering"
(`fragment_first`, `core_memory_011`, `lore_013`), but the `assets/data` mirror
and README still said 34 fragments / 10 cores. The game reads `src/data`, so
the shipped lore was ahead of its mirror and docs. Added a mirror-parity test,
synced the assets copy and updated the README to 35/11. The new test failed
first (`entries` 12 vs 13); `lore-completeness` now passes 4/4. Recorded as
ADR-171.

## Range 1 -> 180 (`407e047..baf2466`)

**Commits:** the hidden stalked chip, hunter pressure carried into guardian
fights, and the swarm add cap.

**Verification:** `.chip.stalked.hidden` still hides the chip and
`ui-hud-stalked` 1/1 guards it. `spawnStalker` is still called from both the
normal and guardian activation paths, and the two hunter-pressure cases in
`systems` pass. Swarm still computes `MAX_SUMMONS - summonCount` and the cap
tests pass (`swarm-cap` 1/1, `summon-cap` 1/1).

**Finding:** none.

## Range 1 -> 183 (`407e047..ff5062e`)

**Commits:** the Frozen Choir's frost roster, the mirror combo cap, and the
shared mine landing points.

**Verification:** `FLOOR_PLANS[5]` still lists the frost roster and the content
test rejects a scavenger fallback. `mirrorComboStepDamage` still caps the three
steps below a fresh walker's health, and `mirror-combo` passes. `mineOffsets`
still feeds both the sim and the view; `mine-telegraph` covers the landing
points.

**Finding (fixed):** the mine warning positions were shared, but the ring was
still 28px while `updateMines` damages at 62px + player radius, so a walker
just outside the drawn ring could be hit. Added `MINE_DISTANCE`/`MINE_RADIUS`
and used them in the sim launch, the blast resolution and the view ring. The
new shared-radius case failed first (the constants did not exist); the file
now passes 3/3. Recorded as ADR-172.

## Range 1 -> 186 (`407e047..0406bc7`)

**Commits:** the bomb's real blast radius, charge lanes clipped to the room,
and quake rings filtered to the reachable arena.

**Verification:** `drawBombs` still draws the filled/stroked circle at
`b.radius`, and `ui-bomb-radius` guards it. `clipLaneToRoom` still clips
lunge/charge lanes (`ui-telegraph-clip` 2/2, `ui-dash-clip` 1/1).
`quakeRingPoints` now uses the radius-aware filter from a later fix, and
`ui-quake-clip` 3/3 passes.

**Finding:** none.

## Range 1 -> 189 (`407e047..7523d16`)

**Commits:** beam lanes clipped to the room, sweep arcs and the live beam
clipped, and mortar rings filtered to the reachable arena.

**Verification:** the beam case still calls `clipLaneToRoom` and
`ui-beam-clip` 1/1; the sweep warning and live beam both clip and
`ui-sweep-clip` 1/1. The mortar rings now use the radius-aware
`mortarRingPoints` from ADR-168 and `ui-mortar-clip` 3/3; quake stays
radius-aware.

**Finding:** none.

## Range 1 -> 192 (`407e047..70199b3`)

**Commits:** dash-strike lanes clipped, projectile aim lines clipped, and the
whole telegraph layer masked to the current room.

**Verification:** the dash case still calls `clipLaneToRoom` (`ui-dash-clip`
1/1); shot/spread/volley/bolt aim lines still clip (`ui-aim-line-clip` 1/1).
`ActorView` still builds and updates the telegraph mask for the current room,
and `ui-telegraph-mask` 1/1 passes.

**Finding:** none.

## Range 1 -> 195 (`407e047..ec38c41`)

**Commits:** boss aura phases aligned, every spiral bullet marked, and the
blink landing point locked for its telegraph.

**Verification:** `bossAuraTier` still follows the simulation's 60/30 phase
thresholds, and `ui-boss-aura` 2/2 passes. `spiralAngles` still feeds both the
sim volley and the marker ring; `spiral-telegraph` 3/3 passes. `blinkLanding`
is still captured at windup and the view reads it; `blink-target` 2/2 passes.

**Finding:** none.

## Range 1 -> 198 (`407e047..cbcdcd8`)

**Commits:** the true lunge lane, the summon add cap, and quake warnings for
blasts that reach into the room.

**Verification:** `lungeRange` still feeds the view lane and
`lunge-telegraph` 2/2 passes. Summon still checks `summonCount` before adding
and `summon-cap` 1/1 passes. `quakeRingPoints` now filters by blast
intersection, and `ui-quake-clip` 3/3 passes.

**Finding:** none.

## Range 1 -> 201 (`407e047..6a72b36`)

**Commits:** the Crystal Golem's prism beam, the volley spread across its
active phase, and the Ruin Warlord's ash-forged armor.

**Verification:** `crystal-golem-pattern` 2/2 confirms the golem's beam and
sprite; `volley-timing` 1/1 confirms the five shots spread across the phase;
`ruin-warlord-sprite` 1/1 and `assets` 4/4 confirm the armor sprite.

**Finding (fixed):** the range's enemy data edits exposed a stale mirror.
`src/data/enemies.json` has 83 records (matching the README) while
`assets/data/enemies.json` still had 76; the seven late-content enemies were
runtime-only. Added a mirror-parity test and synced the assets copy. The new
test failed first (76 vs 83); `content` now passes 18/18. Recorded as ADR-173.

## Late-content batch summary

The full per-range map is `docs/COMMIT_RANGE_INVENTORY.md`: 67 cumulative
ranges, the three commits added by each, and the file count at the endpoint.
Every range is now deep-dived; this section keeps the shared verification for
the art, UI, combat-polish and late-content expansion that followed the early
ranges.

Targeted verification for the batch:

- Art, atmosphere and assets: `tests/assets.test.ts` 4/4 and
  `tests/atmosphere.test.ts` 3/3 pass; every atlas image exists and the six
  resident props are present.
- Melee and combat polish: `tests/sim/melee-human.test.ts` 6/6 and
  `tests/sim/arsenal.test.ts` 10/10 pass; the finisher, interrupt, overkill,
  crit-mana and stance kits are covered.
- Frontier, rosters and boss visuals: `tests/sim/frontier-content.test.ts` 5/5,
  `tests/sim/frontier-world.test.ts` 5/5, `tests/sim/hive-roster.test.ts` 1/1,
  `tests/sim/catacomb-roster.test.ts` 2/2, `tests/sim/bloom-sentinel-sprite.test.ts`
  1/1, `tests/sim/ruin-warlord-sprite.test.ts` 1/1 and
  `tests/ui-boss-focus.test.ts` 4/4 pass.
- Blink and room safety: `tests/sim/blink-room.test.ts` 2/2 and
  `tests/sim/blink-target.test.ts` 2/2 pass.

The late-content findings from those ranges are already recorded in
ADR-149 through ADR-156: boss camera framing, the Phase Stalker room lock,
signature sweeps/walls, the Bloom Sentinel sheet, the Hive Queen's brood and
the Bone Catacombs roster. That batch audit added seventeen current findings: the
partial settings reset (ADR-157), the stale Graphics resident count (ADR-158),
the stale architecture counts and README boss overcount (ADR-158 and this
report), the rest-heal test gap (ADR-159), the shrine's leftover fountain water
(ADR-160), the Keeper display-height test gap (this report), the missing
tide/storm atmosphere docs (this report), the enemy walk-row test gap (this
report), the stale wisp silhouette rows (this report), the missing
hound/warden silhouette paragraph (this report), the weak crit flow assertion
(this report), the missing duelist/oracle signature paragraph (this report),
the hardcoded telegraph windup (ADR-161), the missing low-health/elite-aura
docs (this report), the hardcoded blink windup (ADR-162), the missing
gate/torch/mastery docs (this report), and the thin big-room cover backstop
(ADR-163). No new runtime defect surfaced in the remaining batch.

## Current gates

- `npm test`: **450 passed (79 files)**
- `npm run test:mechanics`: **363 passed (53 files)**
- `npx tsc --noEmit`: clean
- `npm run lint`: clean
- `npm run build`: clean (existing chunk-size warning only)
- `python aikit.py check MemoryReconstruction`: **8/8 gates passed**

## Next pass

The inventory covers every cumulative range through `1 -> End` (201 commits),
and the curated report now deep-dives all of them. There is no next range; after
new commits, run `npm run audit:ranges` to refresh the map and
`npm run audit:ranges:check` as a gate. The cumulative findings are ADR-157
(partial settings), ADR-158 (living docs), ADR-159 (rest-heal test), ADR-163
(big-room cover backstop), ADR-164 (wall-guide drawn-segment test), ADR-165
(player-stats restore crash and NaN health), ADR-166 (sweep beam duration/angle),
ADR-167 (pending-choice phantom ids), ADR-168 (radius-aware mortar clip),
ADR-169 (enemy-bomb graze), ADR-170 (non-vault attuned relic), ADR-171 (lore
mirror drift), ADR-172 (mine warning radius), ADR-173 (bestiary mirror drift),
ADR-174 (18px health bar pinned) and the README boss-count correction recorded
above. No open audit items remain.
