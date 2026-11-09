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
