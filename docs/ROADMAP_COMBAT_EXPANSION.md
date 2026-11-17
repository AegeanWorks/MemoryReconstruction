# Combat & Content Expansion Roadmap

Player request (2026-11-16). All four tasks are delivered.

## Task 1 - `combat-expansion` (done)
| # | Milestone | Delivered |
|---|-----------|-----------|
| 1 | Status effects core | Burn, freeze and mud; damage over time, movement slow, freeze shatter; bolts hit the drawn sprite (ADR-233). |
| 2 | Frenzy and Berserker | Frenzy x1.6 broken by a landed hit, Berserker x1.35 that never breaks, one key cycles both, red or ember screen edge (ADR-234). |
| 3 | New enemy archetypes | Prism Lancer (lane beam), Quake Colossus (radial stomp), Mire Warden (slow aura), Brine Charger (charge knockback), Bog Spitter (mud) (ADR-235). |
| 4 | Evidence and docs | ADR, cycle log, UI review, screenshots, gates. |

## Task 2 - `gear-and-limits` (done)
- Mana flask, bomb and trap carry limits with Mana Rack, Bomb Rig and Trap Kit skills (ADR-236).
- Headwear silhouettes and colours, icon-derived armor hues, capes on their own palette, head kept untinted (ADR-237, ADR-239).
- Weapon-locked relics tied to the sword, spear and long-sword stances (ADR-238).
- Sword and greatsword reach increased, and the stance displays as **Long Sword**.

## Task 3 - `world-and-levels` (done)
- Doorway hangings on the wall face beside every door, rolled from a decoration-only RNG (ADR-240).
- Two new sections: The Chitin Vault and The Thunder Vault, taking the descent to 27 sections, with a run-version migration (ADR-241).

## Task 4 - `music-muse` (done)
- 33 themed tracks in one manifest, looping playback with a crossfade, battle and ambient switching by room state,
  procedural fallback when a track is missing, and the menu keeping its hand-tuned ambience (ADR-242).
- `scripts/generate_music.py` drives the Muse project; rendering needs provider keys.
