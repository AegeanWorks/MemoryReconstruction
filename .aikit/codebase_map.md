# Codebase Map & Symbol Catalog 🗺️

> **AUTO-GENERATED & VERIFIED BY `scripts/update_knowledge_base.py`**
> This document provides an automated, up-to-date registry of all modules, classes, and exported functions across this repository.

---

## 📊 Codebase Metrics
- **Total Python Modules**: `4`
- **Total Classes**: `0`
- **Total Top-Level Functions**: `50`
- **Total Class Methods**: `0`
- **Total Source Lines**: `2843`

---

## 📦 Modules & Exported Symbols

### [`scripts/generate_art_assets.py`](scripts/generate_art_assets.py)
> *Generate the Memory Reconstruction art set.*

**Size**: `2429` lines (`127943` bytes)

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
- `def player_scarf(state, t, bob)`
- `def player_frame(state, frame, frames, weapon)`
- `def _enemy_common(draw, cell, style, row, frame, t)`
- `def _construct(draw, cell, style, row, frame, t)`
- `def _hunched(draw, cell, style, row, frame, t)`
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

### [`scripts/resize_sprites.py`](scripts/resize_sprites.py)
> *Resize every PNG sprite under a folder to 256x256 in place.*

**Size**: `31` lines (`1055` bytes)

**Functions:**
- `def main(argv)`

---
