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
