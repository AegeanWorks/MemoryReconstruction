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
| 1 | Combat feel | In progress |

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
