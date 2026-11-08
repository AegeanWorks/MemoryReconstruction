# Engagement: what the literature says, and what the game does

Source review: cyberpulse's `.aikit/decisions.md` (ADR-002 and follow-ups),
which grounds its retention design in behavioral psychology: Skinner's
variable-ratio reinforcement schedules, Clark et al.'s near-miss effect,
loss aversion and push-your-luck, meta-progression and achievement systems,
difficulty modes, daily challenges, streaks, and onboarding checklists.

This file maps each idea onto Memory Reconstruction, including extensions
added here that go beyond the cyberpulse review.

## Already native (predates the mapping)

- **Variable-ratio rewards** (Skinner): loot surges, jackpots, destabilising
  kills — payout size and timing are unpredictable by design.
- **Near-miss feedback** (Clark et al.): dash grazes and the critical-health
  clutch surge turn almost-dying into a comeback moment.
- **Meta-progression**: Sanctuary restorations, the vault kit, relic reforge,
  memory fragments kept across death.
- **Difficulty modes** with honest trade-offs (story / normal / nightmare),
  applied symmetrically to incoming and outgoing damage.
- **Onboarding**: prologue story, first-run contextual tips, field-manual
  checklist with the next unlearned basic on screen.

## Ported from the review

| Cyberpulse ADR | Memory Reconstruction |
|---|---|
| 002 push-your-luck, 019 extraction surge | Cursed caches: free to leave, costly to break, double payout plus an elite ambush. Risks are stated up front (Meyer et al. rewards preview). |
| 002 loss aversion, 033 dead man's switch | Soul anchor relic: one lethal blow per anchor is refused instead of the walker. |
| 015/016 living grid, hunters | Stalker pressure: every third cleared hostile room arms an elite hunter for the next fight, with a HUD radar chip while hunted. |
| 019 near-miss comebacks | Clutch kills: finishing blows under 25% HP pay bonus shards on the spot. |
| 020/022 contracts, trust | NPC trust 0-3 with friends'-share claim bonuses, gift tributes, and a one-time parting gift at full trust. |
| 022 rush bonuses | Bounties of attention instead of clocks: stalker and ambush waves pay elites' bonus XP/shards; no FOMO timers on quests by design. |
| 028 milestones/badges | 12 feats evaluated idempotently at settlement, with a hub grid and unlock toasts. |
| 029/032 daily + streaks | Daily descent (one shared seed), per-day best, gap-resetting streak, plus a daily twist modifier. |
| 035 scoring, hall of fame | Transparent itemised run score, persistent best, legacy lines on end screens. |
| 037 onboarding checklist | Field manual + tips; settings apply live everywhere including Set Out. |
| 039 frictionless switching | Difficulty selector lives on the Set Out screen, not just in settings. |
| 011 overdrive/combo loop | Flow streaks with milestone announcer callouts; resonance multiplier as the combo meter. |
| 012 legacy summary | Death/victory screens report score, best, new feats, and where the run fell. |

## Extended here (beyond the review)

- **Endowed progress** (Nunes & Dreze): feat tiles show live tallies
  ("Slayer 71/500") and the hub shows unfinished business
  ("Last expedition · Section 8 · score 188 — forgotten"), so returning
  players start already partway toward something.
- **Zeigarnik via quest badges**: every open task is visible from the hub;
  ready-to-claim pulses. Unfinished loops itch.
- **Loss-framed warnings**: the cache states its price before the choice,
  which makes taking the risk feel owned rather than sprung.
- **Trust as a two-way ledger**: tributes cost echoes up front (sunk-cost
  commitment), pay back in bonuses and a gift — reciprocity, not a shop.
- **Streak announcer as a reinforcement schedule**: flow milestones are
  named at widening intervals (5, 10, 15, then every 10), echoing the
  variable-ratio cadence in social form.
