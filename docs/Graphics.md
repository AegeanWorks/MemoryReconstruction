# Graphics System - Memory Reconstruction

## Art Direction: Memory Light

Memory Reconstruction is a fragmented world rebuilt from remembered light. The
visual language contrasts **weathered matter** with **luminous memory**:

| Element | Palette | Meaning |
|---|---|---|
| Void | `#0A0A14`, `#1F2442` | erased history, deep shadow |
| Memory cyan | `#6FE7FF` | fragments, echoes, player light |
| Pale gold | `#FFD98A` | sanctuary, UI, recovered truth |
| Lavender | `#B89CFF` | crystal and echo magic |
| Ember | `#FF6B6B` | corruption, hazards, lost life |
| Sanctuary ivory | `#FFF4D0` | reconstruction, endings |

The Memory Walker is a hooded figure in indigo cloth with a cyan scarf, a gold
memory core and a shard blade. Enemies are readable silhouettes first: hunched
scavengers, stone constructs, drifting echoes, forest beasts, crystal duelists,
void wraiths and the radiant Keeper.

## Generated Asset Pipeline

All art is deterministic and regenerated with Pillow from the project root:

```bash
python scripts/generate_art_assets.py
```

The generator writes:

```text
assets/
  manifest.json                  runtime texture/shaders/data manifest
  data/sprite_atlas.json         frame, origin, animation and tile metadata
  data/graphics.assets.json      human-readable asset catalogue
  banner.png
  sprites/player/                idle, walk, attack, dash strips
  sprites/enemies/               4x4 sheets: idle, walk, attack, death
  sprites/tilesets/              legacy side-view tiles (unused by the top-down renderer)
  sprites/backgrounds/           parallax backdrop per biome
  sprites/props/                 fountains, statues, doors, rifts, chests
  sprites/ui/                    health, mana, stamina, memory icons
  sprites/particles/             spark, smoke, blood, magic
```

### Atlas model

`sprite_atlas.json` is the single source of truth for presentation:

- `player.animations[state]` - texture strip, frame count, FPS, loop flag.
- `enemies[id]` - 64x64 grid, 4 columns, 4 rows, origin and animation rows.
- `tilesets[biome]` - legacy side-view tiles; the game paints its top-down
  tiles at runtime instead (see Runtime).
- `props` - chests, wells, the exit rift, obstacle statues/trees/crystals and the
  five hooded residents (archivist, smith, gardener, warden, lamplighter).
- `ui` - shard, fragment and potion icons used by the HUD and pickups.
- `backgrounds` - the tiling backdrop drawn behind each biome's rooms.
- `particles` - spark, smoke, blood and magic effect sheets.

The atlas is bundled at build time, while the images are served from the
`assets` public directory. Both development and production use the same
`resolveAssetUrl` helper, so relative paths work under `base: './'`.

## Runtime

- **Tiles** are painted with Canvas2D when a floor loads (`src/view/tileArt.ts`),
  using the per-biome render palettes in `src/view/palette.ts`. Floors get
  subtle per-tile variants; walls show a lit brick face wherever floor lies to
  their south and a dark cap above it, which gives the 3/4 top-down depth.
  Floors beside walls receive ambient-occlusion overlays.
- **Actors** use the atlas sheets: the player's idle/walk/attack/dash strips
  (flipped by aim) and each enemy's idle/attack/death rows. Several generated
  enemy walk rows have blank odd frames, so walking reuses the idle row with a
  bob. Living enemy frames carry a soft top-left **rim light** derived from the
  alpha edge, so silhouettes separate from dark tiles.
- **Backdrop** is a `TilingSprite` of the biome's `backgrounds` texture at 55%
  alpha behind the tile chunks, so the void between rooms carries atmosphere
  instead of reading as flat black. The biome colour stays as the base fill.
- **Lighting** is a screen-space darkness vignette centred on the player plus
  additive glows on the player, projectiles, pickups, glyphs and the rift.
- **Layers**, bottom to top: backdrop, tiles, ground (telegraphs, glows,
  pickups), depth-sorted actors and props, effects, overlay (projectiles,
  health bars), then the vignette and hurt flash.
- The `.wgsl` shaders under `assets/shaders/` are not used by the renderer.

## Characters

| Asset | Silhouette | Motion |
|---|---|---|
| Memory Walker | hood, scarf, shard blade | bob, walk, slash arc, dash streaks |
| Scavenger | hunched rags, bone mask, claws | lope, lunge |
| Guardian | blocky stone, cyan core | heavy march, slam |
| Memory Echo | floating tatters, two eyes | drift, pulse |
| Wildling | antlered forest beast | prowl |
| Spirit | antlered wisp | float |
| Cave Dweller | low body, large ears | scuttle |
| Crystal Golem | faceted mass, crystal growths | stomp |
| Shadow | tall void silhouette | phase drift |
| Crystal Guardian | slim armor, rapier | duelist sweep |
| Prism Entity | geometric shards | orbit |
| Void Walker | elongated rift | glide |
| The Forgotten | broken armor, empty helm | relentless |
| The Keeper | gold robe, halo, staff | judgment |

## Residents and rooms

The five Sanctuary residents share one silhouette: a hood brim over a shadowed
face with a bright gaze, a shoulder mantle, cuffed arms, a hem band and a role
prop (open tome, hammer and apron, shears, crested spear, hung lantern). They
are drawn to read at the 58 px in-world height.

The recurring room furniture is drawn to be recognisable at a glance: the ruins
statue is a weathered memorial (stepped plinth, bowed hood, planted sword, moss
and cracks) and the forest tree is a forked gnarled trunk under a layered
canopy.

## Biomes

Ruins use sandstone and memory dust; the forest adds emerald canopy and spores;
caves use slate and cyan veins; crystal gardens use violet facets; the void is
near-black with cyan rifts; the sanctuary is ivory and gold.

## Verification

- `npm test` checks that every image the atlas references exists.
- `npm run build` copies `assets/` into `dist/` and bundles the atlas metadata.
