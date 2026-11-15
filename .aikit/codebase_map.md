# Codebase Map & Symbol Catalog 🗺️

> **AUTO-GENERATED & VERIFIED BY `scripts/update_knowledge_base.py`**
> This document catalogues Python modules, classes, and exported functions. See Map Coverage for any stack it does not index.

---

## 📊 Codebase Metrics
- **Total Python Modules**: `6`
- **Total Classes**: `0`
- **Total Top-Level Functions**: `95`
- **Total Class Methods**: `0`
- **Total Source Lines**: `4784`

## 🧭 Map Coverage
- **Indexed**: python (`6` module(s))
- **Not indexed by this map**: javascript (`1` file(s)), typescript (`241` file(s))

> Only Python symbols are catalogued. A language above is reported as not indexed, never as verified by this map.

---

## 📦 Modules & Exported Symbols

### [`scripts/audit_commit_ranges.py`](scripts/audit_commit_ranges.py)
> *Generate the cumulative commit-range inventory used by the audit.*

**Size**: `139` lines (`5215` bytes)

**Functions:**
- `def git(*args)` - *Run a git command in the project root with a hard timeout.*
- `def commit_rows()` - *Return `(short hash, subject)` for every content commit, oldest first.*
- `def deep_dive_ranges()` - *Ranges with a narrative section in the curated audit report.*
- `def build_inventory()`
- `def main()`

---

### [`scripts/generate_art_assets.py`](scripts/generate_art_assets.py)
> *Generate the Memory Reconstruction art set.*

**Size**: `3893` lines (`211167` bytes)

**Functions:**
- `def rgba(color, alpha)`
- `def blank(cell)`
- `def ellipse(draw, cell, x0, y0, x1, y1, fill, outline, width)`
- `def rect(draw, cell, x0, y0, x1, y1, fill, outline, width, radius)`
- `def poly(draw, cell, points, fill, outline, width)`
- `def line(draw, cell, points, fill, width)`
- `def glow(img, paint, blur)`
- `def downsample(img, cell)`
- `def save_cell(img, cell, path)`
- `def mix(a, b, t)`
- `def player_scarf(state, t, bob)` - *Two trailing cloth tails that read as a scarf, not a checkmark.*
- `def scarf_ribbon(points, start_width, end_width)` - *Builds a tapered band from a mostly horizontal centerline.*
- `def player_frame(state, frame, frames, weapon)`
- `def _enemy_common(draw, cell, style, row, frame, t)`
- `def _enemy_eyes(draw, cell, cx, cy, style, spread, r)` - *Draws an archetype's eye motif.*
- `def _construct(draw, cell, style, row, frame, t)`
- `def _hunched(draw, cell, style, row, frame, t)`
- `def _scavenger(draw, cell, style, row, frame, t)` - *A lean rag-picker: bone mask, loot sack and one overlong claw arm.*
- `def _bombardier(draw, cell, style, row, frame, t)` - *A stout bomber: fuse hood, bomb bandolier and a round bomb in hand.*
- `def _cave_crawler(draw, cell, style, row, frame, t)` - *A low, wide cave dweller with oversized ears and long forearms.*
- `def _plague_caster(draw, cell, style, row, frame, t)` - *A thin plague doctor: long beak, wide hat and a vial staff.*
- `def _hive_guard(draw, cell, style, row, frame, t)` - *A bulky chitin guard: plated torso, mandibles and a barbed spear.*
- `def _archer(draw, cell, style, row, frame, t)` - *A skeletal archer: ribcage, skull, bow and a back quiver.*
- `def _wisp(draw, cell, style, row, frame, t)`
- `def _beast(draw, cell, style, row, frame, t)`
- `def _duelist(draw, cell, style, row, frame, t)`
- `def _keeper(draw, cell, style, row, frame, t)`
- `def _warden(draw, cell, style, row, frame, t)`
- `def _serpent(draw, cell, style, row, frame, t)`
- `def _matriarch(draw, cell, style, row, frame, t)`
- `def _regent(draw, cell, style, row, frame, t)`
- `def _sovereign(draw, cell, style, row, frame, t)`
- `def _giant(draw, cell, style, row, frame, t)`
- `def _queen(draw, cell, style, row, frame, t)`
- `def _cantor(draw, cell, style, row, frame, t)` - *The Void Cantor: a floating chorister whose lower body dissolves.*
- `def _oracle(draw, cell, style, row, frame, t)` - *A hovering seer: no feet, wide sleeves, a scrying orb held at the chest.*
- `def _herald(draw, cell, style, row, frame, t)` - *A tall banner-bearing wraith; the banner streams behind the shoulder.*
- `def _witch(draw, cell, style, row, frame, t)` - *A petal witch: wide hat, blooming gown, staff crowned with a blossom.*
- `def _tyrant(draw, cell, style, row, frame, t)`
- `def _hound(draw, cell, style, row, frame, t)`
- `def _hierophant(draw, cell, style, row, frame, t)`
- `def _behemoth(draw, cell, style, row, frame, t)`
- `def rim_light(img, color, offset, strength)` - *Lights the top-left silhouette edge so actors read against dark tiles.*
- `def enemy_frame(kind, row, frame, frames, cell)`
- `def tile_image(biome, tile_type, variant)`
- `def background_image(biome)`
- `def prop_image(kind)`
- `def ui_image(kind)`
- `def particle_image(kind)`
- `def banner_image()`
- `def build()`

---

### [`scripts/generate_graphics.py`](scripts/generate_graphics.py)
> *Generate graph visualizations for Memory Reconstruction game.*

**Size**: `103` lines (`3770` bytes)

**Functions:**
- `def create_graph(path, category, index, size)` - *Create a network graph visualization with nodes and edges.*
- `def main()`

---

### [`scripts/generate_proper_graphics.py`](scripts/generate_proper_graphics.py)
> *Generate proper 2.5D-style sprites for Memory Reconstruction game.*

**Size**: `280` lines (`10540` bytes)

**Functions:**
- `def draw_gradient(draw, size, colors)`
- `def add_outline(draw, bbox, color, width)`
- `def create_player_sprite(state, palette)`
- `def create_enemy_sprite(name, palette)`
- `def create_tileset_sprite(name, palette)`
- `def create_ui_icon(name, palette)`
- `def create_particle_sprite(name, palette)`
- `def main()`

---

### [`scripts/generate_relic_icons.py`](scripts/generate_relic_icons.py)
> *Draw one icon per relic in src/data/equipment.json into assets/sprites/ui/relic_<id>.png.*

**Size**: `338` lines (`17349` bytes)

**Functions:**
- `def _diagonal_blade(d, tip, hilt, half_width, fill, edge, guard, grip, pommel)` - *A straight blade from hilt to tip with a crossguard, grip and pommel.*
- `def rusted_edge(img, d)`
- `def echo_dagger(img, d)`
- `def choir_staff(img, d)`
- `def void_cleaver(img, d)`
- `def ember_core(img, d)`
- `def _torso(d, fill, trim, collar)`
- `def scavenger_vest(img, d)`
- `def crystal_mail(img, d)`
- `def void_shroud(img, d)`
- `def mire_talisman(img, d)`
- `def colossus_plate(img, d)`
- `def duelist_mantle(img, d)`
- `def _cord(d)`
- `def ember_charm(img, d)`
- `def tide_lens(img, d)`
- `def thorn_ring(img, d)`
- `def clockwork_gear(img, d)`
- `def sun_core(img, d)`
- `def bog_crown(img, d)`
- `def soul_anchor(img, d)`
- `def storm_dial(img, d)`
- `def ember_ward(img, d)`
- `def scout_hood(img, d)`
- `def iron_helm(img, d)`
- `def oracle_circlet(img, d)`
- `def void_visor(img, d)`
- `def main()`

---

### [`scripts/resize_sprites.py`](scripts/resize_sprites.py)
> *Resize every PNG sprite under a folder to 256x256 in place.*

**Size**: `31` lines (`1055` bytes)

**Functions:**
- `def main(argv)`

---
