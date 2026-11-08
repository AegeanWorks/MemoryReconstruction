# Implicit State Machines

Date: 2026-11-08

## Why this exists

MemoryReconstruction keeps state in three uncoordinated places:

- `App.state` and local flags in `src/app/App.ts`;
- DOM classes (`.screen`, `.hidden`, `.dim`, `.sanctuary-hub`) in `src/ui`;
- plain sim records with string unions and float timers in `src/sim`.

There is no transition table and no guard layer. The inventory below records
every machine found, the transitions that own it, and the risk of adding a
state without updating its consumers. The goal is better UX (fewer dead ends and
lies), DX (one place to understand a transition), and AX (pure helpers and
tests an agent can extend safely) without a large rewrite.

## Inventory

| # | Machine | Truth owner | States / fields | Main transition sites | Main risk | Coverage |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | App lifecycle | `App.state` | title, hub, sanctuary, playing, paused, choice, map, inventory, transition, dead, victory | 22 assignments in `App.ts`; buttons, events, timers | `hub` covers 10 screens; `hub` can coexist with a live sanctuary world; `paused` doubles as a room menu | None (no App tests) |
| S2 | Death / victory / retry | `state`, `deathTimer` | no death, linger, settled | `playerDied`, `simulate`, `endRun`, retry buttons | double settlement; late victory after death; abandon also settles | Indirect sim tests only |
| S3 | Overlay / screens | `Screens.current`, `keyHandler` | one screen at most | `Screens.show/close`, every menu | DOM is a second authority; different exits for the same overlay | CSS-only UI tests |
| S4 | Sanctuary hub / room | `state`, `world.mode`, `activeBuilding` | hub UI, walkable room, room menu | `showHub`, `enterBuilding`, `showSanctuaryMenu`, `buildingExit` | Escape and bag Close leave the room while Step away and `I` stay | Sim sanctuary layout tests only |
| S5 | Pending choice | `run.pendingChoices`, `state='choice'` | none, N pending | `grantXp`, chest, wayfarer, well, reroll, `applyChoice` | stale card can throw; sim freeze is load-bearing | `world`, `restore-run` |
| S6 | HUD modes | `Hud` classes and timers | hidden, dim, banner, boss bar, stalked, hint, checklist, flow, prompt | `Hud.update/handle`, App calls | no global `.hidden`; prompt `default` can mislabel | CSS regex only |
| S7 | Tutorial | `seenTutorial`, tip flags, `onboarding`, hint | four independent systems | `startExpedition`, `tutorialTips`, sim, `enterFloor` | prologue marked seen before it is shown | `hub` only |
| S8 | Input latches | 9 latches, held set, pad edges | pressed, consumed, held | `Input.keyDown`, `pollGamepad`, `frame`, `releaseAll` | gameplay latches behind menus | New `input-menu-gate` |
| S9 | Settings / save presence | `meta.settings`, `store.hasRun` | defaults, saved, missing | settings screen, `applySettings`, save calls | split application; save-exists recomputed per render | `save`, `save-settings-default` |
| S10 | Floor transition | `state='transition'`, `.fade` | playing, fade, next floor | `nextFloor`, `enterFloor` | a timeout can resurrect a settled run | Sim only |
| S11 | Player action | `player.action` | idle, move, attack, dash, dead | `updatePlayer`, `startDash`, `world.damagePlayer` | stagger during dash is ignored | `world`, `systems` |
| S12 | Swing / combo / buffer | `swingTime`, `combo`, `comboWindow`, `attackBuffer` | steps, active, queued | `startSwing`, `updateSwing`, `updatePlayer` | art + attack in one frame; buffered hit lost after stagger | `attack-buffer`, `world`, `arsenal` |
| S13 | Invulnerability / stagger | `invulnerable`, `stagger` | none, dash i-frames, hurt i-frames, status | `damagePlayer`, pickups, soul anchor, player update | three immunity sources with no provenance; stagger has no stack rule | `world`, `graze-attacks`, `systems` |
| S14 | Enemy state | `enemy.state` | spawning, chase, windup, attack, recover, stagger, dying | `updateEnemy`, `beginWindup`, `finishAttack`, `killEnemy` | every hit staggers non-bosses; recover can be extended | `world`, `windup-*`, `melee-human` |
| S15 | Attack / boss phase / pattern | `attack`, `attackLanded`, `phase`, `patternIndex` | 25 attack kinds, phases 0-2 | `windupDuration`, `launch`, `attack`, `updateBossPhase` | a double phase jump emits one event; windup and finish use different floors | `crystal-golem`, `sweep`, `mortar`, `mine`, `wall`, `spiral`, `volley`, `ui-boss-aura` |
| S16 | Summon / swarm cap | `MAX_SUMMONS`, `summonCount` | under cap, at cap | `summon`, `swarm`, pattern substitution | cap counts natives, so a full room silently switches to `ring` | `summon-cap`, `swarm-cap` |
| S17 | Room phase | `RoomState.phase`, waves, ambush/storm flags | dormant, active, cleared | `updateRooms`, `activateRoom`, `spawnWave`, `clearRoom` | teleporting out of an active room can strand its waves | `world`, `colosseum`, `systems` |
| S18 | Gates / levers / vault / teleport | interactable flags and grid tiles | unused/used, sealed/open | `interact`, `openVault`, `useWaystone`, `gateSpawn` | teleports bypass door locks; vault lever skips hazard disarm | `frontier-world`, `gate-spawn` |
| S19 | Floor / run lifecycle | `World.exited/victory/victoryDelay`, App state | playing, exited, victory, ended | `advance`, `enterFloor`, `nextFloor`, `endRun` | death keeps the sim running; double settle | Sim only |
| S20 | Save / restore | `RunState`, `Meta` | valid, rejected, repaired | `restoreRun`, `dropPhantomRelics`, `recordRun` | weapon id unvalidated; World state never saved | `restore-run`, `save` |
| S21 | Hazards / props | `Hazard.phase/timer/disabled`, hp | idle, warning, active; trap arming; breakable | `updateHazards`, `disableHazards`, `damageHazard` | one timer drives four behaviours; disabled warning stayed frozen | `systems`, `mine-telegraph` |
| S22 | Projectiles / bombs / mines / blasts | `life`, `fuse`, `arm`, `hitIds`, `grazed` | alive, hit, expired | four update loops and removals | fuse written by three sources; sticky graze | `arsenal`, `graze-attacks` |
| S23 | View animation / telegraph | `ActorSprite.current`, sim `state/stateTime` | animation identity, windup progress, live beam | `ActorView.play/update/telegraph`, `telegraph.ts` | raw seconds mixed with normalized progress; hard-coded duplicate timings | Pure helper tests; source-grep tests |
| S24 | Camera / effects / labels | renderer and Effects fields | snap/ease, shake, flash, lifetimes | `Renderer.updateScene`, `Effects.update` | two clocks (real dt vs frozen sim); label snapshot never refreshed | Pure camera helper only |
| S25 | Audio unlock / ambience | `Sound.ctx`, `ambienceKey`, throttle map | locked, unlocked, playing, stopping | `unlock`, `playAmbience`, `stopAmbience` | requests before unlock were dropped | `audio-cues`, `spawn-audio` |
| S26 | Persistence history / daily | `recordRun`, `settleDaily`, `lastRun`, `runHistory` | unsettled, settled, streak | `recordRun`, `settleDaily` | local/UTC day mismatch; non-idempotent counters | `save` |

## Verified findings

These were verified against the current code, not just the first read:

1. **Double settlement** — `App.endRun` had no latch while `frame` still ticks
   `world.victoryDelay`; dying within 2.5 s of the final boss could call
   `recordRun` twice.
2. **State-blind lifecycle events** — `floorExit`/`victory` were handled
   regardless of `App.state`, so a settled run could transition/resurrect.
3. **Prologue skipped on back** — `startExpedition` set `seenTutorial` before
   showing the prologue; backing out permanently marked it seen.
4. **Overlay exits disagree** — Escape from a room panel and the bag's Close
   destroyed the sanctuary world, while Step away and `I` returned to the room.
5. **Gameplay input latched behind screens** — `Input.keyDown` added held keys
   and one-shot latches even while `.screen` was open.
6. **Ring telegraph used raw seconds** — `ActorView` computed
   `e.radius + 10 + (1 - e.stateTime) * 30`, so short and long windups breathed
   differently and the ring could understate the hazard.
7. **Damage numbers setting lost on a new floor** — `Renderer.setDamageNumbers`
   only touched an existing scene; a new `Effects` defaulted back on.
8. **Ambience request dropped before unlock** — `playAmbience` returned without
   recording the key, and `unlock` never replayed it; the title could stay
   silent.
9. **Restored weapon not validated** — `restoreRun` used `??= 'sword'`, so an
   unknown string survived into `player.weapon`.
10. **Disarmed hazard kept its warning** — `disableHazards` set `disabled` but
    left `phase='warning'` and `timer`, so the view kept a dead telegraph.
11. **Footstep landing poof was dead code** — `lastMoving` was overwritten
    before the transition check.
12. **HUD prompt catch-all** — unknown interactables were labelled as the
    Memory Well.

## Proposals and decisions

| ID | Proposal | UX | DX | AX | Risk | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | One-way run settlement latch + state-gated `playerDied`/`floorExit`/`victory`/abandon/fade | no double screen or double bank | one lifecycle rule | explicit guard | low | **Implemented** |
| P2 | Mark the prologue seen only on completion | first descent always tells its story | clear onboarding rule | testable helper | low | **Implemented** |
| P3 | Overlay close/Escape returns to the room it opened over | no surprise teleport | one return rule | fewer DOM probes | low | **Implemented** |
| P4 | Input never latches gameplay while a screen is open | no hidden swing after closing a menu | explicit menu boundary | unit-tested gate | low | **Implemented** |
| P5 | Normalized ring telegraph helper | honest windup read | one formula | pure helper test | low | **Implemented** |
| P6 | Persist damage-number setting across floor rebuilds | setting stays put | settings applied at scene creation | no new API | low | **Implemented** |
| P7 | Cache and replay pre-unlock ambience | title music returns | one unlock contract | small state field | low | **Implemented** |
| P8 | Validate restored weapon ids | corrupt saves degrade cleanly | reuse `isWeaponId` | boundary test | low | **Implemented** |
| P9 | Disarm resets hazard phase/timer | no dead telegraph | one disarm rule | regression test | low | **Implemented** |
| P10 | Read `lastMoving` before overwriting it | landing dust returns | dead code removed | no new API | low | **Implemented** |
| P11 | Explicit shrine prompt + safe catch-all | no false Memory Well label | no silent default | future kinds safe | low | **Implemented** |
| D1 | Revalidate room locks after teleport | prevents rare stall | explicit invariant | needs design | medium | Deferred |
| D2 | Stun-lock guard for non-bosses | fairer fights | balance rule | needs tuning | medium | Deferred |
| D3 | Resolve stagger vs dash precedence | one feel | one status owner | feel change | medium | Deferred |
| D4 | Emit every crossed boss phase | audio matches aura | one event per phase | event contract | medium | Deferred |
| D5 | Persist World or save only at entrances | no mid-floor replay | snapshot contract | schema work | high | Deferred |
| D6 | Full explicit FSM framework for every machine | no direct gain | large migration | large migration | high | Rejected for now |
| D7 | Suspend audio on pause/auto-pause | quieter pause | one lifecycle hook | autoplay semantics | low-medium | Deferred |
| D8 | Resolve banner timer / element mismatch | consistent toast | one source | visual test | low | Deferred |
| D9 | Guard stale choice-card clicks | no uncaught throw | explicit stale check | edge test | low | Deferred |
| D10 | Field-wise meta recovery/migration | less career loss | schema migration | versioned saves | medium | Deferred |

## Implemented changes

- `src/app/App.ts`: `runSettled` one-way latch; state guards for death, floor
  exit, victory and abandon; guarded fade timeout; prologue marked seen on
  completion; room-preserving overlay exits.
- `src/input/Input.ts`: menu-open keyboard boundary; new
  `tests/input-menu-gate.test.ts` (2 tests).
- `src/view/telegraph.ts` + `src/view/ActorView.ts`: normalized
  `ringTelegraphRadius`; new `tests/ui-ring-telegraph.test.ts` (2 tests).
- `src/view/Renderer.ts`: damage-number preference persisted into every
  `Effects` created by `showFloor`.
- `src/audio/Sound.ts`: pending ambience request replayed after unlock.
- `src/sim/run.ts`: restored weapon ids validated with `isWeaponId`; case added
  to `tests/sim/restore-run.test.ts`.
- `src/sim/world.ts`: `disableHazards` resets `phase`/`timer`; regression in
  `tests/sim/systems.test.ts`.
- `src/view/Effects.ts`: landing poof transition fixed.
- `src/ui/Hud.ts`: explicit shrine prompt and safe unknown-kind fallback.

## Deferred items and why

The deferred items change feel, balance, save schema or event contracts. They
need a design decision and a broader test matrix; they are not safe drive-by
edits. The rejected FSM framework would add a migration layer without a current
behavioural defect, so the project keeps plain data plus guarded boundaries and
this catalog.

## Verification

- `npm test` — 456 tests / 81 files (after the new state-machine suites)
- `npm run test:mechanics` — 365 tests / 53 files
- `npx tsc --noEmit`, `npm run lint`, `npm run build` — clean
- `python aikit.py check MemoryReconstruction` — 8/8 gates
- Targeted: `input-menu-gate` 2/2, `ui-ring-telegraph` 2/2,
  `restore-run` 10/10, `systems` 80/80
