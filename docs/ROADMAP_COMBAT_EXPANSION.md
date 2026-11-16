# Combat & Content Expansion Roadmap

Player request (2026-11-16) collected into four tasks. Each task is its own
ledger entry with at most four milestones, so every milestone lands green on
its own (PRINCIPLE-008).

## Task 1 - `combat-expansion` (in progress)
| # | Milestone | Delivers |
|---|-----------|----------|
| 1 | Status effects core | Burn, freeze and mud carried by enemies and the player; damage-over-time, movement slow and freeze shatter; bolts hit the drawn sprite instead of only its centre circle. |
| 2 | Frenzy and Berserker | A frenzy stance (more damage, any hit ends it) and a berserker stance (more damage, hits never end it); red screen tint and a HUD badge while either is active. |
| 3 | New enemy archetypes | Laser (charged lane beam), stomp (radial shock on landing), slow field (aura that slows the player), dasher (knockback charge), mud (leaves slowing patches). |
| 4 | Evidence and docs | ADR, cycle log, UI review, screenshots, gates. |

## Task 2 - `gear-and-limits`
- Mana flask carry limit plus a skill that raises it.
- Trap carry limit plus a skill that raises it.
- Bomb carry limit plus a skill that raises it.
- Weapon-item category: a relic that only equips while the run uses a given
  weapon (spear, long sword, sword).
- Headwear recolours and reshapes the head band, not only the robe.
- Capes recolour the cloak band (already band-separated, extended to a palette).
- Sword and long sword reach increased by one step each.

## Task 3 - `world-and-levels`
- Door rugs drawn on the wall face beside doorways.
- Three new sections with their own rosters and guardians, plus lore hooks.
- Burn/freeze/mud hazards reused on the new floors.

## Task 4 - `music-muse`
- A music manifest (biome/room/battle variants) with prompts per theme.
- `Sound` gains looping track playback with crossfade and a battle/ambient
  switch driven by room state.
- `scripts/generate_music.py` drives the Muse project; without provider keys it
  reports what is missing instead of writing fake audio.
