# Continuous Improvement Cycles

One area per cycle, in rotation: combat feel, enemies/bosses, levels, UI
readability, graphics/effects, audio cues, progression/saves. Each cycle records
FIND, ANALYZE, IMPLEMENT and RECORD. Visual claims carry before/after captures
from the same viewport and state; mechanics claims carry a played or headless
run.

## Covered areas

| Cycle | Area | Status |
| --- | --- | --- |
| pre-cycle | UI readability / responsive layout | Completed in `2fcb82d`, evidence in `docs/UI_REVIEW.md` |
| 1 | Combat feel | Completed (attack buffer) |
| 2 | Enemies/bosses | Completed (boss windup cache) |
| 3 | Levels | Dry after a 60-seed fuzz; guard retained |
| 4 | Graphics/effects | Completed (boss phase burst) |
| 5 | Audio cues | Completed (pause suspends audio) |
| 6 | Progression/saves | Completed (field-wise meta recovery) |
| 7 | Combat feel | Completed (dash-bolt buffer) |
| 8 | Enemies/bosses | Completed (readable enemy health bars) |
| 9 | Levels | Completed (spent gates dim) |
| 10 | UI readability | Completed (compact 390px minimap) |
| 11 | Graphics/effects | Completed (boss intro burst) |
| 12 | Audio cues | Completed (denied dash/bolt cue) |
| 13 | Progression/saves | Completed (nested save recovery) |
| 14 | Combat feel | Completed (dash buffer) |
| 15 | Enemies/bosses | Completed (boss phase ticks) |
| 16 | Levels | Completed (map exit marker) |
| 17 | UI readability | Completed (narrow map fits) |
| 18 | Graphics/effects | Completed (room seal burst) |
| 19 | UI/visuals | Completed (HUD vitals backplate & gloss) |
| 20 | UI/combat | Completed (monumental boss bar & enrage pulse) |
| 21 | UI readability / visuals | Completed (upgrade card rarity polish & emblem pulse) |
| 22 | Graphics/effects | Completed (combat hit sparks & crit punch) |
| 23 | UI readability / Toasts | Completed (first-room lock toast deduplication) |
| 24 | UI / Expedition layout | Completed (checkpoint list height constraint) |
| 25 | Combat audio / Feedback | Completed (critical hit metallic ping sound cue) |
| 26 | UI / Inventory styling & layout | Completed (stat pill framing & height bounding) |
| 27 | Graphics / Stagger visual feedback | Completed (orbital daze halo & rotating star glints) |
| 28 | UI / Hub feats ladder | Completed (full-width ladder, gem glyph, dashed sealed chips) |
| 29 | UI / Combat HUD clearance | Completed (toasts clear the boss bar, translucent compact vitals plate) |
| 30 | UI / Title style | Completed (gold sheen, warm bloom, breathing primary button) |
| 31 | Graphics / Torch lighting | Completed (soft additive flickering halos) |
| 32 | Graphics / Colour grade | Completed (per-biome multiply grade) |
| 33 | Graphics / Floor variation | Completed (value-noise tone patches) |
| 34 | UI / Hub resident art at 720p | Completed (compact art strip on wide short screens) |
| 35 | Graphics / Mob idle breathing | Completed (desynced breath on calm mobs) |
| 36 | Levels / Colonnade room layout | Completed (two columned rows around a clear aisle) |
| 37 | Enemies / Rubble Slinger | Completed (frail ranged mob on the first floor) |
| 38 | Enemies / Frost and abyss natives | Completed (Rime Thrall, Trench Lurker) |
| 39 | Enemies / Forest and caves casters | Completed (Thorn Spitter, Cavern Glowmoth) |
| 40 | UI / Death screen style | Completed (crimson bloom, settling heading, staggered stat rows) |
| 41 | UI / Memories screen | Completed (gem pips, quoted fragments, gold restored memories) |
| 42 | UI / Upgrade card alignment | Completed (two-line title slot aligns descriptions) |
| 43 | UI / Help text measure | Completed (.meta-line capped at 880px) |
| 44 | UI / Settings toggle rows | Completed (hint gets the wide column) |
| 45 | UI / 390px sweep of restyled screens | Completed (difficulty row, controls panel) |
| 46 | UI / Phone top HUD | Completed (section name and objectives clear the minimap) |
| 47 | UI / Tablet (768x1024) | Completed (feats ladder no longer squashed, hint clears the vitals) |
| 48 | UI / Landscape phone (844x390) | Completed (two regressions of mine fixed, vitals plate trimmed) |
| 49 | Levels / Chicane room layout | Completed (offset walls force an S-route; replaces crossing, ~2 in 7 rooms differ per seed) |
| 50 | Enemies / Pressure Husk | Completed (abyss brute) |
| 51 | Enemies / New-mob balance guard | Completed (headless fairness test) |
| 52 | UI / Relic rows on phones | Completed (Reforge and Reliquary buttons drop to their own line) |
| 53 | Graphics / Frame cost of the new effects | Completed (grade moved to camera tint) |
| 54 | Enemies / Rivet Squire | Completed (foundry melee fighter) |
| 55 | Enemies / Wax Crawler | Completed (hive skirmisher) |
| 56 | UI / Phone difficulty row | Completed (label above, buttons full width) |
| 57 | UI / Landscape-phone title menu | Completed (two columns, fits without scrolling) |
| 58 | UI / Landscape-phone upgrade choice | Completed (cards compacted, reroll stays on screen) |
| 59 | UI / Landscape-phone controls list | Completed (two pairs per row) |
| 60 | UI / Landscape-phone hub | Completed (six residents in one row) |
| 61 | Docs / No touch controls | Superseded by Cycle 62 |
| 62 | Input / Touch controls | Completed (virtual sticks and buttons on coarse pointers) |
| 63 | Input / Touch bomb and trap buttons | Completed |
| 64 | Input / Touch taps are not clicks | Completed |

---

## Cycle 1 — Combat feel: early greatsword tap is dropped

### FIND

Evidence:

- `src/sim/player.ts` sets `ATTACK_BUFFER = 0.18` and decrements it every
  update, including while `swingTime >= 0`.
- `src/sim/weapons.ts` gives the greatsword step durations of `0.42s` and
  `0.54s`. An attack press early in either swing expires long before the swing
  ends.
- `tests/sim/attack-buffer.test.ts` covers a late tap in a 0.3s sword swing and
  a tap during a dash, but not an early tap in a slow greatsword swing.
- Play note: a deliberate second press at the start of a greatsword arc is
  swallowed; the character returns to idle instead of chaining. This is a
  combat-feel defect, not a damage or balance change.

### ANALYZE

Code path read: `updatePlayer` decrements `attackBuffer` before input handling;
`updateSwing` ends the swing only after `swingDuration`; the post-swing check
starts a queued swing only when `attackBuffer > 0`. The buffer therefore cannot
survive the greatsword's swing, despite its own comment saying a deliberate tap
during a swing should not be lost.

Reproducer: start a greatsword swing, press attack on the next frame, then step
40 frames with no input. Expected: combo 1 and a second swing active. Actual:
combo 0, `swingTime` back to `-1`; the tap was discarded.

Fix: hold the attack buffer while a swing is active; only decay it when
`p.swingTime < 0`. The dash path already lasts 0.17s and does not need a change.
Files: `src/sim/player.ts`, `tests/sim/attack-buffer.test.ts`.

Killed: no visual change is claimed; the screenshots for this cycle document
the same greatsword test state before/after the fix, not a new art effect.

Proof: failing headless test first, then the same test green; a scripted
greatsword combat run records `combo`/`swingTime` before and after the fix, with
screenshots of the run state at 1280x720.

### IMPLEMENT

- `src/sim/player.ts`: the buffer decays only while `swingTime < 0`, so it
  survives the 0.42-0.54s greatsword arcs.
- `tests/sim/attack-buffer.test.ts`: added the failing reproducer first
  (`combo 0` expected `1`), then made it pass.
- No other behaviour, damage, cooldown or visual constant changed.

### RECORD — played run

Same setup both runs: fresh run, start room, enemies cleared, greatsword,
health 100/100, 1280x720, 59 sampled frames. Input: press J, wait 80ms, press J
again (an early second tap), wait 600ms.

| Evidence | Before (old line) | After (fixed) |
| --- | --- | --- |
| State log | `combo 0`, `swingTime -1`, `action idle`, `buffer 0` | `combo 1`, `swingTime 0.367`, `action attack`, `buffer 0` |
| Screenshot | `docs/qa/cycle1-before-greatsword.png` — idle after the first arc | `docs/qa/cycle1-after-greatsword.png` — queued second arc/shockwave |
| Combat pass | `cycle1-before-combat.png`: 4 enemies, health 76, idle | `cycle1-after-combat.png`: 4 enemies, health 87, idle |
| Frame health | 16.68ms average, 16.90ms max | 16.68ms average, 16.90ms max |

The state logs are in `docs/qa/cycle1-before.json` and
`docs/qa/cycle1-after.json`. What improved: an early deliberate greatsword tap
now chains instead of being swallowed. What broke: nothing observed; the
combat pass still spawned four enemies and the frame time stayed at the 60fps
budget. What stayed the same: damage, swing timings, dash buffer and the late-tap
path.

### Gate results

- `npx vitest run tests/sim/attack-buffer.test.ts`: **4 passed** (after the
  failing-first run showed `expected +0 to be 1`)
- `npm test`: **466 passed (84 files)**
- `npm run test:mechanics`: **371 passed (55 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 208`)

### Commands run

```text
npx vitest run tests/sim/attack-buffer.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 2 — Enemies/bosses: boss telegraph changes phase mid-windup

### FIND

Evidence:

- `src/view/ActorView.ts` computes `const total = windupDuration(e)` on every
  telegraph frame.
- `src/sim/enemies.ts` derives `windupDuration` from `PHASES[enemy.phase]`;
  the three phase cooldown factors are `1`, `0.8` and `0.62`.
- `World.damageEnemy` updates the boss phase on damage. A hit that crosses a
  phase threshold during a windup therefore changes the denominator while
  `stateTime` keeps counting down from the old duration.
- The telegraph progress is `1 - stateTime / total`; switching from phase 0 to
  phase 2 during a 0.8s windup makes the total 0.496s, so the warning jumps
  backward (or resets to empty) just as the attack is about to land.
- No test covers a phase change during a windup.

### ANALYZE

Read: `windupDuration`, `beginWindup`, `windup`, `drawTelegraph` and the boss
phase tables. The sim and view already share `windupDuration`; the missing piece
is a stable denominator for the in-progress windup.

Reproducer: mock a phase-0 boss windup, cache its duration, change `phase` to 2
without touching `stateTime`, and assert the duration is unchanged.

Fix: cache the computed duration on the enemy at `beginWindup` (`windupTotal`)
and have `windupDuration` return that cache while it is set. `beginWindup`
resets the cache before computing, so the next attack picks up the new phase.
Files: `src/sim/entities.ts`, `src/sim/enemies.ts`,
`tests/sim/boss-windup.test.ts`.

Killed: no art or damage change; this is a telegraph-timing correctness fix.
The screenshots will show the same boss attack state before/after the phase
change; the play log records `stateTime`, cached duration and phase.

Proof: failing unit/source test first, then green; a boss-room played run
captures the telegraph after a forced phase change, before and after the fix.

### IMPLEMENT

- `src/sim/entities.ts`: added `windupTotal` to `Enemy`.
- `src/sim/enemies.ts`: `beginWindup` resets and caches the duration; 
  `windupDuration` returns the cache while it is set. The view already calls the
  shared function, so no view change was needed.
- `tests/sim/boss-windup.test.ts`: two failing-first checks (the phase jump
  changes 0.636s to 0.477s; `beginWindup` had no cache), then green.

### RECORD — played run

Same setup both runs: seed **7**, boss room at `1952,3200`, boss health
640/640, phase 0, player invulnerable and 100/100, 1280x720, 59 sampled frames.
The real boss attack was `slam`; the phase jump was forced by setting health to
25% and applying one damage event during the windup.

| Evidence | Before (old sim) | After (cached) |
| --- | --- | --- |
| Windup total before phase | `null` (recomputed) | `0.6818` |
| Windup total after phase 0→2 | `null` | `0.6818` |
| `stateTime` across the jump | `0.682` → `0.682` | `0.665` → `0.665` |
| Boss health | `640` → `158` | `640` → `158` |
| Telegraph frame | `docs/qa/cycle2-before-boss.png` — ring at phase-2 progress | `docs/qa/cycle2-after-boss.png` — ring at cached progress |
| Frame health | 16.68ms avg, 17.00ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle2-before.json` and `docs/qa/cycle2-after.json`. What
improved: the warning keeps the denominator the sim started with, so a phase
jump cannot shorten or reset the tell while `stateTime` continues. What broke:
nothing observed; the boss still reached 25%, phase 2, and the room stayed at
one enemy. What stayed the same: boss health/damage, phase thresholds and the
shared view function.

### Gate results

- `npx vitest run tests/sim/boss-windup.test.ts`: **2 passed** after two
  failing-first checks
- `npm test`: **468 passed (85 files)**
- `npm run test:mechanics`: **373 passed (56 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 209`)

### Commands run

```text
npx vitest run tests/sim/boss-windup.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 3 — Levels: dry after a 60-seed layout fuzz

### FIND

Candidates examined:

- **Generation reachability/void leaks.** The named tests cover seven seeds and
  the atoll/spire layouts. A temporary fuzz harness covered **60 seeds ×
  default/atoll/spire/terrace**, checking every non-vault room centre and every
  walkable tile for a void edge. Zero failures.
- **Room locks after teleport (deferred D1).** The only waystone is placed in
  the start room, and the waystone can only target visited non-vault rooms; the
  player has no current path to teleport out of an active locked room. Killed as
  not player-reachable under the current design.
- **Sealed door / spawn gate readability.** Locked doors already draw animated
  energy bars; enemy gates are distinct iron portcullises. The minimap already
  blinks active gates and dims spent ones. No mismatch worth a change.
- **Sealed vaults.** The lever path is covered by the dungeon suite; no
  reproducible leak or unreachable reward.

No game defect or opportunity survived reproduction, so this is a dry cycle.

### ANALYZE

The fuzz failure modes were killed by the existing tests after 60 seeds; running
more seeds would be brute force without a hypothesis. The D1 candidate was
killed because the waystone placement makes the scenario unreachable in normal
play. Door/gate art is already stateful and legible.

Retained: `tests/sim/level-fuzz.test.ts` as a permanent 60-seed
reachability/void guard. It is verification, not a game change.

### RECORD

- `npx vitest run tests/sim/level-fuzz.test.ts --reporter=verbose`: **1 passed
  (4.18s)** — zero failures across 60 seeds × 4 layouts.
- No visual claim and no gameplay-mechanics claim: this cycle changed no runtime
  behaviour, so no before/after screenshot pair or played run is claimed.
- Full gate results after adding the guard are recorded below.

### Gate results

- `npm test`: **469 passed (86 files)**
- `npm run test:mechanics`: **374 passed (57 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 210`)

### Commands run

```text
npx vitest run tests/sim/level-fuzz.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 4 — Graphics/effects: boss phase has no local burst

### FIND

Evidence:

- `World.damageEnemy` emits `bossPhase` plus a global `shake`, and the HUD
  shows “It grows angry/desperate”, but `Effects.handle` has no `bossPhase`
  case. There is no ring, star or burst at the boss itself.
- The event payload is only `{ phase }`, so the view has no position even if it
  wanted a local effect.
- The phase change is one of the largest moments in a boss fight; the screen
  shake and remote toast do not mark where it happened.

### ANALYZE

Read: `World.damageEnemy` phase loop, `events.ts`, the `Effects` switch and the
existing `weaponArt`/`blink` burst patterns. Add the boss position to the event
and draw the same kind of local ring/star/burst used by other major impacts.
No sim balance, damage, phase threshold or audio change.

Files: `src/sim/events.ts`, `src/sim/world.ts`, `src/view/Effects.ts`,
`tests/view-boss-phase-fx.test.ts`.

Proof: failing source/event test first; seed-7 boss played run captures the
phase frame before/after the effect, with the same room and viewport.

### IMPLEMENT

- `src/sim/events.ts`: `bossPhase` now carries `x` and `y`.
- `src/sim/world.ts`: the phase event emits the boss position.
- `src/view/Effects.ts`: a phase burst with a phase-colored ring, white inner
  ring, star and 22-particle burst at the boss.
- `tests/view-boss-phase-fx.test.ts`: failing-first source/event checks, then
  green. No damage, phase threshold, audio or HUD change.

### RECORD — played run

Same setup both runs: seed **7**, boss room at `1952,3200`, boss 640/640,
phase 0→2, player invulnerable and 100/100, 1280x720, 59 sampled frames.

| Evidence | Before (old view) | After (local burst) |
| --- | --- | --- |
| Phase frame | `docs/qa/cycle4-before-phase.png` — red telegraph + toasts only | `docs/qa/cycle4-after-phase.png` — orange/white ring, star and burst at the boss |
| Boss health | 640 → 158 | 640 → 158 |
| Windup total | `0.6818` before/after | `0.6818` before/after |
| Frame health | 16.68ms avg, 16.80ms max | 16.68ms avg, 16.80ms max |

Raw logs: `docs/qa/cycle4-before.json` and `cycle4-after.json`. What improved:
the phase change now marks the boss's location locally, instead of only a
screen shake and a remote toast. What broke: nothing observed; boss health,
phase and room state matched. What stayed the same: windup duration, damage and
the existing red attack telegraph.

### Gate results

- `npx vitest run tests/view-boss-phase-fx.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **471 passed (87 files)**
- `npm run test:mechanics`: **374 passed (57 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 211`)

### Commands run

```text
npx vitest run tests/view-boss-phase-fx.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 5 — Audio cues: pause never suspends the AudioContext

### FIND

Evidence:

- `src/audio/Sound.ts` already exposes `setSuspended(suspended)` which calls
  `AudioContext.suspend()/resume()`.
- A grep across `src` finds **no caller**. `App.pause()` sets `state='paused'`
  and opens the pause screen, but the AudioContext keeps running (ambience and
  queued SFX continue). `visibilitychange` and `blur` call that same
  `App.pause()`, so auto-pause also leaves audio live.
- This is the deferred D7 “Suspend audio on pause/auto-pause” item.

### ANALYZE

Read: `Sound.unlock/setSuspended`, `App.pause/resume/resumeRoom`,
`showSanctuaryMenu`, `showHub`, `showTitle`, `startRun`, and the
visibility/blur listeners. Pause and sanctuary-menu overlays should suspend;
resume, resumeRoom, hub, title and startRun should ensure audio is running so an
abandoned pause cannot leave the hub silent.

Files: `src/app/App.ts`, `tests/audio-pause.test.ts`.

Proof: failing source lifecycle check first; a real seed-7 run logs
`AudioContext.state` before pause, while paused and after resume; pause-screen
captures before/after show no visual regression.

### IMPLEMENT

- `src/app/App.ts`: `pause()` and `showSanctuaryMenu()` suspend; `resume()`,
  `resumeRoom()`, `showHub()`, `showTitle()` and `startRun()` clear suspension.
- `src/audio/Sound.ts`: added a sticky `suspended` flag. `unlock()` no longer
  resumes a paused context, because every keydown calls that generic unlock.
  A context created while suspended is suspended too.
- `tests/audio-pause.test.ts`: failing-first lifecycle and sticky-unlock checks;
  three passing tests.

### RECORD — played run

Same setup both runs: seed **7**, expedition active, audio unlocked by a user
gesture, 1280x720, 59 sampled frames. Escape pauses, Escape resumes.

| Evidence | Before | After |
| --- | --- | --- |
| Playing `AudioContext.state` | `running` | `running` |
| Paused `AudioContext.state` | **`running`** | **`suspended`** |
| Resumed `AudioContext.state` | `running` | `running` |
| Pause screen | `docs/qa/cycle5-before-pause.png` | `docs/qa/cycle5-after-pause.png` (identical layout) |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle5-before.json` and `cycle5-after.json`. What improved:
the ambience and queued SFX actually stop while paused and while auto-paused by
tab blur/visibility; resume restores them, and abandoning to the hub cannot
leave audio suspended. What broke: nothing observed; the pause screen is
visually unchanged. What stayed the same: ambience selection, volumes, frame
time and the pause-menu layout.

### Gate results

- `npx vitest run tests/audio-pause.test.ts`: **3 passed** after the
  failing-first checks
- `npm test`: **474 passed (88 files)**
- `npm run test:mechanics`: **374 passed (57 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 212`)

### Commands run

```text
npx vitest run tests/audio-pause.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 6 — Progression/saves: one bad field wipes the career

### FIND

Evidence:

- `SaveStore.loadMeta()` does one `MetaSchema.safeParse`; any invalid field
  fails the whole object and returns `defaultMeta()`.
- A single corrupt settings value, quest record or history entry therefore
  discards fragments, echoes, kills, vault, checkpoints and achievements even
  though those fields are valid.
- `tests/save.test.ts` covers invalid JSON and old saves, but not a save with
  one invalid field beside valid career progress. This is the deferred D10
  field-wise recovery item.

### ANALYZE

Read: `MetaSchema`, `defaultMeta`, `loadMeta`, `dropPhantomRelics` and the save
tests. Recover per top-level field: parse each schema entry independently, keep
valid fields, default invalid ones; salvage valid volume fields inside
`settings`. Keep the full-schema fast path and the phantom-relic filter.

Files: `src/save/SaveStore.ts`, `tests/save-recovery.test.ts`.

Proof: failing save test first; a browser run writes a corrupt meta with valid
fragments/echoes, reloads, and captures title/hub `Memories` and `Runs` before
and after the fix from the same viewport.

### IMPLEMENT

- `src/save/SaveStore.ts`: on a full-schema failure, `recoverMeta` parses every
  top-level meta field independently and keeps valid data; settings are salvaged
  field by field. The full-schema fast path and phantom-relic filter remain.
- `tests/save-recovery.test.ts`: two failing-first tests for corrupt settings
  beside valid career data, then green.

### RECORD — played browser run

Same corrupt save both runs: `fragment_001..003`, runs 4, victories 2,
bestDepth 3, echoes 42, kills 77, `settings.masterVolume = 2`; 1280x720;
reload → title → hub; 59 sampled frames.

| Evidence | Before (old loader) | After (field-wise) |
| --- | --- | --- |
| Fragments | 0 | **3** |
| Runs / victories | 0 / 0 | **4 / 2** |
| Echoes / kills | 0 / 0 | **42 / 77** |
| Invalid volume | 0.8 default | 0.8 default |
| Hub | `docs/qa/cycle6-before-hub.png` — Echoes 0, Memories 0/35 | `docs/qa/cycle6-after-hub.png` — Echoes 42, Memories 3/35, feat progress restored |
| Frame health | 16.68ms avg, 16.80ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle6-before.json` and `cycle6-after.json`. What improved:
one corrupt field no longer wipes valid fragments, echoes, kills, runs, depth or
settings; only the invalid field falls back. What broke: nothing observed; the
hub layout is identical. What stayed the same: full-schema saves, phantom-relic
filtering and frame time.

### Gate results

- `npx vitest run tests/save-recovery.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **476 passed (89 files)**
- `npm run test:mechanics`: **374 passed (57 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 213`)

### Commands run

```text
npx vitest run tests/save-recovery.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 7 — Combat feel: a bolt pressed mid-dash is dropped

### FIND

Evidence:

- `updatePlayer` reads `input.bolt` only after the `p.dashTime > 0` branch.
  That branch returns after buffering `input.attack`; it never records a bolt.
- A deliberate bolt tap during a 0.17s dash is therefore lost, while a strike
  tap in the same window is queued. The same committed-move window has two
  different input rules.
- No test covers bolt input during a dash.

### ANALYZE

Read: `updatePlayer` bool order, `fireBolt`, `dashTime`, `attackBuffer`,
`restoreRun` defaults. Add `boltBuffer` symmetric to the strike buffer: record
a bolt during a dash, hold it until the dash ends, consume it immediately after,
and default it for old saves. Do not fire mid-dash or change mana/cooldown.

Files: `src/sim/entities.ts`, `src/sim/player.ts`, `src/sim/run.ts`,
`tests/sim/bolt-buffer.test.ts`.

Proof: failing headless dash-bolt test first; a played run taps dash then bolt
and records projectile count before/after, with a bolt-trail screenshot.

### IMPLEMENT

- `src/sim/entities.ts`: added `boltBuffer` to `Player`.
- `src/sim/player.ts`: record a bolt during a dash, hold the buffer through the
  dash, and consume it immediately after; the buffer decays only outside a dash.
- `src/sim/run.ts`: default `boltBuffer` for old saves.
- `tests/sim/bolt-buffer.test.ts`: failing-first dash-tap and save-default
  checks, then green.

### RECORD — played browser run

Same start-room state and 1280x720; the queued buffer state (0.2s) is set so the
view can show the projectile; the headless test separately proves the dash-tap
path that fills it.

| Evidence | Before | After |
| --- | --- | --- |
| Projectiles | 0 | **1** |
| `boltBuffer` after fire | absent | `0` |
| Mana / cooldown | 60 / 0 | 42.1 / 0.283 |
| Screenshot | `docs/qa/cycle7-before-bolt.png` — no shot | `docs/qa/cycle7-after-bolt.png` — blue bolt trail northwest |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle7-before.json` and `cycle7-after.json`. What improved:
a bolt tapped during the 0.17s dash now fires when the dash ends instead of
being swallowed. What broke: nothing observed; the bolt flies through the same
projectile path and the frame budget is unchanged. What stayed the same: mana
cost, bolt cooldown, speed, spread and the strike buffer.

### Gate results

- `npx vitest run tests/sim/bolt-buffer.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **478 passed (90 files)**
- `npm run test:mechanics`: **376 passed (58 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 214`)

### Commands run

```text
npx vitest run tests/sim/bolt-buffer.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 8 — Enemies/bosses: enemy health bars are hard to read

### FIND

Evidence:

- `ActorView.drawHealthBar` draws a 5px black backing with a **3px fill** and
  no inner border or highlight. At 1280 the bar is thin; at the 390 camera
  scale it is close to a hairline.
- Elites and bosses share the same geometry; only the fill color differs.
- The existing view tests cover bosses and telegraphs, not the enemy bar.

### ANALYZE

Read: `drawHealthBar`, the `bars` overlay layer, elite/boss scaling and the
combat captures. Raise the bar height, add a dark inner frame and a 1px highlight,
and keep the elite gold / normal red distinction. No health, damage or AI change.

Files: `src/view/ActorView.ts`, `tests/ui-enemy-health-bar.test.ts`.

Proof: failing source check first; a seed-7 combat room with one enemy at 55%
health captures the same state before/after at 1280x720.

### IMPLEMENT

- `src/view/ActorView.ts`: enemy bars are 4px (6px boss), at least 28px wide,
  with a black outer shadow, dark inner frame and a 1px white highlight; the
  fill is clamped to 0..1. Elite gold and normal red are unchanged.
- `tests/ui-enemy-health-bar.test.ts`: two failing-first source checks, then
  green.

### RECORD — played browser run

Same seed 7, combat room, enemy id 51 (`gutter_runner`), health 38/70 (54%),
state `recover`, 1280x720, 59 sampled frames.

| Evidence | Before | After |
| --- | --- | --- |
| Bar geometry | 24px min, 3px fill, 5px backing | **28px min, 4px fill, 8px framed bar + highlight** |
| Enemy | gutter_runner, 38/70 | gutter_runner, 38/70 |
| Screenshot | `docs/qa/cycle8-before-healthbar.png` — hairline bar | `docs/qa/cycle8-after-healthbar.png` — framed, highlighted bar |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle8-before.json` and `cycle8-after.json`. What improved:
the enemy bar is legible at a glance and distinguishes boss height; elites keep
gold and normal enemies red. What broke: nothing observed; health, AI and frame
time are unchanged.

### Gate results

- `npx vitest run tests/ui-enemy-health-bar.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **480 passed (91 files)**
- `npm run test:mechanics`: **376 passed (58 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 215`)

### Commands run

```text
npx vitest run tests/ui-enemy-health-bar.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 9 — Levels: cleared spawn gates stay bright in the world

### FIND

Evidence:

- `Minimap` tracks cleared combat rooms and dims spent gates (`spent ? 0.32`
  instead of `0.95`).
- `LevelView.drawDoors` has no room-phase input; it draws every portcullis gate
  with the same bright iron and ember glow before and after the room is cleared.
- The world and minimap therefore disagree about whether a gate is still
  reinforcing; a cleared room can look like it may spawn another wave.

### ANALYZE

Read: `LevelView` constructor/`drawDoors`, `Renderer.showFloor`, `World.rooms`
and the minimap gate state. Pass a room-phase lookup into the view; when a gate's
room is cleared, overlay a dark spent wash after the gate art (including its
ember). No gate collision, spawn or room-state change.

Files: `src/view/LevelView.ts`, `src/view/Renderer.ts`,
`tests/ui-gate-cleared.test.ts`.

Proof: failing source check first; seed-7 combat room cleared, player framed at
the gate, before/after screenshots at 1280x720.

### IMPLEMENT

- `src/view/LevelView.ts`: accepts a `roomPhase(roomId)` lookup and overlays a
  0.55 dark wash on each gate tile after its art when the room is cleared.
- `src/view/Renderer.ts`: passes `world.rooms[id]?.phase` through.
- `tests/ui-gate-cleared.test.ts`: two failing-first source checks, then green.

### RECORD — scripted clear

Same seed 7, combat room 1, west gate at `51,63`, player at `1664,2032`,
1280x720. The damage loop left the room active after 8s, so the state log
records `forced:true`; 27 queued level-up choices were drained before capture.
This is a controlled cleared-room state, not a fresh manual clear.

| Evidence | Before | After |
| --- | --- | --- |
| Room phase | cleared (forced) | cleared (forced) |
| Gate | bright iron portcullis | **dimmed by the spent wash** |
| Screenshot | `docs/qa/cycle9-before-gate.png` | `docs/qa/cycle9-after-gate.png` |
| Frame health | 17.70ms avg, 18.50ms max | 17.72ms avg, 18.70ms max |

Raw logs: `docs/qa/cycle9-before.json` and `cycle9-after.json`. What improved:
the world gate now agrees with the minimap’s spent state, so a cleared room no
longer looks like it may reinforce. What broke: nothing observed; gate
collision, spawns and room phase are unchanged. What stayed the same: the gate
art itself, the room clear rules and the minimap.

### Gate results

- `npx vitest run tests/ui-gate-cleared.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **482 passed (92 files)**
- `npm run test:mechanics`: **376 passed (58 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 216`)

### Commands run

```text
npx vitest run tests/ui-gate-cleared.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 10 — UI readability: the 390px minimap is too large

### FIND

Evidence:

- The `@media (max-width: 720px)` rule sets the minimap to **130×100**.
- The later `@media (max-width: 560px)` layout block has no minimap override,
  so a 390px viewport still spends 130px of 390 (~33%) on the map.
- The 390 gameplay captures show the minimap covering the top-right quarter
  where enemies and pickups appear.

### ANALYZE

Read: `Hud` minimap canvas (190×140 intrinsic), the 720px and 560px CSS blocks,
and the 390 gameplay capture. Add a 104×76 CSS size inside the existing 560px
block; the canvas renderer already scales to its CSS box, so no code or data
change. Keep the map visible rather than hiding information.

Files: `src/ui/ui.css`, `tests/ui-responsive-layout.test.ts`.

Proof: failing CSS check first; a seed-7 390x844 gameplay capture before/after,
with frame health.

### IMPLEMENT

- `src/ui/ui.css`: inside the existing `max-width: 560px` block, the minimap is
  now 104×76 instead of the inherited 130×100. The canvas renderer scales to the
  CSS box; no canvas, data or minimap logic changed.
- `tests/ui-responsive-layout.test.ts`: added the failing-first minimap check.

### RECORD — played browser run

Same seed 7, start room, player at `1936,1488`, 390x844, 59 sampled frames. The
map remains visible; only its CSS box shrinks.

| Evidence | Before | After |
| --- | --- | --- |
| CSS box | 130×100 | **104×76** |
| Screen box | 106.6×82 | **85.3×62.3** |
| Screenshot | `docs/qa/cycle10-before-minimap.png` | `docs/qa/cycle10-after-minimap.png` |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle10-before.json` and `cycle10-after.json`. What improved:
the map no longer covers a third of the 390px HUD width, freeing the top-right
play area while keeping room state visible. What broke: nothing observed; the
same rooms and markers render, just smaller. What stayed the same: map logic,
seed/state and frame time.

### Gate results

- `npx vitest run tests/ui-responsive-layout.test.ts`: **4 passed** after the
  failing-first minimap check
- `npm test`: **483 passed (92 files)**
- `npm run test:mechanics`: **376 passed (58 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 217`)

### Commands run

```text
npx vitest run tests/ui-responsive-layout.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 11 — Graphics/effects: boss intro has no local burst

### FIND

Evidence:

- `World.activateRoom` emits `bossIntro` with only the boss name; the HUD
  raises the boss bar and audio plays a cue, but `Effects.handle` has no
  `bossIntro` case and the event carries no position.
- Entering a boss room is a major transition, but the screen has no local
  visual anchor at the chamber.
- No view test covers the boss-intro moment.

### ANALYZE

Read: `activateRoom`, `roomCentrePx`, `bossIntro` consumers in App/HUD/Sound,
and the effect patterns used by `bossPhase`/`floorX`. Add room-centre `x`/`y`
to the event and draw a large gold/ember ring, star and burst with a short
shake; no spawn, lock, audio or boss-bar change.

Files: `src/sim/events.ts`, `src/sim/world.ts`, `src/view/Effects.ts`,
`tests/view-boss-intro-fx.test.ts`.

Proof: failing source/event check first; seed-7 boss-room entry captured at the
same moment before/after, 1280x720, with frame health.

### IMPLEMENT

- `src/sim/events.ts`: `bossIntro` carries room-centre `x`/`y`.
- `src/sim/world.ts`: `activateRoom` emits the room centre with the boss name.
- `src/view/Effects.ts`: draws a gold/ember ring pair, star and burst at the
  chamber centre, with a short shake. No spawn, lock, audio or boss-bar change.
- `tests/view-boss-intro-fx.test.ts`: failing-first source/event checks, green.

### RECORD — played browser run

Same seed 7, boss room id 5 at `1952,3200`, player at the centre, 1280x720;
captured 260ms after activation, before the 1s boss spawn.

| Evidence | Before | After |
| --- | --- | --- |
| Local effect | none | **two rings, star and gold burst** |
| Room / player | boss / `1952,3200` | boss / `1952,3200` |
| Screenshot | `docs/qa/cycle11-before-bossintro.png` | `docs/qa/cycle11-after-bossintro.png` |
| Frame health | 17.67ms avg, 18.50ms max | 17.67ms avg, 18.50ms max |

Raw logs: `docs/qa/cycle11-before.json` and `cycle11-after.json`. What improved:
entering a boss chamber now has a local visual anchor instead of only a boss bar
and audio cue. What broke: nothing observed; the boss spawn, room lock, audio
and frame time are unchanged. What stayed the same: the intro timing and the
existing phase burst.

### Gate results

- `npx vitest run tests/view-boss-intro-fx.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **485 passed (93 files)**
- `npm run test:mechanics`: **376 passed (58 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 218`)

### Commands run

```text
npx vitest run tests/view-boss-intro-fx.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 12 — Audio cues: denied dash/bolt are silent

### FIND

Evidence:

- Every `SimEvent` has a Sound case, but a dash with **no charges** and a bolt
  with **no mana/cooldown** return from the sim without an event. The input
  simply disappears.
- No test covers the denied path; the player cannot tell a dropped input from a
  missed key.
- Existing Sound tones accept a throttle key, so a dry click can avoid spam.

### ANALYZE

Read: dash/bolt branches in `player.ts`, `fireBolt`, the Sound switch and
`tone` throttling. Add an `actionDenied` event for dash/bolt only, emit it when
the input is actively pressed and unusable, and play a short low square click
with a per-action throttle. No resource, cooldown or movement change.

Files: `src/sim/events.ts`, `src/sim/player.ts`, `src/audio/Sound.ts`,
`tests/sim/action-denied.test.ts`.

Proof: failing sim/audio source check first; a seed-7 no-charge dash played run
with a wrapped `Sound.handle` records the event before/after, with HUD
screenshots and frame health.

### IMPLEMENT

- `src/sim/events.ts`: added `actionDenied` for `dash`/`bolt`.
- `src/sim/player.ts`: a no-charge dash and a no-mana bolt now emit the event;
  `fireBolt` returns whether it fired. Resources, cooldowns and movement are
  unchanged.
- `src/audio/Sound.ts`: a short low square click per denied action, throttled by
  `denied-dash` / `denied-bolt` so holding the key cannot clip.
- `tests/sim/action-denied.test.ts`: failing-first sim and Sound checks, green.

### RECORD — played browser run

Same seed 7 start room, 1280x720, dash charges forced to 0 with recharge frozen;
`Sound.handle` wrapped to log denied events. Space is pressed once.

| Evidence | Before | After |
| --- | --- | --- |
| Denied events reaching Sound | `[]` | **`['dash']`** |
| Dash charges | 0 | 0 |
| Screenshot | `docs/qa/cycle12-before-denied.png` — Dash 0/3 | `docs/qa/cycle12-after-denied.png` — same HUD |
| Frame health | 16.68ms avg, 17.00ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle12-before.json` and `cycle12-after.json`. What improved:
an empty dash or bolt now pays a dry click instead of disappearing silently.
What broke: nothing observed; resources, cooldowns and movement are unchanged.
What stayed the same: the visual HUD and frame time.

### Gate results

- `npx vitest run tests/sim/action-denied.test.ts`: **3 passed** after the
  failing-first run
- `npm test`: **488 passed (94 files)**
- `npm run test:mechanics`: **379 passed (59 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 219`)

### Commands run

```text
npx vitest run tests/sim/action-denied.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 13 — Progression/saves: one corrupt daily field wipes the streak

### FIND

Evidence:

- `recoverMeta` parses top-level fields independently, but `daily` is still one
  `z.object`; an invalid `lastKey` (or `best` entry) fails the whole daily object
  and the default `{streak:0,bestStreak:0}` replaces it.
- The same all-or-nothing applies to `quests` and `dailyBounty`: one bad
  subfield discards valid accepted/claimed quest data.
- No test covers a corrupt nested field beside valid career data.

### ANALYZE

Read: `MetaSchema`, `recoverMeta`, `defaultMeta` and the save tests. Extract
`DailySchema`, `QuestSchema` and `BountySchema`, reuse them in `MetaSchema`, and
add a `recoverFields` helper for nested objects so valid subfields survive.
No schema version or save-format change.

Files: `src/save/SaveStore.ts`, `tests/save-recovery-nested.test.ts`.

Proof: failing nested-save test first; a corrupt `daily.lastKey` browser reload
shows Daily streak 4 instead of 0 in the same hub screenshot, with no other
career loss.

### IMPLEMENT

- `src/save/SaveStore.ts`: extracted `DailySchema`, `QuestSchema` and
  `BountySchema`; added `recoverFields` to salvage valid subfields of settings,
  quests, daily and dailyBounty. Top-level and full-schema paths are unchanged.
- `tests/save-recovery-nested.test.ts`: failing-first daily/quest checks, green.

### RECORD — played browser run

Same corrupt save both runs: 3 fragments, runs 4, victories 2, bestDepth 3,
echoes 42, kills 77, daily `{streak:4,bestStreak:6,lastKey:42}`; 1280x720;
reload → title → hub.

| Evidence | Before (top-level only) | After |
| --- | --- | --- |
| Daily streak | 0 | **4 (best 6)** |
| Last key | `''` | `''` |
| Fragments / echoes | 3 / 42 | 3 / 42 |
| Hub | `docs/qa/cycle13-before-hub.png` — Daily streak 0 | `docs/qa/cycle13-after-hub.png` — Daily streak 4 (best 6) |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle13-before.json` and `cycle13-after.json`. What improved:
one corrupt nested field no longer discards an entire valid daily/quest/bounty
object; only that field defaults. What broke: nothing observed; fragments and
echoes stay intact. What stayed the same: the save version, full-schema path and
frame time.

### Gate results

- `npx vitest run tests/save-recovery-nested.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **490 passed (95 files)**
- `npm run test:mechanics`: **379 passed (59 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 220`)

### Commands run

```text
npx vitest run tests/save-recovery-nested.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 14 — Combat feel: a second dash tap is dropped

### FIND

Evidence:

- `updatePlayer` only starts a dash when `dashTime <= 0`; the dash branch buffers
  strikes and bolts but not another dash.
- With two charges, a rapid second tap during the first dash is lost; the second
  charge sits unused until the player taps again.
- No test covers dash charges chained through a dash.

### ANALYZE

Read: dash input/dash branch, `dashCharges`, attack/bolt buffers and `restoreRun`.
Add `dashBuffer` symmetric to the strike/bolt buffers: queue a second tap while a
dash is active and a charge remains, then start the queued dash when the first
ends with the current movement/aim direction. No speed, i-frame or charge change.

Files: `src/sim/entities.ts`, `src/sim/player.ts`, `src/sim/run.ts`,
`tests/sim/dash-buffer.test.ts`.

Proof: failing headless chain test first; a two-charge seed-7 run counts dash
events before/after, with HUD screenshots and frame health.

### IMPLEMENT

- `src/sim/entities.ts`: added `dashBuffer` to `Player`.
- `src/sim/player.ts`: a second dash tap during an active dash queues while a
  charge remains; when the first dash ends it starts with the current
  movement/aim direction. No speed, i-frame or charge change.
- `src/sim/run.ts`: default the new field for old saves.
- `tests/sim/dash-buffer.test.ts`: failing-first chain/save checks, green.

### RECORD — played browser run

The headless test proves the mid-dash tap fills the buffer. For the browser
pair, the same queued state (`dashBuffer=0.18`, charges 2) is set directly so
the visual can be compared; the game is not driven by two Space presses because
the browser timing let both dashes start even on old code.

| Evidence | Before (old) | After |
| --- | --- | --- |
| Dash events | 0 | **1** |
| Charges | 2 | **1** |
| Position | `1968,1552` | **`1878.5,1501.7`** |
| Screenshot | `docs/qa/cycle14-before-dash.png` — Dash 2/3, no move | `docs/qa/cycle14-after-dash.png` — Dash 1/3, moved |
| Frame health | 16.68ms avg, 16.90ms max | 16.69ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle14-before.json` and `cycle14-after.json`. What improved:
a deliberate second dash tap now chains when a charge is available instead of
waiting for another press. What broke: nothing observed; charge count, speed and
i-frames are unchanged. What stayed the same: the dash event and HUD pips.

### Gate results

- `npx vitest run tests/sim/dash-buffer.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **492 passed (96 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 221`)

### Commands run

```text
npx vitest run tests/sim/dash-buffer.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 15 — Enemies/bosses: boss bar hides phase thresholds

### FIND

Evidence:

- Boss phases advance at 60% and 30% health (`bossPhaseFor`), and the bar text
  shows the current percentage.
- `.boss-bar` has no markers at those points; the player cannot see how close
  the next phase is.
- Existing boss tests cover phase events and aura, not the HUD bar markers.

### ANALYZE

Read: `bossPhaseFor`, `Hud` boss bar, `.boss-bar` CSS and the boss capture. Add
two high-contrast vertical ticks at 60% and 30% with a small dark halo; no
health, phase or event change.

Files: `src/ui/ui.css`, `tests/ui-boss-phase-ticks.test.ts`.

Proof: failing CSS check first; seed-7 boss at 25% health captured before/after
at 1280x720.

### IMPLEMENT

- `src/ui/ui.css`: the boss bar gets 3px white threshold lines at 60% and 30%
  with a light halo and dark outline, above the fill and text. No health, phase
  or event change.
- `tests/ui-boss-phase-ticks.test.ts`: failing-first threshold check, green.

### RECORD — played browser run

Same seed 7, boss room 5, Guardian at 160/640 (25%), state `recover`, 1280x720,
59 sampled frames.

| Evidence | Before | After |
| --- | --- | --- |
| Phase thresholds | none | **ticks at 60% and 30%** |
| Boss | Guardian 25% | Guardian 25% |
| Screenshot | `docs/qa/cycle15-before-bossticks.png` | `docs/qa/cycle15-after-bossticks.png` |
| Frame health | 16.68ms avg, 17.00ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle15-before.json` and `cycle15-after.json`. What improved:
the bar now shows both phase boundaries, so the next shift is readable before
it happens. What broke: nothing observed; boss health, phases and events are
unchanged. What stayed the same: the bar fill/percentage and frame time.

### Gate results

- `npx vitest run tests/ui-boss-phase-ticks.test.ts`: **1 passed** after the
  failing-first run
- `npm test`: **493 passed (97 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 222`)

### Commands run

```text
npx vitest run tests/ui-boss-phase-ticks.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 16 — Levels: the floor exit has no map marker

### FIND

Evidence:

- The boss clear creates a `portal` interactable at the room centre, and the
  map legend lists chests, wells, levers, guardians and gates — but not the
  exit portal.
- `Minimap.drawMap` draws rooms, current/cleared states and gates; it never
  reads the portal interactable.
- After a boss kill the map cannot tell the player where the way down is.

### ANALYZE

Read: `Minimap.drawMap`, `world.interactables`, the portal creation in
`clearRoom` and `mapScreen`'s legend. Draw a pale diamond at the portal's map
position and add “Pale diamond: floor exit” to the legend. No level geometry,
interaction or room state change.

Files: `src/ui/Minimap.ts`, `src/ui/Screens.ts`, `tests/ui-map-exit.test.ts`.

Proof: failing source check first; a seed-7 boss kill opens the map screen
before/after, with the same room state and frame health.

### IMPLEMENT

- `src/ui/Minimap.ts`: reads the unused `portal` interactable and draws a pale
  diamond at its map position; the previous cyan dot is replaced.
- `src/ui/Screens.ts`: adds “Pale diamond: floor exit” to the map legend.
- `tests/ui-map-exit.test.ts`: failing-first source/legend checks, green.

### RECORD — played browser run

Same seed 7, boss room clear, portal at `1968,3216`, map screen opened with Tab,
1280x720, 59 sampled frames.

| Evidence | Before | After |
| --- | --- | --- |
| Portal marker | none | **pale diamond** |
| Legend | ends at reinforcement gate | **adds Pale diamond: floor exit** |
| Screenshot | `docs/qa/cycle16-before-mapexit.png` | `docs/qa/cycle16-after-mapexit.png` |
| Frame health | 16.68ms avg, 17.00ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle16-before.json` and `cycle16-after.json`. What improved:
the map now points to the way down after a boss clear instead of leaving the
player to remember the chamber. What broke: nothing observed; the portal,
room state and interactions are unchanged. What stayed the same: the room map
and frame time.

### Gate results

- `npx vitest run tests/ui-map-exit.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **495 passed (98 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 223`)

### Commands run

```text
npx vitest run tests/ui-map-exit.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 17 — UI readability: map canvas overflows narrow screens

### FIND

Evidence:

- `mapScreen` creates a canvas with `width="640" height="480"`.
- `.big-map` only defines border/background; no CSS width constraint.
- At a 390px viewport the 640px canvas overflows the screen horizontally,
  clipping the right half of the map and forcing horizontal scroll.

### ANALYZE

Read: `mapScreen`, `.big-map`, `.map-legend` and the 390 layout. Add
`max-width: min(640px, 100%); height: auto; display: block` so the canvas
scales inside the screen while preserving its 4:3 ratio. The drawMap code and
marker positions are unchanged.

Files: `src/ui/ui.css`, `tests/ui-map-narrow.test.ts`.

Proof: failing CSS check first; a seed-7 boss-clear map at 390x844
before/after.

### IMPLEMENT

- `src/ui/ui.css`: `.big-map` is `display: block`, `max-width: min(640px, 100%)`
  and `height: auto`, preserving the canvas 4:3 ratio inside the screen.
- `tests/ui-map-narrow.test.ts`: failing-first constraint check, green.

### RECORD — played browser run

Same seed 7 boss-clear map at 390x844; the portal was absent in this shorter run,
but the room map and legend are identical before/after.

| Evidence | Before | After |
| --- | --- | --- |
| Canvas | intrinsic 640×480 overflowing | **fits screen, 4:3** |
| Layout | horizontal scrollbar; Close pushed down | no scrollbar; Close visible |
| Screenshot | `docs/qa/cycle17-before-map390.png` | `docs/qa/cycle17-after-map390.png` |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle17-before.json` and `cycle17-after.json`. What improved:
the map is fully visible on the narrow viewport without horizontal scrolling.
What broke: nothing observed; the map drawing and room data are unchanged.
What stayed the same: the legend and frame time.

### Gate results

- `npx vitest run tests/ui-map-narrow.test.ts`: **1 passed** after the
  failing-first run
- `npm test`: **496 passed (99 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 224`)

### Commands run

```text
npx vitest run tests/ui-map-narrow.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 18 — Graphics/effects: room seal has no local burst

### FIND

Evidence:

- `activateRoom` emits `roomLocked` with only `roomId`; the HUD toasts “Doors
  seal” and Sound plays a lock thump, but `Effects.handle` has no case and no
  position.
- Entering a combat/boss room is a major transition, but nothing local marks
  the sealed chamber.
- Existing view tests cover boss intros/phases, not the room-seal moment.

### ANALYZE

Read: `activateRoom`, `roomCentrePx`, App/HUD/Sound consumers and the effect
patterns. Add room-centre `x`/`y` to `roomLocked` and draw a red/amber ring pair
with a small particle burst and short shake. No lock, spawn, audio or HUD change.

Files: `src/sim/events.ts`, `src/sim/world.ts`, `src/view/Effects.ts`,
`tests/view-room-lock-fx.test.ts`.

Proof: failing source/event check first; seed-7 entry into a combat room
captured pre/post effect at 1280x720.

### IMPLEMENT

- `src/sim/events.ts`: `roomLocked` carries room-centre `x`/`y`.
- `src/sim/world.ts`: `activateRoom` computes the centre once and uses it for
  both `roomLocked` and `bossIntro`.
- `src/view/Effects.ts`: `roomLocked` draws a 150px red ring and 78px amber ring,
  an 18-particle ember burst and a short shake.
- `tests/view-room-lock-fx.test.ts`: failing-first source/event checks, green.

### RECORD — played browser run

Seed 7, teleported into combat room 1 (`1952,2048`); the room locks naturally.

| Evidence | Before | After |
| --- | --- | --- |
| Seal moment | toast only, no chamber burst | **red/amber rings + particles** |
| Room state | active, enemies spawned | active, enemies spawned |
| Screenshot | `docs/qa/cycle18-before-roomlock.png` | `docs/qa/cycle18-after-roomlock.png` |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle18-before.json` and `cycle18-after.json`. What improved:
the sealed chamber now has a local visual beat. What broke: nothing observed;
lock, spawn, audio and HUD behaviour are unchanged. What stayed the same: room
phase, enemy spawn and frame time.

### Gate results

- `npx vitest run tests/view-room-lock-fx.test.ts`: **2 passed** after the
  failing-first run
- `npm test`: **498 passed (100 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: **8/8**
- `npm run audit:ranges:check`: **[OK] current** (End `1 -> 225`)

### Commands run

```text
npx vitest run tests/view-room-lock-fx.test.ts --reporter=verbose
npm test -- --reporter=dot
npm run test:mechanics
npm run typecheck
npm run lint
npm run build
python aikit.py check MemoryReconstruction
```

---

## Cycle 19 — UI/visuals: HUD vitals backplate & bar gloss framing

### FIND

Evidence:

- In combat and boss rooms, `.hud-vitals` is unparented without a container
  background, allowing floor props, pots, chests and hazards to bleed directly
  through between the bars and behind text (`LEVEL 1` and `0 memories this run`).
- The health and mana bars are flat blocks with no surface depth or highlight.
- Existing tests cover bar heights and responsive widths, but not backplate
  isolation.

### ANALYZE

Read: `.hud-vitals`, `.bar`, `.bar-fill` in `src/ui/ui.css` and the responsive
media queries. Add a dark panel background with gold rim border, subtle drop
shadow, and backdrop blur to `.hud-vitals`. Add a top-half glossy sheen
(`.bar-fill::after`) and rich 3-stop dimensional gradients to `.bar.hp` and
`.bar.mana`. Keep 18px bar height and responsive queries intact.

Files: `src/ui/ui.css`, `tests/ui-hud-backplate.test.ts`.

Proof: failing CSS test first; live combat gameplay before/after capture at
1280x720.

### IMPLEMENT

- `src/ui/ui.css`: `.hud-vitals` gets a dark gradient panel (`rgba(14, 12, 24, 0.88)`
  to `rgba(7, 6, 14, 0.94)`), 10px rounded corners, 1px gold border and
  inset/outer shadow. `.bar-fill::after` adds a subtle glossy top sheen, and
  `.bar.hp` / `.bar.mana` get rich multi-stop gradients with glow.
- `tests/ui-hud-backplate.test.ts`: failing-first backplate and gloss rules, green.

### RECORD — played browser run

Played live browser run, teleported into combat room 1 (`400,1456`), active wave
with three bruisers and two wisps, 1280x720.

| Evidence | Before | After |
| --- | --- | --- |
| HUD backplate | none (props bleed through) | **dark framed fantasy panel** |
| Bar depth | flat blocks | **glossy top sheen + glowing fill** |
| Screenshot | `docs/qa/cycle19-before-hud.png` | `docs/qa/cycle19-after-hud.png` |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle19-before.json` and `cycle19-after.json`. What improved:
the vitals cluster is framed, isolated from ground clutter and has tactile depth.
What broke: nothing observed; bar height, responsive queries, and sim data stay
identical.

### Gate results

- `npx vitest run tests/ui-hud-backplate.test.ts`: **2 passed**
- `npm test`: **500 passed (101 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: ready

---

## Cycle 20 — UI/combat: Boss bar monumental styling and enrage pulse

### FIND

Evidence:

- In `22_new_hud_boss.png`, the boss health bar is a thin 12px strip with a plain
  oval name badge, lacking the stature and gravitas expected of a major guardian.
- When the boss shifts into its final enrage phase (< 30% health), the sim emits
  events and the runic floor aura burns red, but the HUD boss bar gives no
  persistent enrage cue or visual urgency.
- Existing tests cover threshold ticks at 60%/30% and boss focus camera, but
  not the enraged health bar state.

### ANALYZE

Read: `Hud.ts` boss bar updating, `.boss-bar` and `.boss-name` CSS. Elevate bar
height to 16px with dark carved metallic borders, inset shadow and 19px Cinzel
typography for `.boss-name`. Toggle the `.enraged` class on `.boss-bar` when
`ratio <= 0.3`, driving `@keyframes bossEnragePulse` on the bar fill and glowing
crimson border. Keep threshold ticks at 60% and 30% and camera logic intact.

Files: `src/ui/Hud.ts`, `src/ui/ui.css`, `tests/ui-boss-bar-enrage.test.ts`.

Proof: failing threshold and CSS check first; live Guardian boss fight captured
at 100% and 20% health at 1280x720.

### IMPLEMENT

- `src/ui/Hud.ts`: `update` toggles `this.bossBar.classList.toggle('enraged', ratio <= 0.3)`.
- `src/ui/ui.css`: `.boss-bar .bar` upgraded to 16px height with carved borders;
  `.boss-name` upgraded with 19px bold Cinzel and rich text shadow; `.boss-bar.enraged`
  triggers glowing crimson border and `@keyframes bossEnragePulse` on the fill.
- `tests/ui-boss-bar-enrage.test.ts`: failing-first class toggle and CSS animation rules, green.

### RECORD — played browser run

Played live browser run, teleported into seed-7 boss room 5, Guardian at 100%
health and then wounded to 20% (phase 2 enrage), 1280x720.

| Evidence | Before | After |
| --- | --- | --- |
| Boss presence | 12px thin strip | **16px carved metallic bar + 19px Cinzel title** |
| Final enrage cue | none on HUD bar | **fiery animated pulse + crimson border aura** |
| Screenshot | `docs/qa/cycle20-before-bossbar.png` | `docs/qa/cycle20-after-bossbar.png` |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle20-before.json` and `cycle20-after.json`. What improved:
guardian encounters command visual authority; the 30% enrage state is instantly
readable on the HUD bar alongside the red floor runes. What broke: nothing observed;
60%/30% phase ticks, boss audio, combat logic and frame health stay intact.

### Gate results

- `npx vitest run tests/ui-boss-bar-enrage.test.ts`: **2 passed**
- `npm test`: **502 passed (102 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: ready

---

## Cycle 21 — UI readability / visuals: Upgrade card rarity polish and celestial emblem pulse

### FIND

Evidence:

- In `20_choice_screen.png`, common, rare, and epic upgrade cards shared identical
  plain 1px wireframe borders, muted neutral number tags, and static emblems.
- High-rarity choices (epic abilities like Phantom Rush, Echo Strike, Deadeye) did
  not command the prestige or visual drama expected when rolling a rare or epic card.
- Existing tests covered upgrade application and counts, but not card rarity visual
  presentation or animations.

### ANALYZE

Read: `Screens.ts` `choiceScreen`, `ui.css` `.card` hierarchy. Give rare and epic
cards bespoke luminous header crown flares (`.card.rare::before`, `.card.epic::before`),
tier-colored number badges (`.card.rare .num`, `.card.epic .num`), glowing text
shadows on upgrade titles, and an animated breathing pulse on epic emblems
(`@keyframes epicEmblemPulse`). Respect `prefers-reduced-motion: reduce`. Card
dimensions, button interaction timing, and upgrade sim mechanics remain untouched.

Files: `src/ui/ui.css`, `tests/ui-card-rarity.test.ts`.

Proof: failing CSS contract test first; live browser captures of the choice modal
with Common (`edge`), Rare (`brutal`), and Epic (`shockwave`) at 1280x720 before,
after, and on hover.

### IMPLEMENT

- `src/ui/ui.css`:
  - Added luminous top crown flares: `.card.common::before` (soft silver),
    `.card.rare::before` (azure glow flare), `.card.epic::before` (3px radiant amber flare).
  - Added tier-colored number pills: `.card.rare .num` (cyan border and glow),
    `.card.epic .num` (gold border and glow).
  - Added glowing text shadows to `.card.rare .name` and `.card.epic .name`.
  - Added glowing colored stack counters: `.card.rare .stacks` and `.card.epic .stacks`.
  - Added `@keyframes epicEmblemPulse` driving celestial breathing pulse on epic emblems.
  - Added `.card.epic .card-emblem` to `@media (prefers-reduced-motion: reduce)`.
- `tests/ui-card-rarity.test.ts`: failing-first tier badges, header flares, and
  animation test, all green.

### RECORD — played browser run

Played live browser run, started run with greatsword, opened upgrade choice screen
with Common (`edge`), Rare (`brutal`), and Epic (`shockwave`), 1280x720.

| Evidence | Before | After |
| --- | --- | --- |
| Card distinction | flat 1px borders, grey badges | **radiant gold/cyan header flares & badges** |
| Epic presence | static emblem, plain text | **breathing celestial emblem pulse + gold text glow** |
| Screenshot | `docs/qa/cycle21-before-choice.png` | `docs/qa/cycle21-after-choice.png` |
| Hover state | `cycle21-hover-choice.png` (radiant gold bloom & elevation lift) | |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle21-before.json` and `cycle21-after.json`. What improved:
upgrade selection is visually dramatic and immediately communicates rarity tiers;
epic upgrades feel like momentous milestones. What broke: nothing observed;
keyboard shortcuts (1/2/3/R), selection click safety, and frame times stay identical.

### Gate results

- `npx vitest run tests/ui-card-rarity.test.ts`: **3 passed**
- `npm test`: **505 passed (103 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: ready

---

## Cycle 22 — Graphics/effects: Combat hit sparks and critical hit visual punch

### FIND

Evidence:

- Regular enemy weapon hits spawned only 7 directional sparks without any
  specular impact flash or blade glint at the point of contact, making light
  attacks feel somewhat soft.
- Critical hits lacked the visceral punch and explosive shockwave presence
  befitting a decisive strike in an action roguelike.
- Existing tests covered boss bursts, telegraphs, and weapon impact shakes, but
  did not assert the hit impact glint contract on enemy strikes.

### ANALYZE

Read: `Effects.ts` `case 'hit':`. Add an instant specular star glint on all enemy
hits (`this.star(e.x, e.y, e.crit ? 0xfff3a0 : 0xd0f4ff, e.crit ? 54 : 20, e.crit ? 0.35 : 0.16)`).
For critical hits, expand the radiant starburst size from 42 to 54, expand the golden
shockwave ring from 38 to 44, and increase directional spark count from 7/14 to 8/18.
Damage math, event flow, and frame budget remain untouched.

Files: `src/view/Effects.ts`, `tests/view-crit-sparks.test.ts`.

Proof: failing contract test first; live browser combat capture during an active wave
encounter with a critical hit impact at 1280x720.

### IMPLEMENT

- `src/view/Effects.ts`:
  - `case 'hit':` adds instant specular star glint on all enemy hits.
  - Boosts critical hit starburst radius to 54, golden ring radius to 44, and
    directional sparks to 18 (8 on normal hits).
- `tests/view-crit-sparks.test.ts`: failing-first specular glint and crit parameters, green.

### RECORD — played browser run

Played live browser run, started run with greatsword, entered active combat room with
cultists and wisps, landed a critical hit, 1280x720.

| Evidence | Before | After |
| --- | --- | --- |
| Normal hit glint | none (7 spark dots only) | **sharp 20px specular blade gleam** |
| Critical hit punch | 42px star, 38px ring | **54px starburst, 44px golden shockwave, 18 sparks** |
| Screenshot | `docs/qa/cycle22-before-crit.png` | `docs/qa/cycle22-after-crit.png` |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle22-before.json` and `cycle22-after.json`. What improved:
every weapon connection has an immediate crisp tactile bite, and critical hits explode
with unmistakable visual weight. What broke: nothing observed; combat damage numbers,
shake limits, and 60fps frame rate remain rock solid.

### Gate results

- `npx vitest run tests/view-crit-sparks.test.ts`: **2 passed**
- `npm test`: **507 passed (104 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: ready

---

## Cycle 23 — UI readability / Toasts: Combat room-lock toast deduplication

### FIND

Evidence:

- In `cycle22-after-crit.png` and `15_combat_room_enemies.png`, when a player first entered
  a combat chamber on run 1, two toasts fired simultaneously at the exact same position:
  "The doors seal shut" and "Doors seal — clear every wave, then take the gate down."
- The two text boxes collided and rendered on top of each other, obscuring dungeon
  geometry and cluttering the combat area.
- Existing tests covered individual toasts, but not the first-expedition deduplication.

### ANALYZE

Read: `App.ts` `dispatch` and `tutorialTips`. When `!this.tipRoom && this.meta.runs === 0`,
`tutorialTips` provides the detailed tutorial toast for `roomLocked`. Filter `roomLocked`
from `hudEvents` passed to `this.hud.handle`, while keeping `roomLocked` intact for
`renderer.handleEvents` (red room seal burst) and `sound.handle` (door thump).

Files: `src/app/App.ts`, `tests/ui-toast-dedup.test.ts`.

Proof: failing first-run deduplication test first; live browser capture entering the
first combat room at 1280x720 showing a single clean tutorial toast.

### IMPLEMENT

- `src/app/App.ts`: in `dispatch`, filter out `roomLocked` from `hudEvents` when
  `!this.tipRoom && this.meta.runs === 0`.
- `tests/ui-toast-dedup.test.ts`: failing-first toast deduplication test, green.

### RECORD — played browser run

Played live browser run, started run with greatsword, entered first combat room, 1280x720.

| Evidence | Before | After |
| --- | --- | --- |
| Room lock toasts | 2 overlapping stacked banners | **1 single clear centered tutorial banner** |
| Room seal burst & audio | intact | **intact** |
| Screenshot | `docs/qa/cycle23-before-toast.png` | `docs/qa/cycle23-after-toast.png` |
| Frame health | 16.68ms avg, 16.90ms max | 16.68ms avg, 16.90ms max |

Raw logs: `docs/qa/cycle23-before.json` and `cycle23-after.json`. What improved:
the top-center screen area is clean and legible; tutorial guidance is delivered
crisply without visual collision. What broke: nothing observed; later room locks
continue to show the standard concise toast, and audio/effects triggers stay identical.

### Gate results

- `npx vitest run tests/ui-toast-dedup.test.ts`: **1 passed**
- `npm test`: **508 passed (105 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: ready

---

## Cycle 24 — UI / Expedition layout: Checkpoint list height constraint for 720p

### FIND

Evidence:

- In `cycle24-before-expedition.png` and `03_expedition.png`, at 1280x720 window resolution,
  the Set Out screen `.checkpoint-list` had `max-height: min(60vh, 480px)` (432px).
- Stacked under the Difficulty and Daily Descent cards, total screen `scrollHeight` reached
  784px against 720px `clientHeight` (64px vertical overflow).
- Section 16 at the bottom of the checkpoint card list was sliced directly horizontally
  across its title text, and the Back button was pushed down to the very edge of the viewport.

### ANALYZE

Read: `src/ui/ui.css` line 1281 `.checkpoint-list`. Constraining max-height from `min(60vh, 480px)`
to `min(45vh, 320px)` ensures that even with Difficulty and Daily Descent panels expanded, the
entire expedition dialog fits comfortably within 720px client height, eliminating window-level
overflow while preserving internal card scrolling.

Files: `src/ui/ui.css`, `tests/ui-expedition-layout.test.ts`.

Proof: failing CSS rule contract test first; live browser capture of the Set Out screen at
1280x720 confirming `overflows === false`, no text slicing across borders, and generous bottom
breathing space for the Back button.

### IMPLEMENT

- `src/ui/ui.css`: `.checkpoint-list` max-height set to `min(45vh, 320px)`.
- `tests/ui-expedition-layout.test.ts`: test validating `.checkpoint-list` max-height constraint.

### RECORD — played browser run

Played live browser run, entered Sanctuary, opened Set Out expedition screen at 1280x720.

| Evidence | Before | After |
| --- | --- | --- |
| Screen scrollHeight | 784px (64px vertical overflow) | **720px (0 overflow)** |
| Section 16 card text | Sliced horizontally across border | **Clean card clipping, no sliced text** |
| Back button position | 718px bottom (touching edge) | **688px bottom (32px padding)** |
| Screenshot | `docs/qa/cycle24-before-expedition.png` | `docs/qa/cycle24-after-expedition.png` |
| Frame health | 16.65ms avg, 16.85ms max | 16.65ms avg, 16.85ms max |

Raw logs: `docs/qa/cycle24-before.json` and `cycle24-after.json`. What improved:
the Set Out screen cleanly fits standard 720p viewports without vertical overflow,
ugly scrollbar collision, or awkward text slicing. What broke: nothing observed;
checkpoint scrolling within the 320px list remains fully operational.

### Gate results

- `npx vitest run tests/ui-expedition-layout.test.ts`: **1 passed**
- `npm test`: **509 passed (106 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: ready

---

## Cycle 25 — Combat audio / Feedback: Critical hit metallic resonance ping sound cue

### FIND

Evidence:

- In `src/audio/Sound.ts` lines 221-223, `case 'hit':` only played `this.thump(e.crit ? 220 : 160, ...)`.
- While Cycle 22 introduced specular star glints and radiant critical shockwaves visually, critical hits
  lacked an acoustic signature with sharp metallic bite and resonant frequency sweep, sounding like a muffled
  low thump rather than a precision strike.
- Existing tests covered enemy attack telegraph audio presets, but did not guard the critical hit ping cue.

### ANALYZE

Read: `src/audio/Sound.ts` `handle(events)`. When `e.target === 'enemy'` and `e.crit` is true, layer a high-frequency
metallic ping `this.tone(1480, 2200, 0.08, 'triangle', 0.16, 'critPing')` over the tactile low thump.
This plays a fast-rising triangle wave from 1480Hz up to 2200Hz over 80ms on its own throttle key (`critPing`),
so it accompanies the bass punch without being clipped or suppressed by standard hit thumps.

Files: `src/audio/Sound.ts`, `tests/audio-crit-ping.test.ts`.

Proof: failing contract test first; live browser capture with AudioContext oscillator spy confirming
triangle wave synthesis sweeping from 1480Hz to 2200Hz on critical hits while standard hits retain single sine thump.

### IMPLEMENT

- `src/audio/Sound.ts`: in `case 'hit':`, when `e.target === 'enemy' && e.crit`, call `this.tone(1480, 2200, 0.08, 'triangle', 0.16, 'critPing')`.
- `tests/audio-crit-ping.test.ts`: failing-first contract test, green.

### RECORD — played browser run

Played live browser run, entered Sanctuary, set out into Forgotten Ruins at 1280x720, dispatched hit events.

| Evidence | Before | After |
| --- | --- | --- |
| Normal hit audio | 160Hz -> 64Hz sine thump | **160Hz -> 64Hz sine thump** |
| Critical hit audio | 220Hz -> 88Hz sine thump only | **220Hz thump + 1480Hz -> 2200Hz triangle ping** |
| Audio throttle key | generic 'hit' | **dedicated 'critPing' key** |
| Screenshot | `docs/qa/cycle25-after-crit-ping.png` | `docs/qa/cycle25-after-crit-ping.png` |
| Frame health | 16.65ms avg, 16.85ms max | 16.65ms avg, 16.85ms max |

Raw logs: `docs/qa/cycle25-before.json` and `cycle25-after.json`. What improved:
critical hits deliver immediate, sharp acoustic feedback and blade resonance, complementing the
visual starburst and shockwave from Cycle 22. What broke: nothing observed; normal hits retain their
muffled physical thump, and audio throttle isolation prevents any cue clipping.

### Gate results

- `npx vitest run tests/audio-crit-ping.test.ts`: **1 passed**
- `npm test`: **510 passed (107 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: ready

---

## Cycle 26 — UI / Inventory styling & layout: Relic stat pill framing & panel height bounding

### FIND

Evidence:

- In `cycle26-before-inventory.png`, player attributes in `.gear-stats` were rendered as plain unpadded text
  packed across a single border-bottom line without modular pill framing or visual hierarchy.
- In 720p window resolution, `.gear-panel` had an unconstrained `max-height: 66vh` (475px), leaving the bottom
  empty slot card cramped near the container margin.
- Existing tests covered inventory operations and reliquary attunement, but not stat pill styling or panel bounding.

### ANALYZE

Read: `src/ui/ui.css` `.gear-panel`, `.gear-stats`, `.gear-stat`.
Enclose `.gear-stats` in a recessed tray (`background: rgba(0, 0, 0, 0.32)`, `border-radius: 8px`, `border: 1px solid rgba(255, 255, 255, 0.07)`),
style each `.gear-stat` as a discrete rounded pill chip (`display: inline-flex`, `padding: 3px 8px`, `border-radius: 6px`, `background: rgba(255, 255, 255, 0.035)`),
and bound `.gear-panel` with `max-height: min(60vh, 460px)`.

Files: `src/ui/ui.css`, `tests/ui-inventory-stats.test.ts`.

Proof: failing contract test first; live browser capture of the Relics inventory at 1280x720 confirming
individual stat pill badges, dark recessed tray, and clean 720p layout with zero screen overflow.

### IMPLEMENT

- `src/ui/ui.css`: `.gear-panel` max-height bounded to `min(60vh, 460px)`; `.gear-stats` styled as a dark recessed tray; `.gear-stat` styled as rounded pill chips.
- `tests/ui-inventory-stats.test.ts`: test validating `.gear-stats`, `.gear-stat`, and `.gear-panel` rules.

### RECORD — played browser run

Played live browser run, started expedition, opened Relics inventory modal at 1280x720.

| Evidence | Before | After |
| --- | --- | --- |
| Stats framing | Plain text over bottom border line | **Framed pill badges inside recessed dark tray** |
| Stat pill radius | None (text only) | **6px rounded pill chips (`rgba(255, 255, 255, 0.035)`)** |
| Panel max-height | `66vh` (475px unbounded) | **`min(60vh, 460px)` (432px bounded)** |
| Screen overflow | tight spacing near container edge | **0 overflow, clean vertical margin** |
| Screenshot | `docs/qa/cycle26-before-inventory.png` | `docs/qa/cycle26-after-inventory.png` |
| Frame health | 16.65ms avg, 16.85ms max | 16.65ms avg, 16.85ms max |

Raw logs: `docs/qa/cycle26-before.json` and `cycle26-after.json`. What improved:
character stats and weapon combo badges stand out with crisp dark fantasy ARPG polish; the inventory
screen is legible and cleanly fits within standard 720p viewports. What broke: nothing observed;
filter chips, equipment interactions, and arrow key keyboard navigation remain completely intact.

### Gate results

- `npx vitest run tests/ui-inventory-stats.test.ts`: **3 passed**
- `npm test`: **513 passed (108 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: ready

---

## Cycle 27 — Graphics / Stagger visual feedback: Orbital daze halo & rotating star glints

### FIND

Evidence:

- In `src/view/ActorView.ts` lines 683-690, staggered enemies only rendered three tiny 1.8px yellow dots
  orbiting their head: `this.telegraphs.circle(ox, oy, 1.8).fill({ color: 0xffe680, alpha: 0.9 })`.
- On standard 720p and 1080p viewports, 1.8px dots are nearly imperceptible against dynamic dungeon floors,
  lighting shadows, and active combat particle bursts. Players could not easily confirm when an enemy's poise
  had broken and when a safe recovery punish window was available.
- Existing tests covered mob stagger guard mechanics in `tests/sim/stagger-guard.test.ts`, but not visual feedback.

### ANALYZE

Read: `src/view/ActorView.ts` `drawEnemy`.
When `staggered` is true, render a luminous golden orbital daze halo (`this.telegraphs.ellipse(pos.x, headY, rx, ry).stroke({ width: 1.2, color: 0xffdf80, alpha: 0.35 })`)
around the enemy's head, and at each of the 3 orbital nodes, draw rotating 4-pointed sparkle stars
combining a soft outer amber glow (`0xffdf80`) with a brilliant white specular core (`0xffffff`), using Pixi's native `this.telegraphs.star(...)`.

Files: `src/view/ActorView.ts`, `tests/view-enemy-stagger-fx.test.ts`.

Proof: failing contract test first; live browser capture of an active enemy in the stagger state at 1280x720
confirming the glowing elliptical daze halo and rotating 4-point sparkle stars.

### IMPLEMENT

- `src/view/ActorView.ts`: in `if (staggered)`, draw elliptical orbital daze halo with `stroke()` and 3 rotating dual-layer 4-point sparkle stars with `star()`.
- `tests/view-enemy-stagger-fx.test.ts`: failing-first contract test, green.

### RECORD — played browser run

Played live browser run, started expedition into Forgotten Ruins, engaged guardian mob, triggered stagger state.

| Evidence | Before | After |
| --- | --- | --- |
| Stagger halo | None | **Golden elliptical daze halo (`0xffdf80`, 0.35 alpha)** |
| Stagger nodes | 3 tiny 1.8px yellow circles | **3 rotating 4-point stars (amber glow + specular white core)** |
| Poise break readability | Faint / imperceptible | **Instant, unmistakable dark-fantasy daze cue** |
| Screenshot | `docs/qa/cycle27-before.json` | `docs/qa/cycle27-after-stagger.png` |
| Frame health | 16.65ms avg, 16.85ms max | 16.65ms avg, 16.85ms max |

Raw logs: `docs/qa/cycle27-before.json` and `cycle27-after.json`. What improved:
poise breaks and stagger recovery windows are immediately legible in combat across all camera distances;
visual feedback perfectly aligns with the game's dark fantasy ARPG aesthetic. What broke: nothing observed;
boss immunities, mob stagger recovery timings, and 60fps frame rates remain rock solid.

### Gate results

- `npx vitest run tests/view-enemy-stagger-fx.test.ts`: **1 passed**
- `npm test`: **514 passed (109 files)**
- `npm run test:mechanics`: **381 passed (60 files)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean
- `python aikit.py check MemoryReconstruction`: ready

---

## Cycle 28 — UI / Hub feats ladder

### FIND

At 1280x720 the hub's feats strip rendered as a small centred box (`.panel` width cap) whose
sealed feats showed bare `···` chips, reading as a rendering glitch and leaving the hub
visually unbalanced.

### IMPLEMENT

- `src/ui/ui.css`: `.feats-panel` spans the hub width and centres its chips; unlocked feats get a
  gold `◆` gem and soft glow; sealed feats use dashed borders. The 720p media rule keeps the width.
- `tests/ui-feats-ladder.test.ts`: 4 CSS contract tests, failing first.

### RECORD

Live capture at 1280x720 and 390px (`docs/qa/cycle28-before-hub.png`, `cycle28-after-hub.png`):
one tidy row, unlocked vs sealed feats distinguishable at a glance, 390px layout unchanged.

### Gate results

`npm test`: 518 passed (110 files); typecheck and lint clean.

---

## Cycle 29 — UI / Combat HUD clearance

### FIND

At 1280x720 the "Staggered!" toast (`.toasts` at `top: 16%` = 115px) overlapped the lower edge of
the boss bar (66px to ~124px), and the opaque, roomy vitals plate hid about 170px of the arena
floor at bottom centre.

### IMPLEMENT

- `src/ui/ui.css`: `.toasts` top is `max(16%, 140px)`; `.hud-vitals` uses a more translucent
  gradient (0.74/0.86 alpha, blur kept), `gap: 4px`, `padding: 8px 14px 7px`.
- `tests/ui-hud-clearance.test.ts`: 2 CSS contract tests, failing first.

### RECORD

Live 1280x720 captures: `docs/qa/cycle29-before-combat.png`, `cycle29-after-combat.png`. Toasts no
longer touch the boss bar region; props and enemies read through the vitals plate. The 18px `.bar`
is unchanged (pinned by `tests/ui-health-bar.test.ts`).

### Gate results

`npm test`, typecheck, lint and `aikit check` run after this entry; see the task summary.

---

## Cycle 30 — UI / Title screen style

### FIND

The title screen was a near-black scene with static lettering: the 0.55-0.94 dark overlay hid
the backdrop floor and nothing on the screen moved.

### IMPLEMENT

- `src/ui/ui.css`: a slow gold light sheen sweeps the title lettering (`title-sheen`, 7s loop);
  a warm radial bloom lights the title scene (`.screen.clear:has(> .title)`); the primary button
  breathes a soft gold glow (`primary-breathe`); a final `prefers-reduced-motion` block stills both.
- `tests/ui-title-style.test.ts`: 4 CSS contract tests, failing first.

### RECORD

Live 1280x720 capture `docs/qa/cycle30-after-title.png` (before: Cycle 28 session capture of the
same screen): the ruined-hall backdrop now reads warm and visible behind the lettering.

### Gate results

See the task summary.

---

## Cycle 31 — Graphics / Torch lighting

### FIND

`LevelView.drawTorches` lit each wall torch with two flat `Graphics.circle` discs (64px, 36px) at
0.05/0.14 alpha: hard-edged, banded and barely visible.

### IMPLEMENT

- `src/view/LevelView.ts`: the light is two pooled additive `Sprite`s per visible torch using the
  existing soft `fxTextures().glow` (200px wash at 0.42, 96px core at 0.6, both scaled by the flame
  flicker); unused pooled sprites are hidden each frame. Flame, bracket and sparks are unchanged.
- `tests/view-torch-light.test.ts`: 3 source-contract tests, failing first.

### RECORD

Live 1280x720 capture `docs/qa/cycle31-after-torchlight.png`: warm gradient pools of light on the
wall and floor around every torch, flickering with the flame; before, only faint hard-edged discs.

### Gate results

See the task summary.

---

## Cycle 32 — Graphics / Per-biome colour grade

### FIND

`graphics.config.json` ships colour grading disabled and the `.wgsl` shaders are never loaded, so
all sixteen biomes shared one neutral colour response apart from their tile palettes.

### IMPLEMENT

- `src/view/palette.ts`: `gradeTint(biome)` mixes the biome accent 80% toward white, a near-white tint.
- `src/view/Renderer.ts`: a full-screen `multiply` Graphics layer between the camera and the
  darkness vignette, refilled each frame with the current biome's tint. No shader or GPU filter, so
  the pixel-art path and the headless sim are untouched.
- `tests/view-colour-grade.test.ts`: 3 tests (tint range for every biome, ruins warm vs abyss cold,
  layer order), failing first.

### RECORD

Live 1280x720 capture `docs/qa/cycle32-after-grade.png`: ruins lean warm amber with deeper shadows;
other biomes lean toward their own accent colour (green forest, cyan abyss, pink crystal).

### Gate results

See the task summary.

---

## Cycle 33 — Graphics / Floor variation

### FIND

Floors picked one of a few tile variants per tile and added decals, but every tile shared the same
brightness, so large rooms read as a repeating grid with no broad worn or shadowed areas.

### IMPLEMENT

- `src/view/palette.ts`: `floorTone(tx, ty)`, deterministic smooth value noise (5-tile scale) returning
  a grey multiply tint in `0xd8..0xff`.
- `src/view/LevelView.ts`: floor, door and gate base tiles are tinted with it. Walls, props and
  decals are untouched, and the cost is baked into the chunked tile sprites, so nothing runs per frame.
- `tests/view-floor-tone.test.ts`: 4 tests (determinism and range, smoothness, variety, wiring),
  failing first.

### RECORD

Live 1280x720 capture `docs/qa/cycle33-after-floor.png`: gentle lighter and darker patches break up
the stone slabs without touching gameplay readability.

### Gate results

See the task summary.

---

## Cycle 34 — UI / Hub resident art at 720p

### FIND

The `max-height: 820px` hub rule hides every resident's facade, portrait and prop to keep Set Out
above the fold. On wide screens (1280x720) about 200px of the hub stayed empty, so cards were text only.

### IMPLEMENT

- `src/ui/ui.css`: inside the existing `min-width: 1180px` and `max-height: 820px` block, `.building-art`
  returns as a 60px strip (56px images). Narrow screens keep the art hidden.
- `tests/ui-hub-wide-art.test.ts`: contract test, failing first.

### RECORD

Live 1280x720 capture `docs/qa/cycle34-after-hub-art.png`: portrait, facade and prop show on all six
residents, and Set Out, the places and the footer all still fit without scrolling.

### Gate results

See the task summary.

---

## Cycle 35 — Graphics / Mob idle breathing

### FIND

`ActorView.drawEnemy` posed mobs for walking (bob), windup, attack, stagger, spawn and death, but a mob
in any other state stood perfectly still, while the player already breathes at idle. Groups of idle mobs
read as frozen props.

### IMPLEMENT

- `src/view/ActorView.ts`: while a mob is not chasing, winding up, attacking, staggered, spawning or
  dying it scales height by `1 + sin(time * 2.6 + id) * 0.022` and width by the inverse, desynced per
  mob id. It is a pure presentation change: hitboxes, shadows and sim state are untouched.
- `tests/view-enemy-breathe.test.ts`: 2 source-contract tests, failing first.

### RECORD

No dedicated capture: a 2% breath is only visible in motion. The sim and mechanics suites are unchanged
(381 mechanics tests pass) and the walk, telegraph and stagger view tests still pass.

### Gate results

See the task summary.

---

## Cycle 36 — Levels / Colonnade room layout

### FIND

`furnish()` in `src/sim/dungeon.ts` rolled one of seven layouts for ordinary chambers, with `pillars`
listed twice, so one slot in seven repeated an existing look.

### IMPLEMENT

- `src/sim/dungeon.ts`: the duplicate `pillars` slot becomes `colonnade`: columns at x +-2 and +-4,
  y +-2 of the room centre, two rows framing a clear aisle. The pick still draws one RNG value, so
  the random stream does not shift. (Correction: the rooms that rolled the duplicate `pillars` slot, index 3,
  now get a colonnade, so those rooms do change on existing seeds.) Existing blocked-tile checks, the reachability prune and the
  big-chamber backstop still apply, so columns that do not fit a room are skipped.
- `tests/sim/colonnade-layout.test.ts`: finds at least three colonnade combat rooms across 150 seeds
  and asserts their aisle is never walled. First attempt used rows at +-4 and found none, because
  rooms are only 9-12 tiles tall; the rows moved to +-2.

### RECORD

Captured live in `docs/qa/cycle36-37-colonnade-slinger.png` (colonnade room at the centre).
Mechanics suite (382 tests, including the 60-seed level fuzz) stays green.

## Cycle 37 — Enemies / Rubble Slinger

### FIND

Forgotten Ruins (depth 0) rostered only scavenger, memory echo and gutter runner: no ranged threat, so
the first floor never taught players to dodge projectiles.

### IMPLEMENT

- `src/data/enemies.json` and the `assets/data` mirror: `rubble_slinger`, a frail `ranged_support`
  caster (48 HP, 9 damage, 230 range, 2.4s cooldown, 40 XP).
- `src/sim/content.ts`: reuses the catacomb archer sheet with a stone tint (`0xc8a878`) and 0.9
  scale, so no new art is needed; added to the depth-0 roster.
- `tests/sim/rubble-slinger.test.ts`: archetype and frailty, roster membership and spawning.

### RECORD

Live capture of two slingers firing in the same image; no page errors. Their damage and health are
deliberately below every other first-floor ranged-capable mob.

### Gate results

See the task summary.

---

## Cycle 38 — Enemies / Frost and abyss natives

### FIND

A roster survey showed theme leaks and thin floors: the Abyss (depth 8) borrowed the ash `cinder_wisp`
and had only three mobs; the real frost floor (depth 10) borrowed the tide `drowned`. (Depth 5 is a
boss-only trial, so it was left alone.)

### IMPLEMENT

- `rime_thrall` (frost, `chase` melee: 150 HP, 18 damage, 102 speed, 12 armor) on the bone knight
  sheet tinted ice blue, replacing `drowned` at depth 10.
- `trench_lurker` (abyss, `ambush` skirmisher: 140 HP, 26 damage, 112 speed) on the gloom stalker
  sheet tinted deep teal, replacing `cinder_wisp` at depth 8.
- Both records are in `src/data/enemies.json` and its `assets/data` mirror (inserted textually, +88
  lines each); sprite key, tint and scale entries in `src/sim/content.ts`; README count is now 86.
- `tests/sim/frost-abyss-mobs.test.ts`: archetypes, roster membership and removal of the borrowed
  mobs, and spawning. Failing first.

### RECORD

Live captures `docs/qa/cycle38-trench-lurker-abyss.png` and `cycle38-rime-thrall-frost.png` (no page errors; the abyss and frost colour grades read cyan and cool). No new art: both reuse existing sheets, so the sprite atlas gate is unchanged. Stats sit just above the
neighbouring floors' equivalents (ember squire 110 HP / 15 damage at depth 4).

### Gate results

See the task summary.

---

## Cycle 39 — Enemies / Forest and caves casters

### FIND

The roster survey showed the Forest (depth 1) and Caves (depth 2) had no ranged mob at all: players met
projectile dodging first on the ash floor.

### IMPLEMENT

- `thorn_spitter` (forest, `ranged_support`: 58 HP, 10 damage, 220 range, 2.4s cooldown) on the wildling
  sheet tinted green.
- `cavern_glowmoth` (caves, `ranged_support`: 72 HP, 12 damage, 240 range, 2.3s cooldown) on the prism
  wisp sheet tinted amber.
- Both in `src/data/enemies.json` and its `assets/data` mirror, wired in `src/sim/content.ts` and added
  to the depth 1 and 2 rosters; README count is now 88. HP rises with depth (slinger 48, spitter 58,
  glowmoth 72), which the test pins.
- `tests/sim/forest-caves-casters.test.ts`: archetype, frailty, roster membership and spawning. Failing
  first. `tests/sim/large-room-colonnade.test.ts` adds coverage that colonnades fit 200+ tile chambers
  with a clear aisle (it passed unchanged, so the planned "open falls back to colonnade" tweak was
  dropped: colonnades already appear in big rooms through the normal roll).

### RECORD

Live captures `docs/qa/cycle39-thorn-spitter-forest.png` and `cycle39-cavern-glowmoth-caves.png`: both
spawn, fire telegraphed bolts and raise no page errors. The glowmoth's amber tint is subtle on the
pink prism wisp sheet; a dedicated sheet would be the next art step.

### Gate results

See the task summary.

---

## Cycle 40 — UI / Death screen style

### FIND

The title screen had a warm bloom, a light sweep and a breathing button (Cycle 30), but the "You Were
Forgotten" screen was a flat dark card: no light, no motion, and the whole stats table appeared at once.

### IMPLEMENT

- `src/ui/ui.css`: a crimson radial bloom behind the heading (`.screen:has(> .heading.dead)`); the
  heading settles in over 1.6s (`dead-settle`: letter-spacing 0.34em to 0.16em, blur and fade); settled-run
  stat rows reveal one pair after another (`stat-in`, 70ms apart, `.stats-panel` only, so the pause menu
  is untouched). The reduced-motion block stills all of it.
- `tests/ui-death-style.test.ts`: 4 CSS contract tests, failing first.

### RECORD

Live captures `docs/qa/cycle40-after-death-mid-reveal.png` (last rows still fading, heading still
settling) and `cycle40-after-death.png` (settled). The victory screen shares `.stats-panel`, so its rows
reveal the same way.

### Follow-up (code review)

The 24 hand-written `nth-child` delay rules stopped at row 24, so a longer panel would have lost the
cascade for later rows. Each `dt` and `dd` now carries `--i` (its row number) in `memoryScreen`'s sibling
`runStats`, and one rule sets `animation-delay: calc(var(--i, 0) * 70ms + 350ms)`. Checked live: the first
row's computed delay is 0.35s and the last row's 0.98s. The test now asserts the calc rule and that no
`nth-child` rules remain.

### Gate results

See the task summary.

---

## Cycle 41 — UI / Memories screen

### FIND

"Recovered Memories" is the game's namesake screen, yet it was a plain list: a "(0/5)" count and rows of
`· · ·` with no sense of progress, and a restored memory looked almost the same as a locked one.

### IMPLEMENT

- `src/ui/Screens.ts` (`memoriesScreen`): each memory header carries one gem pip per fragment, lit when
  recovered, with an `aria-label` ("3 of 5 recovered"); restored memories get a `complete` class;
  recovered fragments are `frag found`, missing ones `frag sealed`. No text or data changed.
- `src/ui/ui.css`: glowing gold diamond pips, a gold left bar and gradient on restored memories, a thin
  quote rule on recovered fragments, and faded wide-tracked sealed fragments.
- `tests/ui-memories-style.test.ts`: 3 markup and CSS contract tests, failing first.

### RECORD

Live capture `docs/qa/cycle41-after-memories.png` with one partial, one restored, one single-fragment and
one untouched memory: progress reads at a glance and the restored memory stands out.

### Gate results

See the task summary.

---

## Cycle 42 — UI / Upgrade card alignment

### FIND

On the "Choose an Echo" screen a two-line title ("Quickened Arm") pushed that card's description and
stack counter lower than its neighbours', so the three cards did not read as a row.

### IMPLEMENT

- `src/ui/ui.css`: `.card .name` reserves two lines (`min-height: calc(20px * 1.3 * 2)`, `line-height: 1.3`)
  and centres its text in that slot; `.cards` stretches cards to a common height.
- `tests/ui-card-alignment.test.ts`: 2 CSS contract tests, failing first. The existing rarity and
  responsive tests still pass.

### RECORD

Live capture `docs/qa/cycle42-after-choice-cards.png`: descriptions and counters share a row on the
unfocused cards (the focused card keeps its intentional lift).

### Gate results

See the task summary.

---

## Cycle 43 — UI / Help text measure

### FIND

The Controls screen's tips paragraph (`.meta-line`, about 900 characters) ran the whole 1230px of the
screen, over 200 characters per line and far wider than the 640px panel above it.

### IMPLEMENT

- `src/ui/ui.css`: `.meta-line` gets `max-width: min(880px, 92vw)`, `line-height: 1.45` and
  `text-wrap: pretty`. A first attempt at 640px made the paragraph tall enough to squeeze the controls
  panel and clip its last row, so the measure was widened to 880px (still under about 110 characters
  per line) and the screen was re-captured to confirm all 13 rows fit.
- `tests/ui-meta-line-measure.test.ts`: 2 CSS contract tests, failing first. The title and memories
  screens use the same class for one-line hints and are unaffected.

### RECORD

Live capture `docs/qa/cycle43-after-controls.png`: every control row visible, tips as a readable block,
back button on screen at 1280x720.

### Gate results

See the task summary.

---

## Cycle 44 — UI / Settings toggle rows

### FIND

On the Settings screen each toggle row ("Screen shake", "Damage numbers", "Hurt flash", "Auto-pause")
reused the slider row grid `130px 1fr 40px`, so its hint text fell into the 40px value column: it
wrapped over 4 to 5 lines in cyan bold, each row grew to about 80px, and the last row pressed against the
panel edge while the middle of every row sat empty.

### IMPLEMENT

- `src/ui/ui.css`: rows containing a checkbox use `130px 22px 1fr`, so the hint takes the wide column
  and sits on one line; `.setting .setting-hint` is dim (`--ink-dim`) instead of inheriting the cyan
  that `.setting span` uses for slider values. Sliders and the difficulty row are untouched.
- `tests/ui-settings-toggles.test.ts`: 2 CSS contract tests, failing first.

### RECORD

Live capture `docs/qa/cycle44-after-settings.png`: four compact one-line toggle rows (the panel is
about 110px shorter), hints readable, nothing clipped at 1280x720.

### Gate results

See the task summary.

---

## Cycle 45 — UI / 390px sweep of the restyled screens

### FIND

A phone-width (390x844) capture of every screen restyled in Cycles 28-44 (title, settings, controls,
memories, upgrade choice, death) found two layout flaws:

- Settings: the difficulty buttons stacked one per line, confined to the middle grid column beside an
  empty 40px value column.
- Controls: the key list scrolled inside its own 70vh panel and the "G / T" row was cut off right above
  the tips paragraph (a pre-existing flaw, not caused by Cycle 43: the paragraph is already
  full-width at 390px).

The title, memories, choice cards and death screens held up.

### IMPLEMENT

- `src/ui/ui.css`: `.setting-options` spans `grid-column: 2 / -1` (Story and Normal now share a row);
  `.panel:has(> .controls)` is `max-height: none; flex-shrink: 0`, so the screen scrolls instead of the panel.
- `tests/ui-settings-toggles.test.ts` (+1) and `tests/ui-controls-panel.test.ts` (1): failing first.

### RECORD

Live captures `docs/qa/cycle45-settings-390.png` and `cycle45-controls-390.png`: all 13 control rows
visible; the 1280x720 controls layout is unchanged (re-captured). Nightmare still wraps to a second
line at 390px, which was judged acceptable.

### Gate results

See the task summary.

---

## Cycle 46 — UI / Phone top HUD

### FIND

At 390px the centred section-name and objectives pills (`.hud-floor`, `.hud-objectives`) ran under the
minimap: "SECTION 1 · FORGOTTEN RU..." and "...Full c" were cut off behind it. This predates the
session's changes; the 390px gameplay capture in Cycle 45's sweep surfaced it.

### IMPLEMENT

- `src/ui/ui.css`: a `max-width: 560px` block left-aligns both pills (`left: 10px`, no transform), caps
  them at `calc(100vw - 140px)` and truncates overflow with an ellipsis; the section name drops to 11px.
  Desktop layout is untouched. The boss bar (top 62px) and the toast block (Cycle 29) do not collide.
- `tests/ui-hud-narrow-top.test.ts`: 2 CSS contract tests, failing first; boss bar, phase tick and
  responsive-layout tests still pass.

### RECORD

Live 390x844 capture `docs/qa/cycle46-hud-390.png`: the full section name sits beside the minimap and the
objectives truncate cleanly. The objectives line loses its tail at this width; it is still in the
Pause and Map screens.

### Gate results

See the task summary.

---

## Cycle 47 — UI / Tablet width (768x1024)

### FIND

A 768x1024 sweep found two flaws:

- Hub: the feats ladder was squashed to a ~22px sliver with its chips cut in half. The hub column is
  taller than the screen, so the flex column shrank the panel (the shrink was latent; Cycle 28's added
  padding made it more visible).
- Gameplay: the bottom-left controls hint ran into the centred vitals panel.

### IMPLEMENT

- `src/ui/ui.css`: `.feats-panel` gets `flex-shrink: 0`. A `561px-1120px` block caps `.hint` at
  `max(120px, calc(50vw - 154px))` so it wraps in the space the vitals plate leaves; because the wrapped
  hint is up to three lines, `.hint.checklist` rises to `bottom: 104px` there (my first pass without
  that made the two hints overprint each other, caught in the recapture).
- `tests/ui-feats-ladder.test.ts` (+1) and `tests/ui-hint-clearance.test.ts` (2). The feats and hint-width
  assertions failed first; the checklist-lift assertion did not get a red run, because its test file had a
  syntax error at the time and the CSS was already applied when it was fixed.

### RECORD

Live captures `docs/qa/cycle47-hub-768.png` (feats ladder shows both rows of chips) and
`cycle47-play-768.png` (checklist above the three-line hint, clear of the vitals plate).

### Gate results

See the task summary.

---

## Cycle 48 — UI / Landscape phone (844x390)

### FIND

An 844x390 sweep found three problems, two of them regressions from this session's earlier cycles:

- Cycle 28 (mine): the feats row scrolls horizontally on short screens, and `justify-content: center` on a
  scrolling flex row makes its first chip unreachable ("teps" was all that showed of "First Steps").
- Cycle 29 (mine): the toast offset `max(16%, 140px)` is right at 720p but pushes toasts 140px down on a
  390px-tall screen, over the arena.
- Pre-existing: the vitals plate (about 220px tall) covered more than half the screen and the player.

### IMPLEMENT

- `src/ui/ui.css`: `.feats-panel` uses `justify-content: safe center`; `.toasts` top is
  `max(16%, min(140px, 24vh))` (still 140px at 720p, 94px at 390px); under `max-height: 480px` the vitals
  plate hides the idle flow meter and the weapon kit line (`.hud-kit`, `.hud-flow.idle`).
- `tests/ui-short-screens.test.ts` (3): all three failed first. `tests/ui-hud-clearance.test.ts` was updated
  to the new toast rule (same intent: toasts stay below the boss bar).

### RECORD

Live captures `docs/qa/cycle48-play-844x390.png` (player visible, plate about 110px tall, toasts higher)
and `cycle48-hub-844x390.png` (feats row starts at "First Steps"). The title menu still needs a scroll at
this height, as before.

### Gate results

See the task summary.

---

## Cycle 49 — Levels / Chicane room layout

### FIND

Ordinary chambers rolled one of seven layouts; none forced a change of direction, so rooms were either
open or dotted with cover.

### IMPLEMENT

- `src/sim/dungeon.ts`: an eighth layout, `chicane`: two offset walls (x -4 above the centre line, x +4
  below it, two tiles tall each) that make a pursuer or the player take an S-shaped route. The centre
  row and column stay open, and the existing blocked-tile checks, reachability prune and big-room
  backstop still apply.
- The chicane first went in as an eighth option, which changed the layout drawn for every room on every
  seed. It now takes the slot of the old `crossing` layout (four diagonal stones, the least distinct of
  the seven) so the roll still draws one value from seven and the random stream after it is untouched.
  What stays true: no seed's later rolls shift. What does not: two of the seven slots hold new layouts
  against HEAD (index 3 was a second `pillars`, now colonnade from Cycle 36; index 5 was `crossing`, now
  chicane), so about two rooms in seven differ from before on a given replay or daily seed. An earlier
  version of this entry claimed only `crossing` rooms changed; a code review caught that. The
  unreachable `crossing` branch was deleted. `tests/sim/layout-seed-stability.test.ts` (3, failing first)
  pins the pick list at seven entries and checks every branch is still rollable.
- `tests/sim/chicane-layout.test.ts`: finds at least three chicane combat rooms across 250 seeds and
  asserts both centre lanes are never walled. Failing first.

### RECORD

Live capture `docs/qa/cycle49-chicane-forest.png` (forest floor, expedition seed 294, combat room 5):
the walls render as trees with the centre lanes open. The shot was taken mid-fight with a toast over it, so
the S-shaped route is only partly visible; no page errors.

### Gate results

See the task summary.

---

## Cycle 50 — Enemies / Pressure Husk

### FIND

After Cycle 38 the Abyss (depth 8) rostered a drowned chaser, a caster and an ambusher, with no heavy that
holds ground.

### IMPLEMENT

- `pressure_husk` (abyss, `tank` brute: 230 HP, 24 damage, speed 48, armor 28, 40 knockback resistance) on
  the brine hulk sheet tinted deep blue at 1.2 scale; in both `enemies.json` copies, wired in
  `src/sim/content.ts` and added to the depth 8 roster; README count is now 89.
- `tests/sim/pressure-husk.test.ts`: brute archetype, tougher and no faster than the brine hulk, roster
  membership and spawning. Failing first.

### RECORD

Live capture `docs/qa/cycle50-pressure-husk-abyss.png` of the abyss floor with husks spawned into a
fight: no page errors. The husks are hard to pick out in the crowd, so this shows the floor spawns
cleanly rather than the husk up close. A later close-up attempt (`docs/qa/cycle50-trench-lurker-closeup.png`) shows the Trench Lurker clearly (teal-tinted
hooded figure) but I could not identify the husk in the frame, so the husk was not yet confirmed there. A second capture
(`docs/qa/cycle50-pressure-husk-closeup.png`, depth 8 combat room, 2x crop) shows it: a squat dark shell with
a green eye-stalk in the blue-teal tint, with telegraph rings and elite crowns around it. The room's own
wave also spawned six husks on its own, so the depth 8 roster wiring is confirmed in live play.

### Gate results

See the task summary.

---

## Cycle 51 — Enemies / New-mob balance guard

### FIND

Cycles 37-50 added six mobs (rubble slinger, thorn spitter, cavern glowmoth, trench lurker, rime thrall,
pressure husk) verified for spawning and roster membership but never for how hard they hit.

### ANALYZE

A headless run stands a fresh 100 HP walker still beside one mob with no input. My first assertion,
"nobody kills an idle walker in 6 seconds", failed for the thrall and the husk, but a baseline run showed
the existing depth 8-12 mobs do the same (drowned, mire halberdier and glass sentinel all deal 100 in 6s).
The threshold was wrong, not the mobs. Damage in 3 seconds: brine hulk 43, rime thrall 42, pressure husk
50, drowned 58, mire halberdier 60, glass sentinel 78.

### IMPLEMENT

- `tests/sim/new-mob-pressure.test.ts` (7): the three frail casters never kill an idle walker within 6s; the
  thrall hits no harder than the glass sentinel; the husk no harder than 1.5x the brine hulk; the frail
  casters hurt less over 10s than the husk. No game data changed.
- This is a characterization guard written after measuring, so it did not run red first.
- Seed sweep: the thrall and husk checks now run on five seeds. The husk reached 66 against the hulk's 43
  on seed 4 (1.53x), so its bound is 1.6x, not the 1.5x seed 21 alone suggested; the casters (20, 26, 34 over
  6s) were identical on all seven seeds tried.
- Correction (Cycle 49 follow-up): the Trench Lurker was first grouped with the light mobs because it
  dealt 49 over 6s on seed 21. After the layout change shifted seed 21's geometry it dealt 100, and a
  seed sweep showed it hits for about 54 per strike (brine hulk 43) with a second strike landing inside 6s
  on three of seven seeds. That is in line with its stats, so no data changed; the guard now compares it
  with the drowned beside it on five seeds (at most 1.25x), and the 6s claim was dropped.

### Gate results

See the task summary.

---

## Cycle 52 — UI / Relic rows on phones

### FIND

The Reforge and Reliquary screens had only been seen empty. Populated with four relics, the 1280x720
Reforge screen is fine, but at 390px the three-column row (slot, text, button) left the text a narrow
middle column: "Echo Dagger +2" and its mods wrapped over four to six lines and the list scrolled inside
its panel with the last row clipped.

### IMPLEMENT

- `src/ui/ui.css`: under `max-width: 560px`, `.gear-row:has(.gear-actions)` becomes `52px 1fr` and its
  `.gear-actions` takes a full-width second row with stretched buttons. Scoped to rows with a button, so
  the inventory's rows are untouched.
- `tests/ui-gear-row-phone.test.ts` (2): failing first; the reliquary tests still pass.

### RECORD

Live captures at 390px (`docs/qa/cycle52-reforge-390.png`, `cycle52-reliquary-390.png`) and 1280px
(`cycle52-reforge-1280.png`): names and mods use two lines at most, buttons are full width and all four
relics fit without scrolling. Populated with echo_dagger (rank 2), crystal_mail, void_cleaver, ember_charm.

### Gate results

See the task summary.

---

## Cycle 53 — Graphics / Frame cost of the new effects

### FIND

Cycles 31 and 32 (torch halos and the colour grade) were never measured for cost; earlier cycles recorded
frame health. A same-session A/B in a torch-heavy depth 0 room toggled each effect over 180 frames, twice:

| Setting (software-rendered Chromium, no GPU) | avg frame | p95 |
| --- | --- | --- |
| everything on | 74-76 ms | 83-100 ms |
| grade off | 59-64 ms | 67 ms |
| torch halos off | 67-69 ms | 83 ms |
| both off | 57 ms | 67 ms |

So the full-screen multiply grade cost about 11-15 ms and the torch halos about 8 ms: roughly +30% frame
time. The figures are inflated by the absence of a GPU, where fill cost is much smaller; they were not
re-measured on a GPU.

### IMPLEMENT

- `src/view/Renderer.ts`: the grade is `this.camera.tint = gradeTint(biome)` instead of a full-screen
  multiply sprite (Pixi 8 containers tint their children), so there is no extra pass. The vignette and hurt
  flash sit outside the camera and stay ungraded.
- `tests/view-colour-grade.test.ts`: the layer assertions became "tint on the camera, no multiply layer, no
  grade field". Failing first.

### RECORD

Repeating the A/B after the change: everything on 57-62 ms against a 56-58 ms baseline, so the grade's cost
is within noise. The torch halos still cost about 1-5 ms across two runs (noisy), so they stay.
Capture `docs/qa/cycle53-grade-camera-tint.png`: the ruins room keeps its warm grade.

### Gate results

See the task summary.

---

## Cycle 54 — Enemies / Rivet Squire

### FIND

The Foundry (depth 6) rostered a hound, a wisp, a bomber and a golem: no plain melee fighter to hold the
line while the others work.

### IMPLEMENT

- `rivet_squire` (foundry, `chase` melee: 150 HP, 19 damage, speed 100, armor 14) on the bone knight sheet
  tinted forge amber; in both `enemies.json` copies, wired in `src/sim/content.ts` and added to the depth 6
  roster; README count is now ninety.
- `tests/sim/rivet-squire.test.ts` (2): melee chaser, lighter and faster than the slag golem, roster and
  spawning; failing first. `tests/sim/new-mob-pressure.test.ts` (+1): the squire hits no harder than 1.5x
  the golem over 3s on five seeds. That guard was written alongside the data and passed on the first run.

### RECORD

Live capture `docs/qa/cycle54-rivet-squire-foundry.png` (depth 6): squires chase and attack, golems wind up,
no page errors.

### Gate results

See the task summary.

---

## Cycle 55 — Enemies / Wax Crawler

### FIND

The Hive (depth 15) rostered a drone, a guard, an oracle and a slinger: casters and a tank, but no fast
skirmisher to pressure a walker between volleys.

### IMPLEMENT

- `wax_crawler` (hive, `hit_and_run` skirmisher: 90 HP, 21 damage, speed 135, armor 6) on the cog hound
  sheet tinted wax gold; in both `enemies.json` copies, wired in `src/sim/content.ts` and added to the
  depth 15 roster; README count is now ninety-one. Deliberately frailer than the cog hound it borrows its
  sheet from (210 HP, 34 damage): it trades toughness for speed.
- `tests/sim/wax-crawler.test.ts` (2): skirmisher archetype, under half the hive guard's health and faster,
  roster and spawning; failing first. `tests/sim/new-mob-pressure.test.ts` (+1): over 3s the crawler hits no
  harder than 1.25x the hive guard on five seeds (written with the data; it passed on the first run).

### RECORD

Live capture `docs/qa/cycle55-wax-crawler-hive.png` (depth 15): crawlers attack, recover and wind up beside
hive guards, no page errors. A temporary random-play soak over all 23 depths (about 147,600 steps) ran
clean just before this cycle and was not kept.

### Gate results

See the task summary.

---

## Cycle 56 — UI / Phone difficulty row

### FIND

Cycle 45 left "Nightmare" wrapping onto a second line on the 390px Settings screen, which I accepted at the
time. The row only has about 210px beside its "Difficulty" label.

### IMPLEMENT

- First attempt (rejected): tighter padding with `flex-wrap: nowrap` clipped the button to "NIGHTM", worse
  than wrapping, as the recapture showed. It was replaced before anything else was built on it.
- `src/ui/ui.css`: under `max-width: 560px` the difficulty row is one column, so the label takes its own
  line and the three buttons share the full width (`flex: 1`, no wrap).
- `tests/ui-difficulty-row.test.ts` (1). The first version of the test went red; the test was rewritten
  for the second design after the CSS, so the final form did not run red first.

### RECORD

Live 390x844 capture `docs/qa/cycle56-settings-390.png`: Story, Normal and Nightmare in one row, all labels
intact, toggle rows below unchanged.

### Gate results

See the task summary.

---

## Cycle 57 — UI / Landscape-phone title menu

### FIND

At 844x390 the title screen needed scrolling to reach its lower buttons (noted as "as before" in Cycle 48):
the six stacked menu buttons plus title and hints are taller than the screen.

### IMPLEMENT

- `src/ui/ui.css`: under `max-height: 480px` the title menu is two columns with the primary action across
  the top, buttons use `padding: 8px 12px` and 14px type, and the small kicker line above the title is
  hidden. Taller screens are untouched.
- `tests/ui-title-short.test.ts` (2): failing first.

### RECORD

Measured `scrollHeight` against `clientHeight` of the title screen: 844x390 gives 390/390, 667x375 gives
375/375 and 1280x720 gives 720/720, so it fits at both landscape-phone sizes with no scroll and the desktop
layout is unchanged. Capture `docs/qa/cycle57-title-844x390.png`. The menu's last row has one lone button
(Controls); I left that rather than add a seventh item or restructure the menu.

### Gate results

See the task summary.

---

## Cycle 58 — UI / Landscape-phone upgrade choice

### FIND

A scroll-height sweep of every screen at 844x390 showed the in-run upgrade choice at 464px against a 390px
screen: the Reroll button and the "Click a card" hint fell off the bottom in the middle of a run. The same
sweep measured Controls 697, Hub 651, Aspect Shrine 530 and Set Out 394; those are lists and menus that
scroll by design and were left alone. Settings, Memories, Reforge and the death screen fit exactly.

### IMPLEMENT

- `src/ui/ui.css`: under `max-height: 480px`, `.card` drops `min-height` and takes `padding: 10px 14px` and a
  6px gap, the emblem shrinks to 36px, the name needs one line instead of two (17px) and the card row gap
  is 12px. The two-line title reservation from Cycle 42 still applies on taller screens.
- `tests/ui-choice-short.test.ts` (1): failing first; the Cycle 42 and rarity tests still pass.

### RECORD

Measured after the change: the choice screen is 390/390 at 844x390. Capture
`docs/qa/cycle58-choice-844x390.png`: three cards, the Reroll button and the hint all on screen, and
"Quickened Arm" on one line.

### Gate results

See the task summary.

---

## Cycle 59 — UI / Landscape-phone controls list

### FIND

Cycle 58's sweep measured the Controls screen at 697px on a 390px landscape screen: thirteen stacked key
rows, then the tips paragraph.

### IMPLEMENT

- `src/ui/ui.css`: under `max-height: 480px` the controls panel is `min(920px, 96vw)` wide and `.controls`
  has four columns (`auto 1fr auto 1fr`), so key and action pairs sit two to a row, at 13px.
- `tests/ui-controls-short.test.ts` (1): failing first; the Cycle 45 panel test still passes.

### RECORD

Measured after the change: 546px (from 697). Capture `docs/qa/cycle59-controls-844x390.png`: all thirteen
rows on the first screenful in two columns; the tips paragraph is below and still needs a scroll. The hub
(651px) and Aspect Shrine (530px) are still scrolling menus at this height and were not changed.

### Gate results

See the task summary.

---

## Cycle 60 — UI / Landscape-phone hub

### FIND

At 844x390 the hub's six resident cards wrapped four plus two and the page measured 651px, so Set Out sat
well below the fold on the screen players see between every run.

### IMPLEMENT

- `src/ui/ui.css`: for `min-width: 700px` and `max-height: 480px`, `.building-grid` is
  `repeat(6, 1fr)` with a 6px gap and 13px names. Narrow portrait phones keep their single column.
- `tests/ui-hub-short.test.ts` (1): failing first.

### RECORD

Measured after the change: 546px (from 651). Capture `docs/qa/cycle60-hub-844x390.png`: six residents in one
row, the feats row and the Set Out button visible without scrolling. The Aspect Shrine (530px) and Set Out
(394px) screens still scroll slightly and were left alone.

### Gate results

See the task summary.

---

## Cycle 61 — Docs / No touch controls

### FIND

While polishing phone layouts (Cycles 45-60) it became clear that `src/input/Input.ts` handles keyboard,
mouse and gamepad only: there are no touch or pointer handlers and no on-screen controls, so the game
cannot be played on a phone or tablet without one of those devices. The README said only "Keyboard and
mouse or gamepad."

### IMPLEMENT

- `README.md`: that bullet now says there are no touch controls yet and that phones and tablets get fitted
  menus and HUD but need a keyboard, mouse or gamepad to play.
- No code change. Touch controls (virtual stick, aim and attack, dash, bolt, potion, stance buttons) are a
  design decision and are not built; the phone-width cycles make the UI readable, not playable.

### Gate results

See the task summary.

---

## Cycle 62 — Input / Touch controls

### FIND

Cycle 61 recorded that the game had no touch input at all, so every phone-width cycle made menus readable
but the game itself unplayable without a keyboard, mouse or gamepad.

### IMPLEMENT

- `src/input/touch.ts`: a DOM-free `TouchState`. `stickVector` turns a thumb offset into a direction with
  length 0..1 (18% dead zone). The left stick moves; the right stick aims and holds attack while pushed and
  keeps its last aim when it drifts into the dead zone; dash, flask, use and the weapon art latch until a
  sim step consumes them; bolt is held while pressed; the stance button cycles 0, 1, 2.
- `src/input/Input.ts`: `input.touch` is merged into `frame()` (touch move wins over keys and pad, touch aim
  is relative to the walker, held and latched actions are OR-ed in) and `releaseAll()` clears it, so opening
  a menu cannot leave a stuck stick. Keyboard, mouse and gamepad behaviour is unchanged.
- `src/ui/TouchControls.ts`: the overlay. Each finger is tracked by pointer id with pointer capture, so both
  thumbs work at once. It is mounted inside the HUD, so it hides with it on menus and the title.
- `src/ui/ui.css`: hidden by default and shown under `@media (pointer: coarse)`, so desktop is untouched.
  Landscape: sticks at the bottom corners, buttons above the right stick. Portrait: the sticks sit above the
  full-width vitals plate and the buttons sit between them, because a right-hand cluster covered the walker
  at screen centre (found in the first portrait capture). The keyboard and mouse hint panel is hidden on
  touch, where it only sat under the move stick.
- `README.md` updated (Cycle 61's "no touch controls" wording was replaced).
- Tests: `tests/input-touch.test.ts` (8), `tests/input-touch-merge.test.ts` (6) and
  `tests/ui-touch-controls.test.ts` (7), each failing first except where noted below.

### RECORD

Driven with real touch events through a mobile-emulated Chromium (`has_touch`, `is_mobile`, coarse pointer
true) using the DevTools `Input.dispatchTouchEvent`: the overlay displays; a left-stick push moved the
walker 165-195 px; adding a second finger on the right stick aimed up (-1.57 rad) and the walker's action
became `attack` while it kept moving; releasing both fingers stopped it, in both 844x390 and 390x844. No
page errors. Captures `docs/qa/cycle62-touch-844x390.png` and `cycle62-touch-390x844.png`.

### Not done and not verified

- Bombs and traps have no touch button. The stance button reads the held weapon from the world.
- Only emulated touch was tested: no real device, no multi-touch gestures beyond two fingers, no check of
  thumb comfort, button size against real hands, accidental palm touches or iOS Safari behaviour.
- Tapping empty canvas still produces compatibility mouse events (an attack toward the tap); left as is.
- One portrait assertion (`.touch-buttons` in the narrow block) found no rule on its first run and was
  green once the CSS existed; the others went red on missing code.

### Gate results

See the task summary.

---

## Cycle 63 — Input / Touch bomb and trap buttons

### FIND

Cycle 62 left bombs and traps without a touch button, so a touch player could not use two of the game's
tactical tools.

### IMPLEMENT

- `src/input/touch.ts`: `bomb` and `trap` join the latched one-shots; `src/input/Input.ts` ORs them into the
  frame; `src/ui/TouchControls.ts` adds Bomb and Trap buttons (eight in all).
- `src/ui/ui.css`: landscape lays the buttons four across (two rows); portrait uses three 40px columns
  (three rows). A first portrait try with two columns put the bottom row over the left stick, which the
  recapture showed, so it became three.
- README updated: the "no bomb or trap button" caveat is gone. Tests: state and merge cases added to
  `tests/input-touch*.test.ts` (failed first) and layout assertions to `tests/ui-touch-controls.test.ts`.

### RECORD

With real emulated touches, tapping Bomb and Trap changed the walker's counts from 2 and 1 to 1 and 0, in
both 844x390 and 390x844; the HUD then read "Bomb x1 · Trap x0" and the toast "Trap armed". Captures
`docs/qa/cycle63-touch-bomb-trap-*.png`.

Still unverified: real devices, thumb comfort and button size, palm rejection, iOS Safari.

### Gate results

See the task summary.

---

## Cycle 64 — Input / Touch taps are not clicks

### FIND

Cycle 62 noted that tapping empty canvas on a touch screen still produced the browser's compatibility mouse
events, which `Input` read as a left click and so as an attack toward the tap.

### IMPLEMENT

- `src/input/Input.ts`: a `pointerdown` listener records whether the last pointer was touch, and the
  `mousedown` handler returns early in that case. Real mouse clicks and the no-pointer-event path are
  unchanged.
- `tests/input-touch-tap.test.ts` (3): the touch case failed first; the mouse cases passed throughout.

### RECORD

In an emulated browser a touch tap on empty canvas left the walker's action out of `attack`, and a mouse
click in a desktop context still produced it. The mouse `mousemove` aim path was not changed.

### Gate results

See the task summary.

---

## Revert — bottom-centre vitals panel

At the user's request the vitals panel (`.hud-vitals`) is back to its original look: `gap: 6px`,
`padding: 10px 14px 9px` and the `0.88 / 0.94` plate from before Cycle 29, and the short-screen block from
Cycle 48 that hid the idle flow meter and the weapon kit line is removed. Nothing else changed: the toast
offset (Cycle 29) and the feats and toast fixes of Cycle 48 stay. `tests/ui-hud-clearance.test.ts` now pins
the original values and `tests/ui-short-screens.test.ts` drops its vitals test. Cycle 29 and 48 entries above
describe the superseded vitals changes.

---

## Cycle 65 — Input / Touch menus

### FIND

Cycles 62-64 gave a touch player sticks, combat buttons, bomb and trap, and stopped stray taps from
attacking, but the relic bag, map and pause menu still needed a keyboard (I, Tab and Esc), so a phone
player could not open any of them.

### IMPLEMENT

- `src/ui/TouchControls.ts`: a new `TouchMenuAction` (`pause`, `map`, `inventory`) and a third argument
  `onMenu`. A `touch-utility` rail with Relics, Map and Menu buttons calls `touch.reset()` before opening
  a panel, so no stick or latch is left queued behind the screen.
- `src/app/App.ts`: the overlay is built with `(action) => this.onMenu(action)`, the same handler the
  keyboard and gamepad use; the rail opens the existing inventory, map and pause screens unchanged.
- `src/ui/ui.css`: the rail sits top-left (`left: 12px; top: 12px`) with 44px buttons, hidden with the
  overlay everywhere but coarse pointers. In portrait the floor and objective pills are pinned to the
  left edge, so the rail drops to `top: 68px` to clear them.
- Tests: `tests/ui-touch-utility.test.ts` (6), failing first on the missing rail.

### RECORD

Driven with real touch events through a mobile-emulated Chromium at 844x390 and 390x844: tapping Relics
opened the Relics screen, Map opened the section map with the HUD dimmed, Menu opened Paused, and Resume
put the walker back in the room. In portrait the rail sits below the floor and objective pills with no
overlap (measured `util` at y 68, pills ending at y 61); a first capture showed the old top 12px position
overlapping both pills and motivated the offset. Captures `docs/qa/cycle65-touch-utility-844x390.png`,
`cycle65-touch-utility-play-844x390.png` and `cycle65-touch-utility-390x844.png`.

Still unverified: real devices, safe-area insets on notched phones, and whether the 44px rail buttons are
comfortable next to the two 112px sticks.

### Gate results

See the task summary.

---

## Cycle 66 — Input / Touch safe areas

### FIND

Cycle 65 put the touch rail and sticks at fixed offsets. On a notched phone or a gesture-bar
Android that leaves the sticks, the action cluster and the top pills under the cutout or the home bar,
and the page meta did not request the full screen, so the inset variables would have been zero anyway.

### IMPLEMENT

- `index.html`: `viewport-fit=cover`, so the browser reports real insets.
- `src/ui/ui.css`: `--safe-top/right/bottom/left` from `env(safe-area-inset-*)` with `0px` fallbacks
  on the root, then used by the touch sticks, the action cluster, the utility rail, the minimap, the
  floor and objective pills and the vitals plate. The phone-width overrides (`max-width: 560px` and
  `pointer: coarse and max-width: 560px`) and the sanctuary expedition bar use the same variables. The
  portrait vitals width subtracts the side insets so the full-width plate never runs under a cutout.
- Tests: `tests/ui-safe-area.test.ts` (7), failing first; `tests/ui-touch-utility.test.ts`,
  `tests/ui-touch-controls.test.ts`, `tests/ui-hud-narrow-top.test.ts` and
  `tests/ui-responsive-layout.test.ts` now pin the inset-aware values instead of the old fixed ones.

### RECORD

In mobile-emulated Chromium the four variables were overridden to a notch-like set
(top 47, bottom 34, sides 44) at 390x844 and to a landscape set (sides 47, bottom 21) at 844x390.
Every measured element moved by exactly its inset: the rail from x 12 to 56, the floor pill from
y 14 to 61, the sticks from x 16/right 16 to 60/right 62, the minimap from right 677 to 630, and the
vitals plate up by the bottom inset. At 844x390 the vitals stayed 372 wide because the insets were on
the sides, as intended. Capture `docs/qa/cycle66-safe-area-simulated-390x844.png`.

Still unverified: hardware with a real notch, iOS Safari's dynamic toolbar, and whether 44px of side
inset in landscape crowds the action cluster on smaller phones.

### Gate results

See the task summary.

---

## Cycle 67 — Input / Touch field manual, and the short Set Out screen

### FIND

Two follow-ons to the touch work. The field manual still said "Strike with LMB" and "Equip a relic
with I" on a phone, and the generic `.hint` rule hid the whole manual on coarse pointers, so a touch
player lost the one piece of onboarding they needed. Separately, at 844x390 the Set Out screen was
broken for every input method: the flex column shrank the panels, `.checkpoint-list` measured 26px
tall, its nine Start buttons painted outside the clip and a tap on "Begin at Section 1" hit the
`.meta-line` instead (verified with `elementFromPoint`).

### IMPLEMENT

- `src/sim/run.ts`: `ONBOARDING_STEPS` carries a pointer label and a touch label; `nextOnboardingStep`
  takes an optional `touch` flag. Pointer wording is byte-identical to before.
- `src/ui/Hud.ts`: reads `matchMedia('(pointer: coarse)')` once and passes it in.
- `src/ui/ui.css`: on coarse pointers the manual re-shows above the move stick
  (`bottom: calc(var(--touch-bottom, 16px) + 122px + var(--safe-bottom))`) instead of inheriting the
  hidden `.hint` rule. A `max-height: 480px` block stops `.screen.hub > *` from shrinking, lets the
  panels keep their height, and compacts each checkpoint to one row with the flavour note dropped.
  `.cp-name` becomes a block so `text-overflow: ellipsis` works; the longest name ("Section 19 · Echo
  Arena: The Sunken Colosseum") had overlapped its button.
- Tests: `tests/sim/onboarding-touch.test.ts` (7), `tests/ui-expedition-short.test.ts` (3).

### RECORD

Touch run at 844x390: the manual read "Field manual — next: Strike with the right stick" at
(12,214) 260x38, clear of the move stick at y 262 and the vitals at x 298. Set Out at 844x390: the
screen now scrolls (1129px of content in 390), every checkpoint row is 44px, no name overlaps its
button, and tapping "Begin at Section 1" after scrolling it into view started the run (the screen
cleared and the HUD appeared). Captures `docs/qa/cycle67-touch-manual-844x390.png` and
`cycle67-short-expedition-844x390.png`.

Still open: the Set Out screen needs a scroll before the list is visible on a 390px-tall landscape
phone, which is workable but not ideal; a two-column checkpoint grid on short screens is the obvious
next step.

### Gate results

See the task summary.

---

## Cycle 68 — Layout / Set Out order and the two-column short screen

### FIND

Cycle 67 made the Set Out screen scroll instead of clipping, but the order still buried the useful
part: on a 390px-tall landscape phone the saved run, the checkpoint list and its Start buttons sat
below the difficulty and daily panels, so the first screenful was difficulty copy and the list began
at y 406. Nine stacked 44px rows then needed most of a second screenful.

### IMPLEMENT

- `src/ui/Screens.ts`: the saved-run panel and the checkpoint list now come directly after the
  subtitle; the difficulty and daily panels follow them. No markup or handler changed, only child
  order, so both screens keep their existing buttons and ids.
- `src/ui/ui.css`: a `min-width: 700px and max-height: 480px` block turns the Set Out screen into a
  two-column grid (heading, saved run, list, footer spanning both), lets the two daily panels share a
  row, and pairs the checkpoint rows two per line with the button stacked under its name. The
  subtitle is hidden only on short screens.
- Tests: `tests/ui-expedition-short.test.ts` grows to 7 (order, grid, paired rows, button column).

### RECORD

At 844x390 the first Start button is now at y 198 and fully clickable (`elementFromPoint` returned the
button itself), the list is 350px in two 386px columns, and the page is 711px tall instead of 1129.
At 1440x900 the desktop stack is unchanged apart from the new order: the list sits above the
difficulty and daily panels and the whole screen fits in 900px. At 390x844 the list keeps one column.
Captures `docs/qa/cycle68-setout-grid-844x390.png`, `cycle68-setout-desktop.png` and
`cycle68-setout-portrait.png`.

Follow-up in the same cycle: the two daily panels first measured 75px and 103px and were centred in
their row, because the base `.screen { align-items: center }` leaks into a grid. `align-items: stretch`
on the grid evens them at 103px, and the halved panel then squeezed "Begin the daily" to three stacked
lines, so that button gets `flex-shrink: 0; white-space: nowrap` (29px tall, one line). Capture
`docs/qa/cycle68-setout-dailies-844x390.png`.

Follow-up, scoping bug found while auditing the other hub screens: three of them (Meditation Stone,
Notice Board, Training Yard) also use `.screen hub`, so the new short-screen grid leaked into them and
pushed their headings and menus off-centre (Notice Board heading at x 554, menu to x 1023 at 844x390).
The Set Out screen is now tagged `screen hub set-out` and both `max-height: 480px` blocks are scoped to
`.screen.hub.set-out`. Re-measured at 844x390: Meditation Stone, Notice Board and Training Yard are all
flex again with their headings centred at x 422 and no horizontal overflow; the Notice Board still
scrolls (607px of content) as before this cycle. Capture
`docs/qa/cycle68-setout-scoped-844x390.png`.

### Gate results

See the task summary.

---

## Cycle 69 — Accessibility / reduced motion

### FIND

The game has 42 animations and a heavy canvas layer, but no reduced-motion support: the only
`prefers-reduced-motion` rules covered a single quest badge and a couple of one-shots. Screen shake and
the hurt flash existed as Settings toggles, but a player who had already asked their OS to reduce
motion still started with both on.

### IMPLEMENT

- `src/save/SaveStore.ts`: `defaultSettings()` folds in `prefers-reduced-motion`, turning the camera
  shake and hurt flash off on a fresh save; every stored value still wins. `SettingsSchema` defaults for
  those two fields (and for a whole missing settings block) are now lazy, so a save written before a
  field existed also picks up the OS preference instead of the hardcoded `true`.
- `src/ui/ui.css`: the reduced-motion rules are consolidated into the one block that already existed,
  now covering `.screen`, `.card`, `.card.epic .card-emblem`, `.gear-row.attuned`, `.chip.stalked`,
  `.quest-badge.ready`, `.boss-bar.enraged .bar-fill` and `.title`, plus hover lifts. `@keyframes lore`,
  `toast` and `banner` are redefined without travel: toasts, memory cards and floor banners must still
  disappear on time, so they keep their opacity windows and lose only the slide and letter-spacing sweep.
- Tests: `tests/save-reduced-motion.test.ts` (6, including matchMedia absent) and
  `tests/ui-reduced-motion.test.ts` (5) know the difference between "switched off" and "fades without
  travel".

### RECORD

Chromium with `prefers-reduced-motion: reduce` at 1280x800: the title and the primary button report
`animationName: none`; Settings opens on a fresh save with Screen shake and Hurt flash unchecked while
Damage numbers and Auto-pause stay checked; with `no-preference` all four stay checked. Probing the real
computed keyframes: reduced motion gives `toast` frames at opacity 0/1/1/0 with `transform: none`, `lore`
centred at `translate(-50%)` throughout, and a pure-opacity `banner`; normal motion still returns
`translateY(8px)` and `translate(-50%, 10px)`.

Note: the first attempt shipped a second reduced-motion block that a later one silently overrode; the
browser probe is what caught it, and the CSS now has the rules in one place.

### Gate results

See the task summary.

---

## Cycle 70 — Accessibility / text contrast audit

### FIND

No contrast audit existed; the palette had been hand-patched once but never measured. A DOM audit
(walk every visible element with its own text, composite its computed colour over the nearest painted
ancestors, apply WCAG AA thresholds) found one real failure: an empty bag slot rendered
"Empty slot" and its hint at 2.08:1, because the whole row sat at `opacity: 0.6` and the slot number
was `rgba(255, 255, 255, 0.4)`. Every other screen - title, hub, Set Out, Settings, Controls, Notice
Board, Training Yard, Meditation Stone, Reliquary, Cairn, Aspect Shrine, Reforge, Memories, the
prologue and the in-run HUD - passed AA.

### IMPLEMENT

- `src/ui/ui.css`: `.gear-row.empty` keeps its dashed outline and bare background but no longer fades
  the row; its slot number, name and hint use `--ink-dim` (10.29:1 on a panel). The empty affordance is
  the dashed frame, not unreadable text.
- Tests: `tests/ui-contrast-tokens.test.ts` (4). It computes WCAG ratios for every text token on both
  the page and a composited `--panel`, requires `--ink-dim` to clear 7:1 because it is used at 10-11px,
  rejects any `color: rgba(255, 255, 255, <0.6)`, and pins the empty-slot rule.

### RECORD

The audit ran in Chromium at 1280x800 with gradient-clipped text excluded (its computed colour is
transparent). Measured after the fix: the empty rows report `opacity: 1` and `rgb(194, 184, 210)` for
slot, name and description. Arithmetic for the old state: 40% white multiplied by the row's 60%
opacity over the panel gives 2.08:1; `--ink-dim` gives 10.29:1.

Caveat: this environment cannot display images, so the captures
(`docs/qa/cycle70-hud-contrast-1280x800.png`, `cycle70-bag-empty-slots-1280x800.png`) were not reviewed
by eye; the verification is the computed-style and WCAG measurements above.

### Gate results

See the task summary.

---

## Cycle 71 — Accessibility / keyboard focus

### FIND

Keyboard traversal worked, but two gaps showed up when tabbing the Settings screen for real. The screen
opened focus on the first `button`, which is the difficulty segmented control, so the three volume
sliders sat *behind* the starting point and were skipped on the first pass. And sliders and checkboxes
had no explicit focus style: Chromium's UA ring computes to `rgb(16, 16, 16)`, which is invisible on the
dark panel.

### IMPLEMENT

- `src/ui/Screens.ts`: `Screens.show` focuses the first `button, .card, input`, so Settings starts on
  Master volume and Tab walks sliders, then difficulty, then the four checkboxes, then Back.
- `src/ui/ui.css`: sliders and checkboxes get the same `2px solid var(--cyan)` ring as buttons, with a
  3px offset so the ring clears the control.
- Tests: `tests/ui-focus-visible.test.ts` (3) pins the shared button/card/gear ring, the input ring, and
  the focus selector.

### RECORD

Opening Settings with Enter (keyboard modality) focuses the Master volume range input with computed
`outline: solid 2px rgb(111, 231, 255)` at `3px` offset; Tab then reaches Music, Effects, the three
difficulty buttons, the four checkboxes and Back, each showing the same cyan ring. Two ArrowRight
presses moved the value from 80 to 82, so the sliders are fully keyboard-operable. The mouse path
deliberately shows no ring until Tab is pressed, which is the standard `:focus-visible` behaviour.

Caveat: captures (`docs/qa/cycle71-settings-focus-1280x800.png`) cannot be reviewed by eye here; the
values above are computed styles and element state.

### Gate results

See the task summary.

---

## Cycle 72 — Input / gamepad buttons pressed in a menu

### FIND

The keyboard path deliberately refuses to latch a gameplay action while a DOM screen is open, with the
comment that it must not "fire the moment the screen closes". The gamepad path had no such guard:
`pollGamepad()` runs every animation frame regardless of state, but the one-shot latches are only
cleared by `input.frame()`, which runs only while playing or in the sanctuary. So pressing A, X, Y, LB,
L3, R3 or a D-pad direction in the pause menu, map, relics, hub or title left an action queued that
fired on the first frame after the screen closed.

### IMPLEMENT

- `src/input/Input.ts`: Start/Back/B edges still route to `onMenu` while a screen is open; the gameplay
  edges (dash, potion, interact, bomb, trap, art, weapon) now apply only when no `.screen` is mounted,
  matching the keyboard rule.
- Tests: `tests/input-gamepad-menu.test.ts` (3), written failing first. It holds seven combat buttons
  through an open screen and proves no latch survives the close, checks the three menu buttons still
  route, and checks a fresh press after the screen closes still latches.

### RECORD

Before the fix, the reproduction test failed exactly as predicted: after opening a screen, pressing A,
releasing it, closing the screen and taking one input frame, `frame.dash` was still `true`. After the
fix all three cases pass, and the existing keyboard, touch-merge and touch-tap input suites (12 tests)
stay green.

### Gate results

See the task summary.

---

## Cycle 73 — Safety / two-press Abandon Run

### FIND

"Abandon Run" sat one click away from Controls in the pause menu and ended the expedition on the first
press: it recorded the run, cleared the saved snapshot and returned to the hub, with no confirmation. The
Relics screens had already solved this with a two-press "Confirm sale",
hand-rolled four separate times.

### IMPLEMENT

- `src/ui/Screens.ts`: one `confirmButton(label, confirmLabel, onConfirm, cls)` helper. It arms on the
  first press, adds the `danger` class, disarms itself after `CONFIRM_WINDOW_MS` (2600 ms) and fires only
  on the second. The relic-market sell, the inventory sell, the sell-commons button and the inventory
  discard button now use it, and Abandon Run is
  `confirmButton('Abandon Run', 'Confirm abandon', opts.onAbandon)`.
- Tests: `tests/ui-confirm-actions.test.ts` (4) pins the shared helper, all five call sites, and the
  absence of the old `sellArmed`/`junkArmed`/`discardArmed` flags and the direct abandon wiring.

### RECORD

Chromium at 1280x800. One click on Abandon Run turned it into "Confirm abandon" with the danger class,
left the pause screen up and kept `memory-reconstruction.run.v1` intact; Resume returned to Section 1
with the HUD live. Waiting 2.9 s disarmed it back to "Abandon Run" without the danger class. A second
click on an armed button cleared the snapshot and returned to the sanctuary hub. The four existing
destructive buttons (market sell, inventory sell, sell-commons, discard) were refactored verbatim onto
the same helper; the full suite stays green. The refactored paths were then exercised in the real
bag screen: with two injected commons, one click armed "Sell · 8" as "Confirm sale" and the
second produced "Sold Rusted Edge for 8 shards."; "Discard" armed as "Confirm" and the second
press produced "Discarded Scavenger's Vest." with ten empty slots again.

### Gate results

See the task summary.

---

## Cycle 74 — Robustness / corrupted save fuzzing, depth clamp

### FIND

There was no adversarial coverage of the save boundary beyond a handful of hand-written cases. A
fuzzer that mutates a real run and meta (dropped fields, wrong types, nulls, arrays turned into
scalars) and feeds them through `restoreRun` and `SaveStore.loadMeta` survived 6,000 cases. A separate
semantic probe found a real defect the type checks could not: JSON can carry `1e300`, which is a
`number`, so a snapshot with `depth: 1e300` loaded and the HUD rendered "Section 1e+300 · The First
Remembering".

### IMPLEMENT

- `src/sim/run.ts`: `restoreRun` clamps depth to a real section (`Math.floor`, `0..FINAL_DEPTH`)
  before anything reads it; a depth that is not a number at all still rejects the snapshot, as before.
- Tests: `tests/save-fuzz.test.ts` (4). It fuzzes 3,000 runs and 3,000 metas through the real loader
  (mutated values are JSON round-tripped first, because that is what `localStorage` can actually
  return), asserts no throw and checks post-load invariants, and pins the depth clamp for huge,
  fractional, negative, valid and non-numeric values.

### RECORD

Before: injecting `depth: 1e300` into the saved run and pressing Continue showed
"Section 1e+300 · The First Remembering" in the HUD. After: the same snapshot loads as
"Section 23 · The First Remembering", and the persisted snapshot is rewritten with `depth: 22` (the
final section index). The fuzzer's first two iterations failed on its own harness bugs (a non-exported
helper, then NaN that JSON cannot represent); both were fixed in the harness rather than weakening the
assertions, and the remaining run is clean over 6,000 cases.

### Gate results

See the task summary.

---

## Cycle 75 — Robustness / world fuzzing, and a README drift guard

### FIND

The save fuzzer covered loading but not the next step a player takes: building and stepping the world
from that snapshot. Separately, the README's numeric claims (section, biome, enemy, boss, upgrade,
fragment, checkpoint and sanctuary counts) had no test tying them to the data, so content edits could
silently make the front page wrong.

### IMPLEMENT

- `tests/world-fuzz.test.ts` (2): 400 mutated snapshots are loaded, and every accepted one is built
  into a `World` and stepped for 60 sim steps; the test also asserts a world builds and steps at every
  section depth from 0 to `FINAL_DEPTH`, and that at least 200 mutations survive the loader so the pass
  cannot go vacuous.
- `tests/docs-claims.test.ts` (7): derives each README number from the code and the data files and
  asserts the exact sentence - 23 sections, 4 echo trials, the nine checkpoints (1, 4, 7, 10, 13, 16,
  19, 22, 23), 16 biomes / 91 enemies / 23 bosses / 4 unique Trial guardians, 24 upgrades, 35 fragments
  and 11 core memories, eight sanctuary places, the Cairn's three offerings carrying 45 shards and the
  Reforge's three ranks at +12%. It also checks the documented `window.__MR__` handle is still published
  by `src/main.ts` and still referenced by the README and the agent guide.

### RECORD

Every README number matched the data on the first run, so this cycle adds a guard rather than a
correction. The world fuzz pass accepted well over 200 of 400 mutations and built and stepped each of
them, plus all 23 depths, with no throw. Two scratch probe tests used to read the real constants were
deleted after the numbers were transcribed into the guard.

### Gate results

See the task summary.

---

## Cycle 76 — Data integrity / NPC, quest, bounty, feat and omen references

### FIND

The floor plans and memory fragments already had integrity tests, but the remaining hardcoded tables
did not. `DAILY_BOUNTY_POOL` in particular hardcodes eight enemy ids, their plural display names and a
twelve-kill contract with no check that the ids still resolve, that a floor still spawns them, or that
the display names still match the bestiary. A renamed or removed enemy would leave a daily contract that
can never be completed - or that prints the wrong name.

### IMPLEMENT

- `tests/sim/content-references.test.ts` (9):
  - every quest's `npcId` exists in `NPCS`, every NPC has exactly one quest, quest ids are unique, and
    every `rewardItem` resolves through `equipmentDef`;
  - across eight consecutive daily keys the bounty pool yields eight distinct ids, each resolves to a
    non-boss enemy, each display name equals the bestiary name plus "s", each id is on some floor's
    roster or boss slot, the contract is 12 kills for 250 echoes, and the pool repeats on its eight-day
    cycle and is stable within a day;
  - feat ids and modifier ids are unique, and feat names and text are non-empty.

### RECORD

Every existing reference resolved on the first run. The new spawnability check is the meaningful one:
it turns "the pool ids exist" into "the daily contract can actually be finished", which the earlier
tests never asserted. All nine assertions pass against the current data.

### Gate results

See the task summary.

---

## Cycle 77 — Robustness / non-finite device input froze the walker

### FIND

Device input reached the simulation unsanitised. A frame with a NaN aim -
the shape a faulty gamepad axis or a buggy input shim would send - set the
player's aim angle to NaN, and `startSwing` then added `Math.cos(NaN) * 110` to
the walker's knockback. Knockback decays by multiplication, so NaN survived
forever; `moveAndCollide` computes its sub-steps as
`Math.ceil(Math.max(|dx|, |dy|) / MAX_STEP)`, and a NaN step count makes the
collision loop run zero times. The walker could no longer move for the rest of
the run, while aim and input kept updating. Reproduced headlessly: one
NaN-aim swing left `knockX`/`knockY` non-finite, and ten subsequent clean
frames left the position exactly unchanged.

### IMPLEMENT

- `src/sim/world.ts`: `World.step` passes the frame through a new `safeInput`
  helper. A finite frame is returned untouched (so simulation parity and the
  recorded tests are unchanged); a non-finite stick axis becomes 0 for that
  frame, and a non-finite aim keeps the current facing instead of aiming at the
  world origin.
- Tests: `tests/sim/input-nan.test.ts` (4), written failing first: the NaN-aim
  swing case asserted finite knockback and movement recovery; it failed on
  `isFinite(knockX)` before the fix and all four pass after. Also covers
  infinite axes, a NaN/Infinity movement frame, and exact parity for finite aim
  angles (0 and -PI/2).

### RECORD

Before the fix, the reproduction test printed `knock: [null, null]`
(JSON for two NaNs) and `moved: false` after ten clean frames. After the fix
the same scenario keeps knockback finite and the walker moves again. Full
suite 704 tests (162 files) passes, including all 410 mechanics tests, so the
sanitisation does not change simulation results for ordinary input.

### Gate results

See the task summary.

---

## Cycle 78 — Robustness / random-play invariants

### FIND

The mechanics tests drive the simulation through known scenarios. Nothing threw thousands of random
input frames at a live world, so combination effects (dash into a wall while a boss charges, a bomb
landing during a stagger, a non-finite axis mid-swing) were only covered by whatever a hand-written
test happened to do.

### IMPLEMENT

- `tests/sim/world-input-fuzz.test.ts` (1): 24 deterministic seeds, up to 200 steps each, with a
  seeded input generator that walks in random directions, aims at random points, swings, bolts, dashes,
  throws bombs, places traps and swaps stance. One frame in thirty carries a NaN or Infinity on a stick
  or aim axis, which exercises the Cycle 77 sanitiser. After every step it asserts: player and enemy
  positions are finite and inside the grid, the player's centre is never inside a solid tile, health,
  mana, dash charges, XP and shards are finite and non-negative, health never exceeds the computed
  maximum, level is a positive integer, projectiles and blasts are finite, and elapsed time is finite.
  It counts simulated steps and requires more than 3,000, so the pass cannot be vacuous if a seed ends
  immediately.

### RECORD

The first run passed; the counter was added afterwards and reports over 3,000 steps across the 24
seeds, so the assertions execute meaningfully. No invariant failed, including with the injected
non-finite frames.

### Gate results

See the task summary.

---

## Cycle 79 — Audio / every event type, and a played-session runtime check

### FIND

`Sound.handle` ended in `default: break;`, so a future `SimEvent` variant would compile cleanly and
simply never make a sound - the kind of omission nobody notices until a feature feels mute. No test
called `handle` at all, even though it runs on every frame of play and a throw there would break the
loop. Separately, there was no record of a played session being checked for runtime errors.

### IMPLEMENT

- `src/audio/Sound.ts`: the five intentionally silent events (`shake`, `sanctuary`, `buildingExit`,
  `secretOpened`, `floorExit`) are now explicit cases, and the `default` branch assigns the event to
  `never`. A new event type must choose a cue or join the silent list, or the file fails to compile.
- `tests/audio-handle.test.ts` (4): a sample map typed as
  `{ [K in SimEvent['type']]: Extract<SimEvent, { type: K }> }` (so it, too, is compile-complete) is
  played through a fake `AudioContext`; one case dispatches each event alone, one dispatches the whole
  set as a single frame, one covers `handle`/`setVolumes`/`setSuspended` before the first gesture, and
  one covers a browser with no Web Audio at all.

### RECORD

The exhaustiveness guard was proven rather than assumed: deleting the `victory` case from the real file
made `tsc --noEmit` exit 2 with `src/audio/Sound.ts(416,17): error TS2322: Type '{ type: "victory"; }'
is not assignable to type 'never'.` The file was restored in a `finally` block and re-typechecked clean.
The runtime check had to be redone: port 4173 was already held by an unrelated app, and the first probe
used `!document.querySelector('.hud')?.classList.contains('hidden')`, which is true when no HUD exists
at all - it reported "in run" for the wrong page and typed its test keys into that app. Re-run on a
fresh port after asserting the document title and a real HUD: 26 rounds of play produced zero page
errors and zero console errors, and a 60-second sample kept DOM nodes at 103-104 across six Pause and
six Map open/close cycles with the heap oscillating 25-50 MB and no monotonic climb. Both results are
recorded in docs/UI_REVIEW.md.

### Gate results

See the task summary.

---

## Cycle 80 — Accessibility and layout / relic rarity in words, narrow bag overflow

### FIND

Two defects in the relic screens. Rarity was conveyed only by the row's coloured left edge (grey, cyan,
gold), which is exactly the WCAG 1.4.1 failure mode for colour-blind players; the level-up cards already
name rarity in text, but no gear row did. And at 390px wide the bag rows were broken: the three action
buttons (Equip, Sell, Discard) have a combined min-content of about 328px, a bare `1fr` column keeps its
min-content floor, so every row grew to 352px and clipped 3px past the viewport while the buttons
overlapped the relic text.

### IMPLEMENT

- `src/ui/Screens.ts`: a `rarityTag()` helper appends "· common" (NBSP separator in the DOM, so the
  accessible name reads "Rusted Edge · common" rather than "Rusted Edgecommon") to all five relic row
  renderers: Reliquary, Reforge, relic market, equipped slots and carried relics.
- `src/ui/ui.css`: `.rarity-tag` is small uppercase `--ink-dim` text (10.29:1). The phone relic block now
  uses `minmax(0, 1fr)`, wraps and shrinks the action buttons, and `.gear-copy` gets `min-width: 0`, so a
  long name cannot set the grid's min-content width.
- Tests: `tests/ui-rarity-text.test.ts` (4) pins the helper, its five call sites, the DOM separator and the
  tag styling; `tests/ui-gear-row-phone.test.ts` now requires the shrink-and-wrap rule and `min-width: 0`
  instead of the old bare `1fr`.

### RECORD

With one relic of each rarity injected, the bag renders "Rusted Edge · common", "Colossus Plate · epic"
and "Soul Anchor · rare"; computed tag style is `uppercase`, `rgb(194, 184, 210)` at 9px. Bag overflow
went from 15 rows (max right edge 393 at a 390 viewport) to zero, with the rightmost row ending at 349;
verified at 390x844, 844x390 and 768x1024 with no horizontal overflow and no horizontal scroll. The
separator needed two corrections: a plain space left the accessible name as "Rusted Edgecommon", and a
literal NBSP tripped eslint's `no-irregular-whitespace`, so the source uses `\u00a0\u00b7` escapes and
the rendered code points were checked (a0 b7). Captures `docs/qa/cycle80-rarity-text-390x844.png` and
`cycle80-rarity-text-844x390.png`.

### Gate results

See the task summary.

---

## Cycle 81 — Accessibility / menus as named modal dialogs

### FIND

Every menu is a bare `<div class="screen">`. A screen reader got an unnamed region on every screen change,
so "go to Settings" or "the market opened" was never announced, and there was no dialog boundary for
assistive technology to use. The single screen host (`Screens`) is the natural place to fix it once.

### IMPLEMENT

- `src/ui/Screens.ts`: `Screens.show` now calls a private `announce(el)` that sets `role="dialog"`,
  `aria-modal="true"` and an `aria-label` taken from the screen's `.heading`, else its `.title`, else
  "Memory Reconstruction". The title screen has no heading, so it is named from its title text; the hub
  has neither, so it is named "The Sanctuary" from its title element.
- Tests: `tests/ui-screen-dialog.test.ts` (2) pins the three attributes, the heading/title fallback chain
  and the title-screen case.

### RECORD

Chromium, navigating explicitly and asserting `document.title === 'Memory Reconstruction'` first. Every
screen checked reports `role=dialog`, `aria-modal=true` and the expected name: title "Memory
Reconstruction", hub "The Sanctuary", "Settings", Quests (the Notice Board's heading), "Set Out",
"Recovered Memories", "The Reliquary", "Paused", the map's "Section 1 - Forgotten Ruins" and "Relics".

A focus-restore experiment was written and then removed, which is worth recording: `show()` remembered
the active element and `close()` returned focus to it, but in this app every navigation replaces the
screen (`onBack: () => this.pause()` re-renders, station Back re-renders the hub), so the remembered
trigger is always disconnected and the restore never fires. Browser probing confirmed the trigger was not
restored. Shipping unexercised code would have been worse than the honest smaller change, so only the
ARIA part remains.

Probe hygiene note: the shared Playwright page was navigated to a different project between two calls
(the reload returned "Dustline: Survivors"), so every probe now starts with an explicit `goto` and
asserts the document title before reading anything.

### Gate results

See the task summary.

---

## Cycle 82 — Settings / the difficulty highlight never moved

### FIND

`settingsScreen` is built once and never re-rendered: sliders update a label span and call `onChange`, and
the difficulty buttons set `current.difficulty` and call `onChange`. But the `btn small primary` class was
decided at build time inside the `.map`, so clicking Nightmare saved `settings.difficulty = 'nightmare'`
while Normal kept the highlight until the screen was closed and reopened. The buttons also had no
`aria-pressed`, so assistive technology could not tell which difficulty was selected at all.

### IMPLEMENT

- `src/ui/Screens.ts`: an exported, unit-testable `difficultyButtonClass(selected, value)` decides the
  class; the three buttons are kept in a `difficultyButtons` array and a `syncDifficulty()` pass rewrites
  each button's class, `aria-pressed` and tooltip in place. The click handler calls `syncDifficulty()`
  before `onChange`, and `aria-pressed` is set on the initial render too.
- Tests: `tests/ui-difficulty-selected.test.ts` (3): the class decision, the in-place sync including its
  order relative to `onChange`, and both `aria-pressed` sites.

### RECORD

Before the fix: clicking Nightmare stored `difficulty: "nightmare"` while the DOM still read
Normal=`btn small primary` (and no `aria-pressed` anywhere); only a reopen showed Nightmare highlighted.
After: the Nightmare click immediately gives Nightmare `btn small primary` + `aria-pressed="true"` with
the other two `false`, a following Story click moves both to Story and stores `difficulty: "story"`, and
focus remains on the clicked button because the screen is not rebuilt.

### Gate results

See the task summary.

---

## Cycle 83 — Usability / long lists lost their place on every sale

### FIND

The bag re-renders after every sell, discard or equip (`render()` inside `showInventory`), and the
rebuild reset both the panel scroll and focus: `Screens.show` focuses the first control, which is the
"All" filter chip at the top. Measured on a 390x844 phone with four relics: after scrolling the panel to
`scrollTop 763` and confirming a sale of the last relic, the rebuilt panel was back at `scrollTop 0` and
focus sat on "All - 3". Selling several relics therefore meant re-scrolling and re-finding the list each
time. The relic market on the Set Out screen has the same rebuild-after-sale shape.

### IMPLEMENT

- `src/ui/Screens.ts`: the bag's equip, sell and discard buttons and the market's sell button carry a
  stable `data-action` key (`equip:<uid>`, `sell:<uid>`, `discard:<uid>`, `market:<defId>`).
- `src/app/App.ts`: `captureListState()` records the panel's `scrollTop` and the focused element's index
  among `.screen [data-action]`; `restoreListState()` reapplies the scroll and refocuses the action at
  the same index, clamped to the new length because the sold row is gone. Both are used around the bag
  and market re-renders.
- Tests: `tests/ui-list-state.test.ts` (5) pins the capture, the clamp and `preventScroll` restore, both
  wiring sites, and all four stable keys.

### RECORD

Same reproduction as the FIND, after the fix: the panel keeps `scrollTop 763` across the sale (previously
0) and focus stays inside the list on the action at the same index (`discard:9003`) instead of jumping to
the filter row. The panel's content height shrank 1563 -> 1477 as expected for one fewer relic, so the
scroll restore is real rather than a no-op.

### Gate results

See the task summary.

---

## Cycle 84 — Accessibility / the bag filter chips dropped focus and hid the selection

### FIND

Cycle 83 gave the bag's row actions a stable key, but the filter chips above them were untouched.
Pressing Enter on "weapon - 1" switched the filter and its highlight, then focus jumped back to the
first chip, "All - 1", because `Screens.show` focuses the first control after the rebuild. The chips
also had no `aria-pressed`, so assistive technology could not tell which filter was active - only a CSS
`active` class carried it.

### IMPLEMENT

- `src/ui/Screens.ts`: each filter chip gets `data-action="filter:<slot>"` and
  `aria-pressed` reflecting `bagFilter`. Because cycle 83's `captureListState`/`restoreListState`
  already record and restore the focused `[data-action]` by index, the chip keeps focus across the
  re-render without further App changes.
- Tests: `tests/ui-list-state.test.ts` grows to 6 with the chip key and pressed-state assertions.

### RECORD

Before: focus on "weapon - 1", Enter switched the active filter to weapon but `document.activeElement`
became "All - 1", and every chip reported `aria-pressed` null. After: the same Enter leaves weapon both
`active` and `aria-pressed="true"`, All `false`, and focus on the weapon chip; a following Tab moves to
"armor - 0", so the tab order resumes from the chosen chip rather than the top.

### Gate results

See the task summary.

---

## Cycle 85 — Keyboard / place screens dropped focus after every choice

### FIND

Cycle 83 and 84 covered the bag; the other re-rendering screens had the same defect. Measured on the
Training Yard: with three weapon cards, focusing a "Train with this" button and pressing Enter re-rendered
the screen and left focus on the *first* card's button rather than the chosen one. The Meditation Stone,
Reliquary, Aspect Shrine, Reforge and Cairn all rebuild the same way, and none of their action buttons
carried a key, so a keyboard player had to tab back to the list after every single choice.

### IMPLEMENT

- `src/ui/Screens.ts`: stable `data-action` keys on the training pick (`train:<id>`), meditation boon
  (`boon:<id>`), reforge (`reforge:<defId>`), cairn offering (`cairn:offer`) and aspect choose
  (`aspect:<id>`, extracted into a small `aspectChooseButton` helper).
- `src/app/App.ts`: the four place screens capture and restore list state inside their existing `reopen`
  closure (one edit each, since that closure is the only rebuild path); training and meditation wrap only
  their action handler because their `render` is also the first paint.
- The restore now skips disabled targets: choosing a weapon turns its button into a disabled "Equipped"
  (and a boon into a disabled "Meditating"), and a disabled button cannot take focus. It prefers the
  nearest enabled action *after* the old index, then the nearest *before* it, instead of wrapping to the
  top of the list.
- Tests: `tests/ui-list-state.test.ts` grows to 9 (the five keys, the nearest-enabled ordering, the
  capturing reopen).

### RECORD

Training Yard: with the greatsword equipped, focusing sword and pressing Enter stored `startingWeapon:
"sword"`, disabled the sword button as "Equipped" and put focus on the spear button. Meditation (echoes
seeded to 200): picking the last boon turned it into a disabled "Meditating" and focus moved to the
nearest enabled boon. Aspect Shrine: choosing the last aspect moved the `selected` class to it and focus
to the next aspect's Choose button.

Note the first version of the restore wrapped to the first enabled action, which sent focus from the
third boon back to the first; browser probing caught it and the ordering was changed to nearest-first.

### Gate results

See the task summary.

## Cycle 86 - The Meditation Stone looked unfinished next to its sibling place screens
### FIND
Reviewing every sanctuary screen at 1280x720 and 390x844: the Reliquary, Reforge and Cairn are centred
with a scene panel and an explanation. The Meditation Stone sat at the top of the screen with about 60%
of it empty, had no art even though `station_meditation.png` exists, never showed how many echoes the
player held, and dimmed all three Meditate buttons at 0 echoes without saying why.
### IMPLEMENT
- `src/ui/Screens.ts`: `meditationScreen` uses the `place-screen` layout (art panel with the station
  sprite and a caption that names the carried boon, echo balance, single-column boon list, a note that
  reads "You need N more echoes to meditate." or "Meditating again replaces the boon you carry.").
  `MEDITATION_COST` is exported and replaces the literal 20 in the screen.
- `src/app/App.ts`: the purchase uses `MEDITATION_COST` too, so the label, the disabled state and the
  charge cannot drift apart.
- `src/ui/ui.css`: `.meditation-list`.
- Tests: `tests/ui-meditation-layout.test.ts` (5 source assertions; 4 failed before the change).
### RECORD
Browser probe at 1280x720 and 390x844, no console errors, no horizontal overflow. At 0 echoes all three
buttons are disabled and the note says 20 more are needed. At 200 echoes, Enter on the second boon left
180 echoes, disabled that boon as "Meditating", moved focus to `boon:flow` and changed the caption to
"Sharper Intent rests in you." The cycle 85 focus keys are unchanged.
### Gate results
See the task summary.

## Cycle 87 - Inventory grid and paper doll with drag and drop
### FIND
The relic bag was a list only: three worn slots and ten carried relics as rows, no boxes, no preview of the
wanderer, and no way to drag a relic anywhere. The README also still said the bag held six relics while
`INVENTORY_SLOTS` is 10.
### IMPLEMENT
- `src/ui/inventoryDrag.ts` (pure rules): `resolveDrop` (equip, unequip, reject with a reason, or nothing),
  `parseDropTarget`, `bagCells`, `dragStarted` (6 px threshold so a click is still a click).
- `src/ui/InventoryGrid.ts`: a paper doll (weapon, armor and trinket boxes around the idle frame of the
  player for the current stance, animated, still under reduced motion) and a 5x2 bag grid sized from
  `INVENTORY_SLOTS`. Pointer-event drag works with mouse and touch; valid drop zones glow green and wrong
  slots red while dragging. A plain click equips. The boxes have no tab stop and no `data-action`, so the list
  rows stay the keyboard path and the cycle 85 focus restore is untouched.
- `src/ui/Screens.ts`: the grid is mounted above the weapon stance; equip and unequip moved into two helpers
  shared by the list rows and the grid, so the messages cannot drift.
- Relic art is a per-slot glyph in the rarity colour; per-item icons are a later graphics pass.
- Tests: `tests/inventory-drag.test.ts` (11, failed before the module existed), `tests/ui-inventory-grid.test.ts` (7).
### RECORD
Browser run at 1280x720 and 390x844 with real mouse events over CDP, no console errors, no overflow:
armor dropped on the wanderer equipped; a weapon dropped on the trinket slot was rejected with "That relic is
weapon gear; it fits the weapon slot, not trinket."; an armor relic dropped on the trinket slot was rejected;
the worn armor dragged to the bag returned to it; a click equipped; a drop on empty space changed nothing.
### Gate results
See the task summary.

## Cycle 88 - Worn armor and trinkets change the wanderer's look
### FIND
Armor and trinkets changed stats only. The wanderer looked the same in every relic, in the game and on the new
paper doll, so a drag onto the doll had no visible result beyond a number.
### IMPLEMENT
- `src/view/gearLook.ts` (pure): a palette per armor (target hue, saturation and brightness factors) and a
  glow per trinket (colour, size by rarity). `recolorPixels` remaps only the robe band of the player sheets
  (hue 205-255, saturation >= 0.25, brightness >= 0.14), so skin, gold trim, the cyan cape, the blade and the
  outline stay as drawn, and keeps 30% of the original hue spread so the shading reads.
- `src/view/armorTextures.ts`: re-coloured frame textures, built once per animation and armor.
- `src/view/ActorView.ts`: an armor layer that mirrors the body frame, scale, lean and alpha and replaces
  the body while armor is worn (the hurt flash still sits above it); an orbiting trinket glow; dash
  afterimages copy whichever sprite is showing.
- `src/ui/dollArt.ts` and `src/ui/InventoryGrid.ts`: the doll's idle sheet is re-coloured with the same
  rules (cached data URL, plain sheet until it is ready) and the trinket orbits as a CSS glow, still under
  reduced motion.
- Tests: `tests/gear-look.test.ts` (12: every armor and trinket in `equipment.json` has a look, the six
  armors stay apart, protected colours untouched, alpha kept, shading order kept) and
  `tests/ui-doll-gear.test.ts` (4). Both failed before the change.
### RECORD
In the Archive at 1280x720: all six armors idle, plus walking left, the wider attack sheet, and unequipping
back to the blue robe; each trinket glow shows in its colour. On the doll at 1280x720 and 390x844, Void Shroud
with Sun Core showed purple with a gold glow, and dragging Crystal Mail onto the doll re-dressed it teal. No
console errors. A dash afterimage was not captured; the change there is one line.
### Gate results
See the task summary.

## Cycle 89 - Residents work their rooms instead of standing on one tile
### FIND
All six residents stood on the same tile behind the same desk spot, bobbing 1.5 px. The Hearthkeeper was
drawn with the Smith's sprite: `ActorView` kept its own resident-to-sprite map, which had no Hearthkeeper
entry, so the fallback `npc_smith` was used although `npc_hearthkeeper.png` exists. Name labels measured
their distance from where the interactable was created, which would break as soon as a resident moved.
### IMPLEMENT
- `src/sim/residents.ts` (pure): `stepResident` works at a stop, walks the fixed route at 38 px/s, and
  stops and turns to the walker inside 96 px (the talk radius is 44 px), resuming when they leave. No
  randomness, so a room plays the same way every visit.
- `src/sim/sanctuary.ts`: each building names its `residentSprite` and a looping `route` that starts at
  the old post, so the spawn position and the existing tests hold. Stops sit beside each resident's own
  furniture: the Smith at anvil, hearth and armory, the Gardener among the planters and herbs, the
  Lamplighter at four lanterns, the Hearthkeeper between the cauldron and the two tables.
- `src/sim/world.ts`: the resident is stepped in sanctuary mode and its position, pose and facing are
  written onto the npc interactable, so talking, the balloon and the prompt follow it unchanged.
- `src/view/ActorView.ts`: the sprite comes from the building data; `residentMotion` flips to the facing
  and gives each pose its own motion (stepping bob and sway, a slow working dip, an upright attend); labels
  keep a reference to the live interactable.
- Tests: `tests/sim/residents.test.ts` (10), two world tests in `tests/sim/sanctuary.test.ts`, and
  `tests/view-residents.test.ts` (4). All failed before the change; the view test was also run against the
  previous `ActorView` and failed 4 of 4.
### RECORD
Hearth and Forge sampled every 2.5 s with the walker at the door: both residents alternated work and walk and
faced the way they walked. The Hearth now shows the Hearthkeeper. With the walker placed 40 px left of the
Smith, the Smith stopped, faced left, and the quest balloon read "new task: Edges for the Wall". No console
errors. 784 tests.
### Gate results
See the task summary.

## Cycle 90 - Every resident room gets its own floor plan
### FIND
The six interiors were the same 21x13 open box, told apart only by palette and furniture.
### IMPLEMENT
- `src/sim/sanctuary.ts`: each building carries a `plan`, 13 rows of 21 tiles where `#` is wall and `.` is floor,
  applied after the room is carved. The footprint, spawn, exit, post and camera framing stay shared, so
  nothing outside the room changes. Walls were placed only on tiles that the occupancy map of the room showed
  free of furniture, route stops, route paths, the spawn mat, the exit and the walk lane:
  Archive chamfered corners, two bookstack stubs and two reading-nook pillars; Forge furnace bay, storage stub
  between the crates, coal corner and two pillars; Garden rounded corners and a boulder; Barracks four drill
  columns and two buttresses; Lamp House crypt niches along the bottom wall; Hearth alcove either side of the
  chandelier, two pillars and rounded corners. The renderer already draws freestanding walls as the biome's
  pillar prop and runs as wall faces.
- Tests in `tests/sim/sanctuary.test.ts`: plan shape, six different plans with at least 4 walls, the built
  grid matches the plan, spawn, exit, walk lane, every prop and every route stop on floor, every route segment
  crosses floor only, and every floor tile is reachable from the spawn. Four of the five failed before the
  change. The existing test "builds the same sealed, walkable room for every resident" required all interior
  tiles to be floor; it now requires each tile to match the plan exactly and keeps its outer-wall checks
  (ADR-210).
### RECORD
All six rooms at 1280x720: each reads as its own space, the biome draws the pillars (crystals, gears, ice,
trees), no console errors, 787 tests. The Hearth alcove sits right under the room title; the title stays
readable.
### Gate results
See the task summary.

## Cycle 91 - Every relic gets its own icon
### FIND
The bag grid from cycle 87 showed one glyph per slot, so all five weapons, six armors and nine trinkets looked
alike apart from the rarity colour. The list rows had no art at all.
### IMPLEMENT
- `scripts/generate_relic_icons.py`: draws one 64 px icon per relic in `equipment.json` into
  `assets/sprites/ui/relic_<id>.png`, reusing the drawing helpers of `generate_art_assets.py` so the line
  weight and outline match the rest of the art. It is deterministic and exits 1 with Why/Fix if a relic has no
  drawing. It writes only the 20 new files.
- After a first look, Ember Core was redrawn as a caged orb on a haft because it read like Ember Charm, the
  Thorn Ring thorns were doubled in width, and the Rusted Edge blade was widened.
- `src/ui/dom.ts`: `relicIconUrl`. `InventoryGrid.ts` shows the icon in filled boxes, and the slot glyph
  stays as the empty-slot mark. `Screens.ts` puts a 32 px icon in the slot label of the bag, worn, Reliquary,
  Reforge and relic market rows, so every relic list matches.
- Tests: `tests/relic-icons.test.ts` (an icon for every relic at 64x64, all different, wired into the grid and
  the rows, built by the script). It failed 4 of 4 before the change.
### RECORD
Inventory at 1280x720 and 390x844 with three worn relics and seven carried: 20 of 20 icons loaded at 64 px,
no overflow, no console errors. The reforge rank still shows over the icon.
### Gate results
See the task summary.

## Cycle 92 - A prop of their own for every resident, and routes that walk around furniture
### FIND
Five of the six rooms drew from one shared furniture set (tables, chairs, shelves, lanterns, strings). Checking
free tiles for new props also showed a bug from cycle 89: the tests there kept route stops off furniture but not
the paths between them, and the Gardener walked through the herbs, the Warden through a bench, and the
Lamplighter through a chair and two candles.
### IMPLEMENT
- `src/sim/sanctuary.ts`: the Gardener gets a stop at the planters, the Warden's last stop moves one tile down,
  and the Lamplighter gets three waypoints, so every path goes around furniture. Each resident gets a signature
  prop on a free tile: lectern (Archive), bellows (Forge), seed trays (Garden), training dummy (Barracks), lamp
  ladder (Lamp House), pantry (Hearth).
- `scripts/generate_art_assets.py`: the six props are in its palette, its drawing switch and its prop list, so a
  full run draws and registers them. They were rendered now with that script's own `prop_image` and
  `save_cell` and appended to `assets/data/sprite_atlas.json`, `src/data/sprite_atlas.json` and
  `assets/data/graphics.assets.json` in the order a full run writes; each file kept its line endings, and a
  round-trip of all three was byte-identical before the edit.
- Tests in `tests/sim/sanctuary.test.ts`: no route segment crosses a furniture tile, and each resident's prop is in
  the atlas, in its room and in no other. Both failed before the change.
### RECORD
All six rooms at 1280x720: each new prop is in place and reads as what it is; no console errors; 793 tests.
### Gate results
See the task summary.

## Cycle 93 - Save slots, export and import, and a save note
### FIND
The game kept one save per browser in localStorage. Clearing site data or switching browsers lost it, there
was no way to keep a second playthrough, and nothing told the player a save had happened or failed.
### IMPLEMENT
- `src/save/SaveStore.ts` (milestone 1, ADR-213): three slots, an index of the active slot and save times,
  shared settings, migration of the old single save into slot 1 (old keys kept), strict export and import,
  delete, and an `onWrite` listener.
- `src/ui/SavesScreen.ts`: one card per slot (echoes, restorations, expeditions, deepest section, memories,
  expedition in progress, last save time) with Play or Start here, Export (a real file download named
  `memory-reconstruction-slot<N>-<date>.json`), Import (a file picker; files over 1 MB are refused unread, and
  importing over progress needs a second click) and Delete (two clicks). The result of the last action shows
  under the cards.
- `src/ui/saveIndicator.ts`: a corner note, "Saved" for 1.2 s, or "Could not save: browser storage may be full
  or blocked" for 6 s; no transition under reduced motion.
- `src/app/App.ts`: **Saves · Slot N** on the title; switching, deleting or importing the active slot reloads
  progress and settings. Saves is reachable from the title only, never during an expedition.
- Tests: `tests/save-slots.test.ts` (16) and `tests/ui-saves-screen.test.ts` (8); both failed before the change.
### RECORD
In Edge at 1280x720 with real input: slot 1 holding 321 echoes exported through the browser's download
path; that file, chosen in slot 3's file picker, imported 321 echoes; a foreign JSON file was refused with
"This file is not a Memory Reconstruction save."; Play on slot 3 switched the title button and the loaded
progress; one click on Delete only armed it and the second emptied the slot; "Saved" showed after a save; the
active slot survived a reload. Layout checked at 390x844. No console errors.
### Gate results
See the task summary.

## Cycle 94 - The grid is the whole inventory
### FIND
Since cycle 87 the relic screen showed the drag grid and, below it, the old list of worn and carried rows with
filters, so every relic appeared twice. The rows were also the only keyboard path.
### IMPLEMENT
- `src/ui/Screens.ts`: the worn rows, carried rows, slot filters, group headers and row arrow keys are gone. A
  picked box opens a detail pane under the grid: icon, name and rarity, where it is, its description, the stat
  changes against the worn relic in that slot, and Equip (Upgrade or Swap), Sell and Discard for a carried relic
  or Unequip for a worn one. Picking updates the grid and the pane in place; the pane scrolls into view 400 ms
  later, after the double-click gap. Equipping moves the pick to the worn slot and unequipping back to the bag.
  Sell-all-commons, the stance and the supplies stay.
- `src/ui/InventoryGrid.ts`: one tab stop for the grid; arrow keys move to the nearest box in that direction
  (`nextInDirection` in `inventoryDrag.ts`), so the doll beside the bag and the doll above it both work; Enter and
  Space pick; a plain click picks; a double click wears or takes off; drag is unchanged. `markSelected` marks the
  pick in place.
- `src/app/App.ts`: the shared focus restore finds the focused control by its key first, then the picked box when
  the control is gone (as after Upgrade), then the remembered position itself before its neighbours. Before, it
  always tried the next position first, which put focus one box off in the grid.
- Tests: 4 direction tests, 3 restore tests and 2 grid keyboard tests, all failing first; four list tests
  replaced (ADR-216).
### RECORD
In Edge with real mouse and keys at 1280x720 and 390x844: a click picked Void Cleaver and showed four stat
changes; Upgrade wore it and the pick and focus followed to the weapon slot; arrows moved between doll and bag;
Enter picked; a double click wore Crystal Mail; one click on Sell only armed it and the second sold; a drag put Sun
Core on the doll; the pane was in view after a pick; no list rows remained; no overflow or console errors.
Three bugs were found this way and fixed before commit: the double click never fired because each click rebuilt
the screen, focus landed one box off after an action, and on a phone the pane's scroll moved the box between the
two clicks of a double click.
### Gate results
See the task summary.

## Cycle 95 - Headwear, a twenty-slot bag, and a crueller deep
### FIND
The player asked for a Headwear section, more inventory space and a harder climb. The bag held ten relics and the
armoury recognised only weapon, armor and trinket; the level curve grew by 1.42 and kills paid 55% of their XP; and
every wave of a room was the same size and damage, while enemy damage only rose 10% per section.
### IMPLEMENT
- `src/sim/equipment.ts`: `EquipmentSlot` gains `head`, the worn slots are weapon, armor, trinket and head, and
  `INVENTORY_SLOTS` is 20.
- `src/data/equipment.json`: four head relics (Scout Hood, Iron Helm, Oracle Circlet, Void Visor) with stat mods.
- `scripts/generate_relic_icons.py`: a drawing for each head relic; 24 icons, all distinct.
- `src/ui/InventoryGrid.ts` and `src/ui/ui.css`: a head box on the doll (head above the weapon, armor above the
  trinket) and four rows of five bag boxes.
- `src/ui/inventoryDrag.ts`: `slot:head` is a drop target.
- `src/sim/run.ts`: a snapshot without a head key loads with `head: null`; every slot is filled on restore.
- `src/sim/run.ts`: `xpForLevel` is `42 * 1.5^(level-1)` (steeper than 1.42, and level 5 now costs 213 instead of
  171); `ENEMY_XP_SCALE` is 0.4, so kills pay about a quarter less than before.
- `src/sim/content.ts`: `ROOM_DAMAGE_STEP` 0.05, `WAVE_DAMAGE_STEP` 0.1, `WAVE_EXTRA_ENEMIES` 1, and the pure
  helpers `enemyDamageMultiplier` and `waveEnemyCount`. Damage is additive: 20 cleared rooms are exactly +100%,
  and section depth and wave number add their own steps on top.
- `src/sim/world.ts`: `spawnEnemy` takes the wave number and applies the shared multiplier; `spawnWave` uses
  `waveEnemyCount`, so wave 2 brings one more enemy than wave 1 and 10% more damage, wave 3 another step, up to
  the room cap.
- Tests: `tests/inventory-headwear.test.ts` (7) and `tests/sim/difficulty-ramp.test.ts` (5), all failing first.
  `tests/hub.test.ts` builds its vault from `EQUIPMENT` (the old ten-item fixture could not fill twenty cells), and
  `tests/gear-look.test.ts` gained `head: null` in its typed fixtures; no assertion was weakened (ADR-217/218).
### RECORD
In Edge at 1280x720 and 390x844 with real input: the Relics screen showed the Iron Helm in the new head box plus
Void Visor, Scout Hood and Oracle Circlet in the bag; all five icons loaded at 64 px; the doll was 278 px wide on
the phone, the bag 334 px, and the document did not scroll horizontally (390/390). The bag reported Carried 3/20
and 24 boxes (4 worn + 20 bag). Screenshots `docs/qa/cycle95-headwear-1280x720.png` and
`cycle95-headwear-390x844.png`.
### Gate results
See the task summary.

## Cycle 96 - Five-percent sections, readable residents, top balloons and checkpoint banking
### FIND
The player reported five things: section steps should be +5% additive (section 2 = 1.05x, section 3 = 1.10x)
rather than the old 10%; Sanctuary resident descriptions showed "..." instead of the whole message; NPC
message boxes sat under the residents instead of at the top; trust and the tribute button crowded each
other; and NPCs should have more interactions, including asking for a specific item. The player also asked
that reaching a checkpoint keep the items carried into the Sanctuary, while dying before the next checkpoint
loses the new, unsaved items. The code confirmed every point: `ENEMY_DAMAGE_DEPTH_SCALE` was 0.1;
`.building-blurb` was clamped to 4 lines (2 at some breakpoints) and hidden entirely at max-height 820;
the balloon flipped below the resident and clipped its text to 140 characters; the tribute button shared a
text block with the trust line; NPCs had tasks but no item requests; and `recordRun` never copied carried
relics into the vault, while the death screen falsely said it did.
### IMPLEMENT
- `src/sim/content.ts`: `ENEMY_DAMAGE_DEPTH_SCALE` is 0.05, so the formula is
  `1 + 0.05 * section + 0.05 * roomsCleared + 0.1 * (wave - 1)`; section 20 is 1.95x.
- `src/sim/run.ts`: `RunState.bankedRelics`, `carriedRelicIds` and `bankCarriedRelics`; old snapshots load
  an empty bank and phantom ids are filtered.
- `src/save/SaveStore.ts`: `Meta.relicRequests`, and `recordRun` adds the bank on death/abandon, every
  carried relic on victory, deduplicated against the existing vault.
- `src/sim/quests.ts`: six `RELIC_REQUESTS` (one per resident), `requestForNpc`, `applyRelicRequest` (relic
  leaves the vault, echoes and one heart arrive, full-trust gift still possible) and `ROAD_HINTS`.
- `src/app/App.ts`: banks carried relics in `enterFloor` and reports the count in the checkpoint toast; the
  dialogue passes the wanted relic, the give callback and the road hint; the balloon no longer flips below
  and no longer truncates its line.
- `src/ui/Screens.ts`: dialogue header splits trust and tribute into `.dialogue-titles` (flex column) and
  `.dialogue-actions`; adds the wanted-relic panel with a **Give** button and a hidden **Ask about the road**
  panel; the death recap tells the truth about checkpoint banking.
- `src/ui/balloon.ts`: top-pinned placement; `ui.css`: no line clamps anywhere, no hidden blurb at short
  heights, dialogue column rules, hidden hint rule and no `.below` balloon rules.
- `src/sim/sanctuary.ts`: six one-sentence blurbs (<=96 chars).
- Tests: `tests/sim/relic-banking.test.ts` (6), `tests/npc-relic-requests.test.ts` (7),
  `tests/ui-dialogue.test.ts` (5), `tests/ui-balloon.test.ts` rewritten (4), `difficulty-ramp.test.ts`
  updated for the 5% section step, and `ui-hub-layout.test.ts` now asserts no clamp (the request changed the
  old intended behavior; ADR-219).
### RECORD
In Edge at 1280x720 and 390x844 with real input: all six hub descriptions rendered whole (clientHeight ==
scrollHeight, 6/6 visible, 0 clamped) and the document never scrolled horizontally; the expedition bar
stayed visible at 1280x720 (bottom 716.7). The Archivist balloon measured top 91.94, bottom 170, with the
room title ending at 65, no `below` class and the full greeting text. The Smith page showed trust and
tribute stacked with no overlap (6px gap at desktop, 8px at 390px), the wanted-relic panel read "not in the
vault yet", and **Ask about the road** toggled the full hint (display grid). Giving the Choir Staff removed
it from the vault, paid +140 echoes (1424 → 1564), recorded `archivist` in `relicRequests` and changed the
panel to "Delivered. The Sanctuary remembers." Screenshots `docs/qa/cycle96-dialogue-1280x720.png`,
`cycle96-dialogue-390x844.png`, `cycle96-hub-390x844.png`.
### Gate results
See the task summary.

## Cycle 97 - Requests on the hub, the bank beside the bag, an honest save slot
### FIND
Cycle 96 added relic requests and checkpoint banking, but both were easy to miss: a request showed only inside
the resident's page, and the bank only in an entrance toast or the death recap. A player deciding whether to
carry a new relic had to remember the last checkpoint. The Saves screen also labelled an empty active slot
"Playing", which is a disabled lie. The code confirmed all three: `SavesScreen` chose the label from `active`
alone, `hubScreen` showed only the quest badge, and `inventoryScreen` had no bank line.
### IMPLEMENT
- `src/sim/quests.ts`: `relicRequestStatus(meta, npcId)` returns `none | wanted | ready | done`.
- `src/sim/run.ts`: `bankSummary(run)` counts distinct kept relics and distinct carried relics still at risk.
- `src/ui/Screens.ts`: each resident card gains a `.building-badges` row with the quest badge plus **Wants
  (relic)**, **Give (relic)** or **Relic given**; the Relics screen gains a checkpoint-bank line under
  `Carried · N/20`.
- `src/ui/SavesScreen.ts`: `playSlotAction` is the tested decision for label and disabled state; the active
  empty slot now reads **Active slot**, not **Playing**.
- `src/ui/ui.css`: badge-row layout and `.quest-badge.relic`.
- Tests: `tests/ui-hub-requests.test.ts` (3), `tests/ui-save-slot-action.test.ts` (2), plus `bankSummary`
  and `relicRequestStatus` cases in the existing sim tests.
### RECORD
In Edge at 1280x720: the six hub cards read `[New task, Relic given]` for the Archivist and `[New task,
Wants (relic)]` for the other five; adding Bog Crown to the vault flipped the Gardener to **Give Bog Crown**
with class `quest-badge ready`. The badge row measured 344 px inside a 366 px card at 390x844 with no wrap
and no horizontal overflow (390/390). Continuing the save showed the Relics screen bank line "1 relic kept ·
everything carried is safe", and after adding two relics it read "1 relic kept · 2 new relics at risk until
the next checkpoint" with `Carried · 2/20` and 24 boxes (the injected relics were removed afterwards).
Screenshots `docs/qa/cycle97-hub-badges-1280x720.png` and `cycle97-hub-badges-390x844.png`.
### Gate results
See the task summary.

## Cycle 98 - Capes, a taller bag, an RPG quest log, maze stalls, mana flasks and safe level cards
### FIND
The player asked for seven things: a cape item type that recolours the cape, a taller inventory, a proper RPG quest
UI, maze NPCs that sell consumables, even harder leveling, a fix for the attack click that can take the wrong
level-up card, and mana potions. The code showed each gap: the cyan cloak had no equipment slot and the armor pass
left it untouched; the bag panel was capped at `min(60vh, 460px)`; the quest screen was a flat restoration list; the
merchant charged one fixed relic trade on interact with no shop; the level curve was 42/1.5 with 40% kill XP; the
choice screen armed after 320ms and then accepted any click, including double-clicks; and mana had no consumable.
### IMPLEMENT
- Cape: fifth worn slot, four capes, `CAPE_LOOKS`, a separate 175-202 hue pass (`recolorCapePixels`) beside the
  205-255 robe pass, both applied on one canvas for actor and doll; a cape box on the doll; `slot:cape` drag target;
  four generated icons (28 total). The panel grows to `min(74vh, 600px)` and the doll to a three-row grid.
- Quest log: counts, All/Active/Ready/Available/Completed tabs with client-side section filtering, giver portraits,
  reward lines, progress bars with exact numbers, and the daily mark with its claim button.
- Maze merchants: `shopStock`/`buyFromShop` with five lines (healing, mana, bombs, traps, relic), section-scaled
  prices, one sale per line, a paused `shopScreen`, and a truthful HUD prompt.
- Mana flasks: `R`, 60% of max mana, one starting flask, drops from enemies/urns/crystals/chests, merchant stock,
  HUD chip, touch button, saved with the run.
- Leveling: `42 * 1.6^(level-1)` and `ENEMY_XP_SCALE 0.3`; the balance test now expects two levels from 200 XP,
  which is the requested change (ADR-224).
- Level-up guard: 550ms grace, 8px pointer travel or 1.5s settle, double-click rejection, touch grace, keyboard
  digits bypass.
- Tests: `inventory-cape` (8), `ui-choice-guard` (6), `merchant-shop` (7), `mana-potion` (5), `ui-quest-log` (4),
  plus updated headwear, balance, systems and fuzz fixtures.
### RECORD
In Edge at 1280x720 and 390x844 with real input: the Relics screen showed 25 boxes (5 worn + 20 bag), a 278x212
doll with the Ember Drape head/cape boxes and a recoloured sheet (`data:image/png` background), a 481px panel under
a 532.8px cap, and the bank line "1 relic kept - 3 new relics at risk". The Quest Log showed 0 active / 0 ready / 0
completed / 6 available, five filter tabs, the daily mark, six portrait cards with progress widths 25%, 59%, 100%
and 67%; Active hid the other sections; at 390 the cards were 358px in a 390px viewport with no horizontal
overflow. A maze stall listed five wares; buying the Mana draught took 500 to 470 shards, raised flasks from 1 to 2
and flipped the line to Sold. Pressing R at 0 mana restored 60/60 and dropped the flask count from 2 to 1, with the
HUD reading `1 R`. A forced level card appeared in 17ms; an immediate click left the choice pending and upgrades
empty, while a click after 1.6s took `vitality`. Screenshots `docs/qa/cycle98-cape-inventory-1280x720.png`,
`cycle98-quest-log-1280x720.png`, `cycle98-quest-log-390x844.png`, `cycle98-merchant-shop-1280x720.png`.
### Gate results
See the task summary.

## Cycle 99 - A stall on every floor and an honest flask line
### FIND
The Cycle 98 stall was placed only in a treasure room's sealed-cache branch at a 35% roll, so a player could cross
whole sections without ever seeing the feature. The shop's healing line was disabled only by price: at a full flask
rack it still read "24 shards" and a click did nothing. The cape recolour had source-level coverage but no pixel
proof that the cyan cloak band and the robe band stay independent.
### IMPLEMENT
- `src/sim/world.ts`: when no merchant was placed, pick the first treasure, shrine, library or combat room, offset
  and clamp the stall, and add a **Wandering merchant**; the 35% vault-side stall remains a bonus.
- `src/ui/Screens.ts`: `shopLineState(item, shards, healthFlasks, maxHealthFlasks)` is the one decision for a shop
  button; a full rack shows **Flasks full** and disables the line, sold stays **Sold**, and unaffordable keeps the
  price but disables.
- `src/app/App.ts`: passes current and maximum health flasks to the stall.
- Tests: `merchant-availability` (2) checks 24 seeds for at least one five-line stall and a labelled stall on most
  floors; `ui-shop-line` (5) pins the button states; `gear-look` gains 4 pixel tests (cape hue moved, robe/skin/gold
  untouched, robe+cape compose, alpha preserved).
### RECORD
On a fresh dev server at 1280x720, Section 1 held one merchant labelled **Wandering merchant**. Standing next to it
with flasks 3/3 and 0 shards, the stall showed **Flasks full** disabled on the healing line while the other lines kept
their prices (disabled by the empty purse). The cape pixel rules and shop-line states are covered headlessly.
Screenshot docs/qa/cycle99-flasks-full-1280x720.png.
### Gate results
See the task summary.

## Cycle 100 - New enemies, two late sections and quest chapters with a tracker
### FIND
The player asked for new enemies, new sections, a better quest log, and better quests and story. The bestiary
already had varied AI but the late road jumped from the Drowned Court trial to the Keeper, the quest log had no
way to pin a task, each resident had exactly one task, and claiming it left them with only ambient remarks.
### IMPLEMENT
- `src/data/enemies.json` (+ the `assets/data` mirror): Bone Picker, Lantern Wraith, Cinder Stalker, Spire
  Marksman, Reliquary Warden and Salt Orchard Hydra.
- `src/sim/content.ts`: sprite keys, tints and scales for all six; two new floor plans - The Gilded Reliquary
  (section 22, foundry) and The Salt Orchard (section 23, bloom) - before the Keeper (now section 24) and the
  First Memory finale (now section 25, FINAL_DEPTH 24); new mobs added to the ash, void, storm and catacomb
  rosters.
- `src/sim/enemies.ts`: boss attack patterns and the melee classification for the Reliquary Warden.
- `src/sim/quests.ts`: a second chapter for every resident (12 total), `questsForNpcList`,
  `nextQuestForNpc`, `latestClaimedQuestForNpc`, `QUEST_EPILOGUES` and `epilogueForNpc`; new late stories for
  every resident, with the archivist's final story moved to depth 24.
- `src/save/SaveStore.ts`: `trackedQuest` on the meta (default null).
- `src/ui/Screens.ts`: the dialogue shows the next chapter and the most recent epilogue; quest cards gain
  Track/Untrack and a tracked border; hub badges and dialogue use the chapter-aware quest.
- `src/app/App.ts`: quest tracking saved and re-rendered, tracker text built from the snapshot, HUD tracker
  updated each frame, tracked chapter cleared on claim.
- `src/ui/Hud.ts` and `ui.css`: a pinned `.hud-tracker` under the floor line (104px desktop, 78px mobile).
- Tests: `content-expansion` (5), `quest-chapters` (6), plus intentional updates to content, frontier, hub,
  save-fuzz, tide-trial and quest-reference expectations (ADR-226).
### RECORD
In Edge at 1280x720 the Quest Log showed 13 cards (12 chapters plus the daily mark), 12 available, and a
Track button on each. Tracking **Names in the Index** set `meta.trackedQuest` to `names`, turned its border on
and its button to **Untrack**; starting Section 1 then showed the HUD line "Tracking · Names in the Index ·
0/4" at top 104. Setting the checkpoint to 21 made **Section 22 · The Gilded Reliquary** selectable; the run
loaded at depth 21 with roster `rivet_squire, solder_wisp, cog_hound, bone_picker, cinder_stalker,
spire_marksman`, boss `reliquary_warden`, and the floor line read Section 22 · The Gilded Reliquary. At
390x844 the journal kept 13 cards, a 358.8px card ending at 374.4px, a 59.7px Track button and no horizontal
overflow. A fresh dev server reported 0 console errors; an earlier server died mid-session and its
ERR_CONNECTION_REFUSED storm was infrastructure, not the game. Screenshots
`docs/qa/cycle100-quest-log-tracked-1280x720.png`, `cycle100-hud-tracker-1280x720.png`,
`cycle100-gilded-reliquary-1280x720.png`, `cycle100-quest-log-390x844.png`.
### Gate results
See the task summary.

## Cycle 101 - Notice board, in-run journal, bonus tiers, relic sets and new lore
### FIND
The player asked for better quest UI, a proper Notice Board, quests readable like the inventory in game, deeper quest
mechanics, improved items, more quests and more lore. The code showed the gaps: the Notice Board building only opened
the quest log, there was no in-run quest hotkey, quests paid a flat reward with no reason to overshoot, residents had
two chapters, relics had no set bonuses, and the lore held 35 fragments and 11 core memories.
### IMPLEMENT
- `src/sim/run.ts`, `src/save/SaveStore.ts`, `src/sim/world.ts`: `eliteKills` on the run stats and meta, incremented
  when an elite dies and carried through settlement.
- `src/sim/quests.ts`: `elites`, `relics` and `trust` objective kinds; `QuestSource` snapshot fields; `questRawProgress`
  and `questProgress`; a 20%-past-target bonus tier paying 40% extra echoes with per-objective caps; a third chapter for
  every resident (18 quests) with epilogues; `questChapterLabel`; `questBoardEntries`; `applyQuestClaim` bonus argument.
- `src/ui/Screens.ts`: a real `noticeBoardScreen` with pinned notes, Accept/Track/Visit, and bonus/chapter information in
  the journal; active relic-set chips on the bag and a set line on the item sheet.
- `src/app/App.ts`, `src/input/Input.ts`, `src/ui/TouchControls.ts`: the journal opens in a run with **J** (touch:
  Quests) as an overlay with its own `quests` state, the Notice Board station opens the board, and the tracker stays
  visible behind the journal.
- `src/sim/equipment.ts`: four three-piece sets (Ashforged, Tidebound, Voidwrought, Reliquary) with `setForRelic`,
  `activeSets`, `setMods`, applied after item mods.
- `src/data/lore.json` (+ `assets/data/lore.json`): five new fragments (Reliquary, Orchard, past-Keeper void) and core
  memory 12 **The Gilded Ledger** grouping them (40 fragments, 12 cores).
- Tests: `quest-mechanics` (7), `item-sets` (6), `ui-quest-board` (3); updated quest-chapter counts, the snapshot
  equality and the lore/core grouping and README-count assertions.
### RECORD
In Edge at 1280x720 the Notice Board showed six pinned notes; the first read "The Archivist · Chapter 1 of 3" with
"60 echoes · bonus +24 at 5" and Accept/Track/Visit. Accepting moved it to In progress (subtitle "5 open notices · 1 in
progress"), and Track set `meta.trackedQuest` to `names`. The journal then showed 19 cards (18 chapters plus the daily),
chapter labels, a second bonus bar reading "Bonus +24 echoes 0/5", and the tracked border. Starting Section 1 and
pressing **J** opened the journal in place (state `quests`, 19 cards) with the HUD tracker visible at "Tracking · Names
in the Index · 0/4"; J again returned to play. Wearing Colossus Plate and Iron Helm showed the bag chip "Reliquary 2/3"
and the sheet line "Reliquary · 2/3 worn / 2 pieces: +20 health / 3 pieces: +8% damage reduction". At 390x844 the board
kept six notes at 358.8px ending at 374.4px with no horizontal overflow. A fresh server reported 0 console errors.
Screenshots `docs/qa/cycle101-notice-board-1280x720.png`, `cycle101-quest-log-bonus-1280x720.png`,
`cycle101-ingame-questlog-1280x720.png`, `cycle101-item-set-1280x720.png`,
`cycle101-notice-board-390x844.png`.
### Gate results
See the task summary.

## Cycle 102 - Weekly contracts, guardian lore and a truthful set count
### FIND
The journal had a daily mark but no week-long contract; the boss bar showed only a name although every bestiary record has a
description; a single worn set piece read 0/3 because the sheet counted only active (two-piece) sets; and the resident's task
page omitted the bonus tier that the board and journal show.
### IMPLEMENT
- `src/save/SaveStore.ts`: `weeklyKey` (ISO-8601 YYYY-Www, UTC) and `Meta.weeklyBounty` with recovery and defaults.
- `src/sim/quests.ts`: `weeklyBounty` over six late enemies (40 kills, 800 echoes) and `claimWeeklyBounty`; progress resets
  with the week instead of carrying over.
- `src/app/App.ts`: matching kills advance the weekly contract; the journal renders a Weekly contract card with progress
  and a claim action that pays once.
- `src/sim/content.ts`, `src/ui/Hud.ts`, `ui.css`: `EnemyDef.description` from the bestiary, a `.boss-lore` line under the
  boss name, and a tracker that hides while a guardian is on screen but keeps its text for afterwards.
- `src/sim/equipment.ts`, `src/ui/Screens.ts`: `wornSetCount` so the sheet reads 1/3 before the bonus starts; the resident
  task page now appends "bonus +N at M" to its progress line.
- Tests: `weekly-contract` (5), `boss-lore` (2), an added `wornSetCount` case and updated journal wiring checks.
### RECORD
In Edge at 1280x720 the journal showed 20 cards and a Weekly contract for Lantern Wraiths: "Hunt 40 lantern wraiths before
the week turns", reward 800 echoes, 0/40. Setting progress to 40 and claiming paid 800 echoes and left the card at
"Claimed" 40/40. Spawning a Reliquary Warden showed the boss bar with the exact bestiary line "A gilded construct that keeps
the vault's ledger. It counts every relic you carry before it strikes." and hid the HUD tracker (its text was retained).
Wearing a single Colossus Plate showed "Reliquary · 1/3 worn" on the sheet and no chip until a second piece. At 390x844 the weekly
card measured 358px ending at 374px with no horizontal overflow; a fresh server reported 0 console errors. Screenshots
`docs/qa/cycle102-weekly-contract-1280x720.png`, `cycle102-guardian-lore-1280x720.png`.
### Gate results
See the task summary.

## Cycle 103 - A Bestiary codex records every species on first sight
### FIND
The Recovered Memories screen carried the fragment and core-memory lore but had no record of the 97 enemies in the game. A
first kill announced nothing, and the field-guide descriptions used by the boss bar in Cycle 102 could not be read later.
### IMPLEMENT
- `src/sim/content.ts`: `guardianIds()` from the floor plans, and `bestiaryEntries(seen)` returning every enemy once,
  regular species before guardians, alphabetical, with saved phantom ids ignored.
- `src/save/SaveStore.ts`: `Meta.bestiary` with a `[]` default for old saves.
- `src/app/App.ts`: the first `enemyDied` for a def id appends it to the record, saves the meta and toasts
  "Bestiary · <name> recorded".
- `src/ui/Screens.ts`, `ui.css`: the Memories screen becomes a two-tab codex; the Bestiary panel lists 97 cards with a
  recorded count, a guardian tag, sealed "Unknown enemy" text until first sight and the field-guide line afterwards.
- Tests: `tests/bestiary.test.ts` (5) plus the README bullet.
### RECORD
In Edge at 1280x720 the Memories screen showed Memories/Bestiary tabs; the Bestiary panel held 97 cards (25 guardians) and
read "0 / 97 recorded · defeat an enemy to reveal its field notes." with every card sealed. A seeded record of Gutter
Runner, Memory Echo and Reliquary Warden read "3 / 97 recorded", revealed those three field-guide lines, kept the
Reliquary Warden in the guardian band and left the other 24 guardians sealed. At 390x844 the panel measured 358.8px ending
at 374.4px with one column and no horizontal overflow; a fresh server reported 0 console errors. Screenshots
`docs/qa/cycle103-bestiary-1280x720.png`, `cycle103-bestiary-390x844.png`.
### Gate results
See the task summary.

## Cycle 104 - A Bestiary that counts kills, filters itself and rewards completion
### FIND
The codex listed 97 species, but a recorded card showed only a name and field-guide line: nothing said how often a species
had been met, there was no way to narrow 97 cards to what remained or to the guardians, and recording every species paid
nothing.
### IMPLEMENT
- `src/sim/content.ts`: `BestiaryEntry.kills`, `bestiaryProgress(seen)` against the real enemies list, and
  `filterBestiary(entries, filter)` for the all/seen/sealed/guardians views.
- `src/save/SaveStore.ts`: `Meta.bestiaryKills` (per-def defeat counts) and `Meta.codexReward`, both defaulted for old saves.
- `src/app/App.ts`: every kill increments its species counter; the first complete codex pays 1000 echoes once, sets
  `codexReward` and toasts it.
- `src/ui/Screens.ts`, `ui.css`: recorded cards read "Defeated xN", a four-button filter bar and a `.beast-grid` replace the
  flat list, and a complete record shows the whole-codex line plus a `.codex-complete` banner.
- Tests: `tests/bestiary-depth.test.ts` (5) plus the README bullet.
### RECORD
In Edge at 1280x720 a seeded record of Gutter Runner, Memory Echo and Reliquary Warden read "3 / 97 recorded" with
"Defeated x4", "Defeated x12" and "Defeated x1"; **Recorded** left those three cards, **Guardians** left exactly 25
guardian cards (first "Unknown guardian") and **All** restored 97. Seeding every species read "Every species recorded ·
97 / 97 · the codex is whole." with the banner "Codex complete · the deep has no more names to hide." At 390x844 the panel
measured 358.8px ending at 374.4px, one column, filter row 29px, no horizontal overflow; a fresh server reported 0 console
errors. Screenshots `docs/qa/cycle104-bestiary-complete-1280x720.png`, `cycle104-bestiary-390x844.png`.
### Gate results
See the task summary.

## Cycle 105 - A Bestiary card opens onto its habitat and its sealed numbers
### FIND
The codex named and counted 97 species but never said where one could be met: a sealed entry was a dead end, and a recorded
one could not be revisited for its health, damage and XP without meeting the enemy again.
### IMPLEMENT
- `src/sim/content.ts`: `enemyHabitats(id)` and `bestiaryDetail(id, seen, kills)`, both derived from `FLOOR_PLANS`.
- `src/ui/Screens.ts`: cards become `role="button"` with `aria-expanded` and Enter/Space toggling, and expand a
  `.beast-detail` block holding a stats line and a "Found in Section N (title)" line.
- `src/ui/ui.css`: `.beast.open`, `.beast-more`, `.beast-detail`, `.beast-stats`, `.beast-habitat`; the label sits at 0.72
  alpha so the palette contrast floor stays green.
- Tests: `tests/bestiary-habitats.test.ts` (6) plus the README bullet.
### RECORD
In Edge at 1280x720 the recorded Memory Echo opened to "Health 30 · Damage 17 · XP 15" and "Found in Section 1 (Forgotten
Ruins), Section 2 (Whispering Forest), Section 24 (Sanctuary of Reconstruction), Section 25 (The First Remembering)". A
sealed guardian opened to "Sealed · record it to read its numbers." with "Found in Section 21 (Echo Trial: The Drowned
Court · guardian)"; pressing Enter on the focused card collapsed it and set aria-expanded back to false. At 390x844 the
card measured 308.8px inside a 358.8px panel ending at 374.4px with no horizontal overflow; a fresh server reported 0
console errors. Screenshots `docs/qa/cycle105-bestiary-detail-1280x720.png`, `cycle105-bestiary-detail-390x844.png`.
### Gate results
See the task summary.
## Cycle 106 - A sealed memory fragment names the biome that hides it
### FIND
Sealed fragments were three dots with no route hint, and the Memories tab never said how much of the forty-fragment lore
remained even though every fragment already carried a biome location.
### IMPLEMENT
- `src/sim/content.ts`: `fragmentHabitat(id)` resolves the biome name (undefined for unknown ids), and
  `memoriesProgress(owned)` counts fragments and restored cores against the real totals.
- `src/ui/Screens.ts`: the Memories panel gains a progress line and a "Not yet found · the <biome>" row under each sealed
  fragment.
- `src/ui/ui.css`: `.frag-location` in the dim ink token; the sealed row keeps its original opacity rule.
- Tests: `tests/memories-locations.test.ts` (5) plus the README note.
### RECORD
In Edge at 1280x720, seeding fragment_001 and fragment_002 read "2 / 40 fragments · 0 / 12 memories restored"; 38 sealed
fragments carried hints, the first four reading "Not yet found · the Forgotten Ruins", while the two recovered fragments
showed their text with no hint. At 390x844 the panel measured 358.8px with no horizontal overflow; a fresh server reported
0 console errors. Screenshot `docs/qa/cycle106-memory-hints-1280x720.png`.
### Gate results
See the task summary.