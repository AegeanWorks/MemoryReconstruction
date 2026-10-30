"""Generate the Memory Reconstruction art set.

Theme: a shattered world rebuilt from memory-light. The palette moves from
weathered sandstone and deep indigo through emerald, crystal violet and void
black toward radiant sanctuary gold.

Run from the project root:
    python scripts/generate_art_assets.py

The generator is deterministic (fixed seeds), dependency-free beyond Pillow,
and writes every frame, tile, icon and atlas description used by the runtime.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SRC_DATA = ROOT / "src" / "data"
SPRITES = ASSETS / "sprites"

SS = 4
PLAYER_CELL = 64
ENEMY_CELL = 96
BOSS_CELL = 192
TILE = 32
TILE_COLUMNS = 4
TILE_ROWS = ["empty", "floor", "wall", "platform", "hazard", "water", "ladder", "door", "secret"]
TILE_ROW_INDEX = {name: index for index, name in enumerate(TILE_ROWS)}

Outline = (9, 10, 18, 255)
Shadow = (4, 5, 12, 95)

PLAYER = {
    "outline": (10, 11, 22, 255),
    "cloak_dark": (31, 36, 66, 255),
    "cloak": (52, 62, 108, 255),
    "cloak_light": (86, 104, 166, 255),
    "scarf_dark": (42, 148, 178, 255),
    "scarf": (111, 231, 255, 255),
    "scarf_light": (204, 250, 255, 255),
    "gold": (255, 217, 138, 255),
    "skin": (233, 198, 160, 255),
    "skin_shadow": (173, 132, 105, 255),
    "boot": (23, 25, 40, 255),
    "blade": (205, 238, 255, 255),
    "blade_core": (255, 255, 255, 255),
    "eye": (150, 247, 255, 255),
}

ENEMY_STYLES = {
    "scavenger": {
        "kind": "hunched",
        "body": (78, 58, 52, 255),
        "light": (132, 98, 80, 255),
        "cloth": (103, 78, 62, 255),
        "accent": (255, 166, 83, 255),
        "eye": (255, 108, 60, 255),
        "scale": 0.9,
    },
    "guardian": {
        "kind": "construct",
        "body": (74, 74, 88, 255),
        "light": (122, 122, 140, 255),
        "cloth": (96, 82, 62, 255),
        "accent": (111, 231, 255, 255),
        "eye": (170, 250, 255, 255),
        "scale": 1.0,
    },
    "echo": {
        "kind": "wisp",
        "body": (112, 104, 176, 255),
        "light": (190, 178, 246, 255),
        "cloth": (72, 62, 126, 255),
        "accent": (220, 206, 255, 255),
        "eye": (250, 250, 255, 255),
        "scale": 0.92,
    },
    "wildling": {
        "kind": "beast",
        "body": (56, 96, 60, 255),
        "light": (112, 164, 98, 255),
        "cloth": (40, 68, 44, 255),
        "accent": (190, 255, 144, 255),
        "eye": (255, 226, 106, 255),
        "scale": 0.95,
    },
    "spirit": {
        "kind": "wisp",
        "body": (72, 132, 122, 255),
        "light": (160, 226, 198, 255),
        "cloth": (44, 84, 82, 255),
        "accent": (210, 255, 222, 255),
        "eye": (250, 255, 228, 255),
        "scale": 1.0,
        "antlers": True,
        "eyes": "glare",
    },
    "caveDweller": {
        "kind": "hunched",
        "body": (116, 112, 122, 255),
        "light": (174, 168, 180, 255),
        "cloth": (78, 76, 88, 255),
        "accent": (124, 216, 255, 255),
        "eye": (222, 248, 255, 255),
        "scale": 0.86,
        "ears": True,
    },
    "crystalGolem": {
        "kind": "construct",
        "body": (104, 72, 168, 255),
        "light": (176, 140, 240, 255),
        "cloth": (56, 40, 96, 255),
        "accent": (116, 244, 255, 255),
        "eye": (236, 255, 255, 255),
        "scale": 1.08,
        "crystals": True,
    },
    "shadow": {
        "kind": "wisp",
        "body": (26, 24, 42, 255),
        "light": (62, 52, 92, 255),
        "cloth": (16, 15, 28, 255),
        "accent": (166, 104, 255, 255),
        "eye": (214, 170, 255, 255),
        "scale": 1.04,
        "eyes": "hollow",
    },
    "crystalGuardian": {
        "kind": "duelist",
        "body": (118, 88, 190, 255),
        "light": (204, 178, 255, 255),
        "cloth": (72, 50, 122, 255),
        "accent": (255, 132, 232, 255),
        "eye": (255, 244, 255, 255),
        "scale": 1.0,
    },
    "prismEntity": {
        "kind": "wisp",
        "body": (114, 140, 240, 255),
        "light": (188, 220, 255, 255),
        "cloth": (72, 76, 160, 255),
        "accent": (255, 160, 236, 255),
        "eye": (255, 255, 255, 255),
        "scale": 0.94,
        "shards": True,
        "eyes": "many",
    },
    "voidWalker": {
        "kind": "wisp",
        "body": (18, 18, 30, 255),
        "light": (54, 50, 82, 255),
        "cloth": (10, 10, 20, 255),
        "accent": (74, 226, 255, 255),
        "eye": (255, 70, 110, 255),
        "scale": 1.12,
        "rift": True,
        "eyes": "single",
    },
    "forgotten": {
        "kind": "construct",
        "body": (54, 52, 64, 255),
        "light": (102, 98, 116, 255),
        "cloth": (38, 36, 48, 255),
        "accent": (134, 120, 160, 255),
        "eye": (226, 212, 255, 255),
        "scale": 1.16,
        "broken": True,
        "eyes": "hollow",
    },
    "keeper": {
        "kind": "keeper",
        "body": (232, 208, 148, 255),
        "light": (255, 245, 208, 255),
        "cloth": (188, 154, 84, 255),
        "accent": (255, 226, 128, 255),
        "eye": (255, 255, 240, 255),
        "scale": 1.18,
    },
    "cogHound": {
        "kind": "beast",
        "body": (124, 98, 62, 255),
        "light": (196, 158, 96, 255),
        "cloth": (74, 58, 38, 255),
        "accent": (255, 179, 71, 255),
        "eye": (255, 214, 128, 255),
        "scale": 0.98,
    },
    "solderWisp": {
        "kind": "wisp",
        "body": (186, 128, 58, 255),
        "light": (255, 206, 128, 255),
        "cloth": (110, 72, 34, 255),
        "accent": (255, 196, 96, 255),
        "eye": (255, 250, 220, 255),
        "scale": 0.94,
        "eyes": "slits",
    },
    "bogLeech": {
        "kind": "beast",
        "body": (62, 88, 58, 255),
        "light": (124, 158, 92, 255),
        "cloth": (40, 58, 40, 255),
        "accent": (184, 224, 106, 255),
        "eye": (240, 255, 180, 255),
        "scale": 1.02,
        "eyes": "single",
    },
    "plagueCaster": {
        "kind": "hunched",
        "body": (84, 106, 72, 255),
        "light": (150, 176, 118, 255),
        "cloth": (52, 68, 48, 255),
        "accent": (212, 240, 128, 255),
        "eye": (240, 255, 200, 255),
        "scale": 1.0,
        "ears": True,
        "eyes": "slits",
    },
    "cinderWarden": {
        "kind": "warden",
        "body": (78, 54, 46, 255),
        "light": (196, 118, 68, 255),
        "cloth": (52, 36, 32, 255),
        "accent": (255, 138, 76, 255),
        "eye": (255, 240, 190, 255),
        "scale": 1.25,
    },
    "frostWarden": {
        "kind": "warden",
        "body": (70, 100, 124, 255),
        "light": (176, 220, 244, 255),
        "cloth": (44, 66, 86, 255),
        "accent": (159, 212, 255, 255),
        "eye": (240, 252, 255, 255),
        "scale": 1.25,
    },
    "leviathan": {
        "kind": "serpent",
        "body": (42, 78, 96, 255),
        "light": (108, 176, 196, 255),
        "cloth": (26, 50, 64, 255),
        "accent": (92, 232, 255, 255),
        "eye": (200, 255, 255, 255),
        "scale": 1.3,
        "eyes": "single",
    },
    "thornMatriarch": {
        "kind": "matriarch",
        "body": (92, 62, 84, 255),
        "light": (196, 132, 176, 255),
        "cloth": (58, 40, 60, 255),
        "accent": (255, 154, 216, 255),
        "eye": (255, 240, 255, 255),
        "scale": 1.28,
    },
    "forgottenGiant": {
        "kind": "giant",
        "body": (62, 58, 74, 255),
        "light": (124, 116, 144, 255),
        "cloth": (44, 40, 56, 255),
        "accent": (170, 150, 210, 255),
        "eye": (230, 220, 255, 255),
        "scale": 1.35,
    },
    "clockworkRegent": {
        "kind": "regent",
        "body": (116, 92, 58, 255),
        "light": (224, 185, 106, 255),
        "cloth": (70, 54, 34, 255),
        "accent": (255, 196, 96, 255),
        "eye": (255, 246, 200, 255),
        "scale": 1.3,
    },
    "mireSovereign": {
        "kind": "sovereign",
        "body": (56, 82, 60, 255),
        "light": (132, 170, 104, 255),
        "cloth": (36, 54, 42, 255),
        "accent": (200, 232, 120, 255),
        "eye": (255, 250, 190, 255),
        "scale": 1.32,
        "eyes": "many",
    },
    "bombardier": {
        "kind": "hunched",
        "body": (96, 62, 40, 255),
        "light": (186, 132, 82, 255),
        "cloth": (58, 38, 26, 255),
        "accent": (255, 170, 80, 255),
        "eye": (255, 240, 190, 255),
        "scale": 1.0,
    },
    "hiveDrone": {
        "kind": "wisp",
        "body": (176, 128, 40, 255),
        "light": (245, 196, 96, 255),
        "cloth": (104, 72, 22, 255),
        "accent": (255, 220, 120, 255),
        "eye": (255, 255, 220, 255),
        "scale": 0.96,
        "eyes": "many",
    },
    "hiveGuard": {
        "kind": "hunched",
        "body": (96, 70, 36, 255),
        "light": (190, 150, 76, 255),
        "cloth": (56, 40, 20, 255),
        "accent": (255, 196, 96, 255),
        "eye": (255, 240, 200, 255),
        "scale": 1.16,
        "ears": True,
        "eyes": "many",
    },
    "catacombArcher": {
        "kind": "hunched",
        "body": (78, 82, 78, 255),
        "light": (164, 160, 140, 255),
        "cloth": (44, 50, 50, 255),
        "accent": (143, 216, 200, 255),
        "eye": (220, 255, 245, 255),
        "scale": 1.0,
        "eyes": "slits",
    },
    "boneKnight": {
        "kind": "duelist",
        "body": (96, 94, 82, 255),
        "light": (206, 198, 170, 255),
        "cloth": (48, 54, 52, 255),
        "accent": (143, 216, 200, 255),
        "eye": (220, 255, 245, 255),
        "scale": 1.08,
    },
    "hiveQueen": {
        "kind": "queen",
        "body": (92, 62, 24, 255),
        "light": (214, 164, 84, 255),
        "cloth": (52, 34, 12, 255),
        "accent": (255, 208, 110, 255),
        "eye": (255, 250, 220, 255),
        "scale": 1.34,
    },
    "boneTyrant": {
        "kind": "tyrant",
        "body": (84, 82, 72, 255),
        "light": (206, 198, 168, 255),
        "cloth": (38, 44, 43, 255),
        "accent": (143, 216, 200, 255),
        "eye": (220, 255, 245, 255),
        "scale": 1.36,
    },
    "graveHound": {
        "kind": "hound",
        "body": (104, 100, 88, 255),
        "light": (206, 198, 170, 255),
        "cloth": (54, 56, 52, 255),
        "accent": (143, 216, 200, 255),
        "eye": (220, 255, 245, 255),
        "scale": 1.08,
        "eyes": "glare",
    },
    "voidCantor": {
        "kind": "cantor",
        "body": (58, 50, 84, 255),
        "light": (142, 126, 194, 255),
        "cloth": (34, 28, 52, 255),
        "accent": (170, 150, 255, 255),
        "eye": (220, 230, 255, 255),
        "scale": 1.30,
        "eyes": "many",
    },
    "choirHierophant": {
        "kind": "hierophant",
        "body": (78, 104, 128, 255),
        "light": (196, 230, 248, 255),
        "cloth": (42, 60, 80, 255),
        "accent": (150, 230, 255, 255),
        "eye": (255, 255, 250, 255),
        "scale": 1.34,
    },
    "hollowBehemoth": {
        "kind": "behemoth",
        "body": (54, 48, 70, 255),
        "light": (140, 126, 172, 255),
        "cloth": (30, 26, 42, 255),
        "accent": (190, 160, 255, 255),
        "eye": (230, 220, 255, 255),
        "scale": 1.38,
    },
}

BIOME_ART = {
    "ruins": {
        "dark": (58, 48, 42, 255),
        "base": (116, 94, 78, 255),
        "light": (188, 158, 126, 255),
        "accent": (242, 208, 150, 255),
        "hazard": (198, 72, 58, 255),
        "water": (64, 102, 116, 255),
        "foliage": (112, 138, 84, 255),
    },
    "forest": {
        "dark": (20, 46, 28, 255),
        "base": (52, 94, 54, 255),
        "light": (122, 174, 92, 255),
        "accent": (196, 255, 154, 255),
        "hazard": (214, 92, 62, 255),
        "water": (44, 110, 112, 255),
        "foliage": (80, 150, 78, 255),
    },
    "caves": {
        "dark": (32, 32, 46, 255),
        "base": (72, 72, 92, 255),
        "light": (146, 146, 174, 255),
        "accent": (124, 216, 255, 255),
        "hazard": (255, 122, 62, 255),
        "water": (52, 78, 110, 255),
        "foliage": (104, 138, 122, 255),
    },
    "crystal": {
        "dark": (60, 38, 102, 255),
        "base": (126, 78, 186, 255),
        "light": (224, 172, 255, 255),
        "accent": (255, 148, 232, 255),
        "hazard": (255, 104, 176, 255),
        "water": (94, 98, 188, 255),
        "foliage": (128, 214, 216, 255),
    },
    "void": {
        "dark": (8, 8, 16, 255),
        "base": (34, 32, 56, 255),
        "light": (98, 94, 136, 255),
        "accent": (96, 236, 255, 255),
        "hazard": (255, 58, 92, 255),
        "water": (38, 42, 78, 255),
        "foliage": (62, 56, 96, 255),
    },
    "sanctuary": {
        "dark": (112, 86, 36, 255),
        "base": (196, 160, 94, 255),
        "light": (255, 244, 208, 255),
        "accent": (255, 224, 124, 255),
        "hazard": (255, 168, 94, 255),
        "water": (178, 214, 230, 255),
        "foliage": (224, 214, 144, 255),
    },
    "foundry": {
        "dark": (36, 28, 22, 255),
        "base": (92, 76, 58, 255),
        "light": (196, 150, 88, 255),
        "accent": (255, 179, 71, 255),
        "hazard": (255, 120, 60, 255),
        "water": (110, 90, 70, 255),
        "foliage": (140, 120, 80, 255),
    },
    "mire": {
        "dark": (18, 28, 22, 255),
        "base": (54, 78, 58, 255),
        "light": (122, 154, 96, 255),
        "accent": (184, 224, 106, 255),
        "hazard": (140, 210, 110, 255),
        "water": (44, 88, 74, 255),
        "foliage": (86, 128, 74, 255),
    },
    "hive": {
        "dark": (30, 20, 10, 255),
        "base": (88, 62, 32, 255),
        "light": (200, 150, 76, 255),
        "accent": (255, 196, 96, 255),
        "hazard": (255, 140, 60, 255),
        "water": (120, 90, 40, 255),
        "foliage": (180, 130, 60, 255),
    },
    "catacomb": {
        "dark": (16, 22, 22, 255),
        "base": (64, 72, 72, 255),
        "light": (176, 172, 148, 255),
        "accent": (143, 216, 200, 255),
        "hazard": (120, 200, 180, 255),
        "water": (60, 84, 82, 255),
        "foliage": (140, 136, 116, 255),
    },
}

BACKGROUND_ART = {
    "ruins": dict(top=(16, 18, 34), bottom=(74, 62, 52), silhouette=(42, 38, 40), accent=(242, 196, 128)),
    "forest": dict(top=(9, 24, 28), bottom=(38, 74, 52), silhouette=(18, 42, 34), accent=(168, 255, 156)),
    "caves": dict(top=(10, 12, 24), bottom=(50, 50, 66), silhouette=(24, 24, 36), accent=(118, 220, 255)),
    "crystal": dict(top=(22, 12, 42), bottom=(104, 56, 152), silhouette=(48, 28, 76), accent=(255, 148, 232)),
    "void": dict(top=(3, 3, 9), bottom=(24, 22, 40), silhouette=(8, 8, 16), accent=(92, 232, 255)),
    "sanctuary": dict(top=(32, 28, 48), bottom=(180, 144, 84), silhouette=(104, 82, 42), accent=(255, 236, 166)),
    "ash": dict(top=(14, 6, 4), bottom=(96, 48, 26), silhouette=(40, 22, 14), accent=(255, 138, 76)),
    "abyss": dict(top=(3, 10, 14), bottom=(24, 62, 78), silhouette=(10, 28, 36), accent=(111, 231, 255)),
    "frost": dict(top=(18, 26, 34), bottom=(150, 186, 206), silhouette=(70, 92, 108), accent=(191, 233, 255)),
    "bloom": dict(top=(18, 8, 22), bottom=(92, 56, 92), silhouette=(40, 24, 44), accent=(255, 154, 216)),
    "foundry": dict(top=(10, 8, 6), bottom=(92, 66, 36), silhouette=(38, 28, 18), accent=(255, 190, 90)),
    "mire": dict(top=(6, 12, 10), bottom=(42, 68, 48), silhouette=(18, 32, 24), accent=(180, 230, 110)),
    "hive": dict(top=(10, 6, 3), bottom=(92, 64, 28), silhouette=(40, 26, 10), accent=(255, 196, 96)),
    "catacomb": dict(top=(4, 6, 6), bottom=(54, 62, 62), silhouette=(20, 26, 26), accent=(143, 216, 200)),
}


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------


def rgba(color: tuple[int, int, int], alpha: int = 255) -> tuple[int, int, int, int]:
    return (color[0], color[1], color[2], alpha)


def blank(cell: int) -> Image.Image:
    return Image.new("RGBA", (cell * SS, cell * SS), (0, 0, 0, 0))


def ellipse(draw: ImageDraw.ImageDraw, cell: int, x0: float, y0: float, x1: float, y1: float,
            fill=None, outline=None, width: int = 2) -> None:
    size = cell * SS
    scale = max(1.0, cell / 64)
    draw.ellipse(
        [int(x0 * size), int(y0 * size), int(x1 * size), int(y1 * size)],
        fill=fill,
        outline=outline,
        width=max(1, int(width * SS * scale)),
    )


def rect(draw: ImageDraw.ImageDraw, cell: int, x0: float, y0: float, x1: float, y1: float,
         fill=None, outline=None, width: int = 2, radius: float = 0.0) -> None:
    size = cell * SS
    coords = [int(x0 * size), int(y0 * size), int(x1 * size), int(y1 * size)]
    if radius > 0:
        draw.rounded_rectangle(
            coords,
            radius=int(radius * size),
            fill=fill,
            outline=outline,
            width=max(1, int(width * SS * max(1.0, cell / 64))),
        )
    else:
        draw.rectangle(
            coords,
            fill=fill,
            outline=outline,
            width=max(1, int(width * SS * max(1.0, cell / 64))),
        )


def poly(draw: ImageDraw.ImageDraw, cell: int, points: list[tuple[float, float]],
         fill=None, outline=None, width: int = 2) -> None:
    size = cell * SS
    coords = [(int(x * size), int(y * size)) for x, y in points]
    draw.polygon(coords, fill=fill, outline=outline, width=max(1, int(width * SS * max(1.0, cell / 64))))


def line(draw: ImageDraw.ImageDraw, cell: int, points: list[tuple[float, float]],
         fill, width: int = 2) -> None:
    size = cell * SS
    coords = [(int(x * size), int(y * size)) for x, y in points]
    draw.line(coords, fill=fill, width=max(1, int(width * SS * max(1.0, cell / 64))), joint="curve")


def glow(img: Image.Image, paint, blur: float = 3.0) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    paint(ImageDraw.Draw(layer))
    layer = layer.filter(ImageFilter.GaussianBlur(blur * SS))
    img.alpha_composite(layer)


def downsample(img: Image.Image, cell: int) -> Image.Image:
    # Area-average keeps pixel art crisp; LANCZOS softened every edge.
    return img.resize((cell, cell), Image.BOX)


def save_cell(img: Image.Image, cell: int, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    downsample(img, cell).save(path)


def mix(a: tuple[int, ...], b: tuple[int, ...], t: float) -> tuple[int, ...]:
    length = min(len(a), len(b))
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(length))


# ---------------------------------------------------------------------------
# Player
# ---------------------------------------------------------------------------


def player_scarf(state: str, t: float, bob: float) -> list[tuple[float, float]]:
    sway = math.sin(t * math.tau) * 0.025
    if state == "dash":
        return [(0.42, 0.41), (0.24, 0.44), (0.09, 0.49), (0.0, 0.45)]
    if state == "attack":
        return [(0.43, 0.41), (0.31, 0.48 + sway), (0.20, 0.55), (0.12, 0.52 + sway)]
    return [(0.43, 0.41 + bob), (0.31, 0.47 + sway), (0.21, 0.53 - sway), (0.13, 0.49)]


def player_frame(state: str, frame: int, frames: int, weapon: str = "sword") -> Image.Image:
    cell = PLAYER_CELL
    img = blank(cell)
    draw = ImageDraw.Draw(img)
    pal = PLAYER
    t = frame / frames
    cycle = math.sin(t * math.tau)
    bob = cycle * 0.008 if state in ("idle", "attack") else abs(cycle) * 0.012
    lean = 0.035 if state == "dash" else 0.0
    step = math.sin(t * math.tau) if state == "walk" else 0.0

    def paint_glow(g: ImageDraw.ImageDraw) -> None:
        line(g, cell, player_scarf(state, t, bob), pal["scarf"], 5)
        ellipse(g, cell, 0.465, 0.39 + bob, 0.535, 0.46 + bob, fill=pal["eye"])
        ellipse(g, cell, 0.50, 0.28 + bob, 0.55, 0.33 + bob, fill=pal["eye"])

    ellipse(draw, cell, 0.25, 0.84, 0.74, 0.93, fill=Shadow)
    glow(img, paint_glow, 3.0)

    # Scarf tail behind the body.
    line(draw, cell, player_scarf(state, t, bob), pal["scarf_dark"], 4)
    line(draw, cell, player_scarf(state, t, bob), pal["scarf"], 2)

    # Legs and boots.
    left_x = 0.43 + step * 0.025
    right_x = 0.55 - step * 0.025
    if state == "dash":
        left_x, right_x = 0.39, 0.49
    rect(draw, cell, left_x - 0.045, 0.66 + bob, left_x + 0.035, 0.85, fill=pal["cloak_dark"], outline=pal["outline"], width=2, radius=0.02)
    rect(draw, cell, right_x - 0.035, 0.66 + bob, right_x + 0.045, 0.85, fill=pal["cloak_dark"], outline=pal["outline"], width=2, radius=0.02)
    rect(draw, cell, left_x - 0.055, 0.81, left_x + 0.045, 0.88, fill=pal["boot"], outline=pal["outline"], width=2, radius=0.018)
    rect(draw, cell, right_x - 0.045, 0.81, right_x + 0.055, 0.88, fill=pal["boot"], outline=pal["outline"], width=2, radius=0.018)

    # Cloak and torso.
    cloak = [
        (0.37 + lean, 0.35 + bob),
        (0.63 + lean, 0.35 + bob),
        (0.72, 0.78),
        (0.63, 0.86),
        (0.55, 0.79),
        (0.49, 0.87),
        (0.42, 0.80),
        (0.29, 0.78),
    ]
    poly(draw, cell, cloak, fill=pal["cloak"], outline=pal["outline"], width=3)
    poly(draw, cell, [(0.40 + lean, 0.37 + bob), (0.55 + lean, 0.36 + bob), (0.51, 0.72), (0.43, 0.76)],
         fill=pal["cloak_light"])
    rect(draw, cell, 0.37, 0.62, 0.63, 0.66, fill=pal["gold"], outline=pal["outline"], width=1, radius=0.01)
    # Memory core.
    poly(draw, cell, [(0.51, 0.46), (0.55, 0.50), (0.51, 0.55), (0.47, 0.50)], fill=pal["scarf_light"], outline=pal["outline"], width=1)

    # Arms.
    if state == "attack":
        line(draw, cell, [(0.42, 0.42), (0.55, 0.47), (0.67, 0.48)], pal["cloak_dark"], 6)
        line(draw, cell, [(0.42, 0.42), (0.55, 0.47), (0.67, 0.48)], pal["cloak_light"], 3)
    else:
        line(draw, cell, [(0.40, 0.43), (0.34, 0.56), (0.36 + step * 0.01, 0.66)], pal["cloak_dark"], 5)
        line(draw, cell, [(0.61, 0.43), (0.68, 0.55), (0.66 - step * 0.01, 0.65)], pal["cloak_dark"], 5)

    # Hood and face. The face sits deep in shade with only the eyes catching
    # light, so the walker reads at gameplay size instead of as a blank oval.
    ellipse(draw, cell, 0.38, 0.20 + bob, 0.62, 0.45 + bob, fill=pal["cloak_dark"], outline=pal["outline"], width=3)
    poly(draw, cell, [(0.39, 0.29 + bob), (0.36, 0.18 + bob), (0.50, 0.13 + bob), (0.64, 0.20 + bob), (0.61, 0.30 + bob)],
         fill=pal["cloak"], outline=pal["outline"], width=2)
    # Hood rim catches the light along its leading edge.
    line(draw, cell, [(0.37, 0.19 + bob), (0.50, 0.135 + bob), (0.63, 0.20 + bob)], pal["cloak_light"], 1)
    # Face cavity in shadow.
    ellipse(draw, cell, 0.435, 0.255 + bob, 0.585, 0.405 + bob, fill=(16, 15, 26))
    ell = pal["eye"]
    rect(draw, cell, 0.478, 0.305 + bob, 0.505, 0.335 + bob, fill=ell, radius=0.008)
    rect(draw, cell, 0.515, 0.305 + bob, 0.542, 0.335 + bob, fill=ell, radius=0.008)
    # Jaw and mouth-shadow keep a hint of a face under the hood.
    ellipse(draw, cell, 0.472, 0.352 + bob, 0.548, 0.398 + bob, fill=pal["skin_shadow"])

    # Blade and slash arc. Each stance has a distinct held silhouette so the
    # weapon reads in idle, walk and attack, not only in the hit effect.
    if state in ("idle", "walk", "attack"):
        attacking = state == "attack"
        resting = {"sword": -0.85, "spear": -1.05, "greatsword": -0.78}[weapon]
        angle = (-1.3 + 2.3 * t) if attacking else resting
        hand = (0.65, 0.54)
        dx, dy = math.cos(angle), math.sin(angle)
        if weapon == "spear":
            length = 0.52 if attacking else 0.48
            butt = (hand[0] - dx * 0.16, hand[1] - dy * 0.16)
            base = (hand[0] + dx * (length - 0.10), hand[1] + dy * (length - 0.10))
            tip = (hand[0] + dx * length, hand[1] + dy * length)
            line(draw, cell, [butt, base], pal["outline"], 4)
            line(draw, cell, [butt, base], pal["gold"], 2)
            nx, ny = -dy * 0.045, dx * 0.045
            poly(draw, cell, [(base[0] + nx, base[1] + ny), tip, (base[0] - nx, base[1] - ny)],
                 fill=pal["blade"], outline=pal["outline"], width=2)
            line(draw, cell, [base, tip], pal["blade_core"], 1)
            line(draw, cell, [(hand[0] - dy * 0.055, hand[1] + dx * 0.055),
                              (hand[0] + dy * 0.055, hand[1] - dx * 0.055)], pal["gold"], 2)
            if attacking and t > 0.1:
                alpha = int(230 * max(0.0, 1.0 - abs(t - 0.42) * 1.5))
                streak = (tip[0] + dx * 0.14, tip[1] + dy * 0.14)
                line(draw, cell, [hand, streak], rgba(pal["scarf"][:3], max(40, alpha)), 3)
        else:
            heavy = weapon == "greatsword"
            length = (0.46 if heavy else 0.34) if attacking else (0.40 if heavy else 0.32)
            half_width = 0.16 if heavy else 0.085
            tip = (hand[0] + dx * length, hand[1] + dy * length)
            px, py = -dy * length * half_width, dx * length * half_width
            # Tapered blade: broad at the guard, pointed at the tip.
            poly(draw, cell, [
                (hand[0] + px, hand[1] + py),
                (tip[0] + px * 0.45, tip[1] + py * 0.45),
                tip,
                (tip[0] - px * 0.45, tip[1] - py * 0.45),
                (hand[0] - px, hand[1] - py),
            ], fill=pal["blade"], outline=pal["outline"], width=2)
            line(draw, cell, [hand, tip], pal["blade_core"], 2)
            if heavy:
                line(draw, cell, [(hand[0] + px * 0.35, hand[1] + py * 0.35),
                                  (tip[0] + px * 0.15, tip[1] + py * 0.15)], pal["outline"], 1)
            guard = 0.15 if heavy else 0.10
            line(draw, cell, [(hand[0] - dy * guard, hand[1] + dx * guard),
                              (hand[0] + dy * guard, hand[1] - dx * guard)],
                 pal["gold"], 3 if heavy else 2)
            ellipse(draw, cell, hand[0] - dx * 0.035 - 0.022, hand[1] - dy * 0.035 - 0.022,
                    hand[0] - dx * 0.035 + 0.022, hand[1] - dy * 0.035 + 0.022,
                    fill=pal["gold"], outline=pal["outline"], width=1)
            if attacking and t > 0.18:
                size = cell * SS
                if heavy:
                    box = [int(0.24 * size), int(0.08 * size), int(1.02 * size), int(0.90 * size)]
                    draw.arc(box, start=-122 + t * 86, end=22 + t * 60, fill=pal["gold"],
                             width=max(2, 4 * SS))
                    draw.arc(box, start=-118 + t * 86, end=18 + t * 60, fill=pal["blade_core"],
                             width=max(1, 2 * SS))
                else:
                    box = [int(0.34 * size), int(0.16 * size), int(0.98 * size), int(0.84 * size)]
                    draw.arc(box, start=-104 + t * 80, end=8 + t * 60, fill=pal["scarf"],
                             width=max(1, 2 * SS))

    # Dash afterimages.
    if state == "dash":
        for i, alpha in enumerate((120, 80, 45)):
            line(draw, cell, [(0.36 - i * 0.07, 0.42 + i * 0.04), (0.08 - i * 0.04, 0.45 + i * 0.05)],
                 rgba(pal["scarf"][:3], alpha), 2)

    return img


# ---------------------------------------------------------------------------
# Enemies
# ---------------------------------------------------------------------------


def _enemy_common(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> tuple[float, float]:
    cycle = math.sin(t * math.tau)
    bob = cycle * 0.008
    if row == 3:
        bob += (frame + 1) / 4 * 0.16
    lunge = 0.05 if row == 2 and t > 0.35 else 0.0
    step = math.sin(t * math.tau) if row == 1 else 0.0
    ellipse(draw, cell, 0.24, 0.86, 0.76, 0.95, fill=Shadow)
    return bob, step + lunge


def _enemy_eyes(draw: ImageDraw.ImageDraw, cell: int, cx: float, cy: float,
                style: dict, spread: float = 0.042, r: float = 0.021) -> None:
    """Draws an archetype's eye motif.

    Several enemies share a body kind (wisp, hunched, construct), so without a
    per-enemy motif they all read as the same two-dot blob. `style["eyes"]`
    picks the motif; the default is the paired eyes the older art used.
    """
    eye = style["eye"]
    mode = style.get("eyes", "pair")
    if mode == "slits":
        for dx in (-spread, spread):
            rect(draw, cell, cx + dx - r, cy - r * 0.42, cx + dx + r, cy + r * 0.42, fill=eye, radius=0.004)
    elif mode == "single":
        ellipse(draw, cell, cx - r * 1.6, cy - r * 1.6, cx + r * 1.6, cy + r * 1.6, fill=eye, outline=Outline, width=1)
        ellipse(draw, cell, cx - r * 0.45, cy - r * 0.45, cx + r * 0.45, cy + r * 0.45, fill=(12, 12, 20))
    elif mode == "many":
        for dx, dy, s in ((-spread, 0.0, 1.0), (spread, 0.0, 1.0), (0.0, -r * 1.7, 0.72)):
            ellipse(draw, cell, cx + dx - r * s, cy + dy - r * s, cx + dx + r * s, cy + dy + r * s, fill=eye)
    elif mode == "hollow":
        for dx in (-spread, spread):
            ellipse(draw, cell, cx + dx - r, cy - r, cx + dx + r, cy + r, fill=(10, 9, 16))
            ellipse(draw, cell, cx + dx - r, cy - r, cx + dx + r, cy + r, outline=eye, width=1)
    elif mode == "glare":
        for dx in (-spread, spread):
            poly(draw, cell, [(cx + dx - r, cy + r * 0.55), (cx + dx + r * 1.05, cy - r * 0.45),
                              (cx + dx + r, cy + r * 0.75)], fill=eye)
    else:
        ellipse(draw, cell, cx - spread - r, cy - r, cx - spread + r, cy + r, fill=eye)
        ellipse(draw, cell, cx + spread - r, cy - r, cx + spread + r, cy + r, fill=eye)


def _construct(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, march = _enemy_common(draw, cell, style, row, frame, t)
    dark = mix(style["body"], style["cloth"], 0.45)
    body = style["body"]
    light = style["light"]
    accent = style["accent"]
    lean = march * 0.015
    scale = style.get("scale", 1.0)
    top = 0.18 + (1 - scale) * 0.15 + bob
    left = 0.5 - 0.24 * scale + lean
    right = 0.5 + 0.24 * scale + lean
    bottom = 0.88
    rect(draw, cell, left, top + 0.16, right, bottom, fill=body, outline=Outline, width=3, radius=0.04)
    rect(draw, cell, left + 0.03, top + 0.19, right - 0.03, bottom - 0.08, fill=mix(body, light, 0.25))
    # Shoulders / head.
    poly(draw, cell, [(left - 0.04, top + 0.23), (left + 0.05, top + 0.08), (right - 0.05, top + 0.08), (right + 0.04, top + 0.23)],
         fill=dark, outline=Outline, width=3)
    rect(draw, cell, 0.42 + lean, top - 0.01, 0.58 + lean, top + 0.15, fill=body, outline=Outline, width=3, radius=0.03)
    _enemy_eyes(draw, cell, 0.50 + lean, top + 0.065, dict(style, eye=accent, eyes=style.get("eyes", "slits")),
                spread=0.040, r=0.016)
    # Core.
    ellipse(draw, cell, 0.44 + lean, top + 0.30, 0.56 + lean, top + 0.42, fill=accent, outline=Outline, width=2)
    # Arms.
    swing = march * 0.04
    rect(draw, cell, left - 0.075, top + 0.23 - swing, left + 0.015, top + 0.60, fill=dark, outline=Outline, width=2, radius=0.025)
    rect(draw, cell, right - 0.015, top + 0.23 + swing, right + 0.075, top + 0.60, fill=dark, outline=Outline, width=2, radius=0.025)
    # Legs.
    rect(draw, cell, 0.39, bottom - 0.12, 0.48, bottom + 0.05 + abs(march) * 0.02, fill=dark, outline=Outline, width=2, radius=0.02)
    rect(draw, cell, 0.52, bottom - 0.12, 0.61, bottom + 0.05, fill=dark, outline=Outline, width=2, radius=0.02)
    # Cracks.
    line(draw, cell, [(0.48 + lean, top + 0.20), (0.54 + lean, top + 0.28), (0.50 + lean, top + 0.38)], style["accent"], 1)
    if style.get("crystals"):
        for x, y, s in ((0.28, 0.35, 0.06), (0.69, 0.50, 0.05), (0.36, 0.20, 0.04)):
            poly(draw, cell, [(x, y - s), (x + s, y), (x, y + s * 1.4), (x - s, y)], fill=accent, outline=Outline, width=1)
    if style.get("broken"):
        line(draw, cell, [(0.38, 0.43), (0.30, 0.51)], dark, 3)
        line(draw, cell, [(0.62, 0.49), (0.70, 0.57)], dark, 3)


def _hunched(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body = style["body"]
    light = style["light"]
    cloth = style["cloth"]
    accent = style["accent"]
    sway = math.sin(t * math.tau) * 0.015
    cx = 0.50 + lunge
    # Ragged cloak.
    poly(draw, cell, [(cx - 0.20, 0.40 + bob), (cx - 0.08, 0.28 + bob), (cx + 0.17, 0.33 + bob),
                      (cx + 0.24, 0.72), (cx + 0.13, 0.82), (cx + 0.06, 0.74), (cx - 0.03, 0.85),
                      (cx - 0.12, 0.75), (cx - 0.24, 0.80)], fill=cloth, outline=Outline, width=3)
    ellipse(draw, cell, cx - 0.17, 0.36 + bob, cx + 0.18, 0.70, fill=body, outline=Outline, width=2)
    # Head and bone mask.
    ellipse(draw, cell, cx - 0.12, 0.22 + bob, cx + 0.13, 0.42 + bob, fill=light, outline=Outline, width=3)
    poly(draw, cell, [(cx - 0.10, 0.29 + bob), (cx, 0.25 + bob), (cx + 0.10, 0.29 + bob), (cx + 0.03, 0.37 + bob), (cx - 0.03, 0.37 + bob)],
         fill=(222, 214, 190, 255), outline=Outline, width=2)
    _enemy_eyes(draw, cell, cx, 0.310 + bob, style, spread=0.036, r=0.019)
    # Claws and legs.
    line(draw, cell, [(cx - 0.16, 0.48), (cx - 0.28, 0.61), (cx - 0.31 + sway, 0.68)], body, 4)
    line(draw, cell, [(cx + 0.17, 0.48), (cx + 0.29, 0.58), (cx + 0.32 - sway, 0.67)], body, 4)
    for sign in (-1, 1):
        line(draw, cell, [(cx + sign * 0.28, 0.66), (cx + sign * 0.34, 0.73)], accent, 2)
    rect(draw, cell, cx - 0.12, 0.72, cx - 0.03, 0.91, fill=body, outline=Outline, width=2, radius=0.02)
    rect(draw, cell, cx + 0.04, 0.72, cx + 0.13, 0.91, fill=body, outline=Outline, width=2, radius=0.02)
    if style.get("ears"):
        poly(draw, cell, [(cx - 0.12, 0.28 + bob), (cx - 0.24, 0.18 + bob), (cx - 0.15, 0.36 + bob)], fill=light, outline=Outline, width=2)
        poly(draw, cell, [(cx + 0.12, 0.28 + bob), (cx + 0.24, 0.18 + bob), (cx + 0.15, 0.36 + bob)], fill=light, outline=Outline, width=2)
    if row == 2:
        line(draw, cell, [(cx + 0.22, 0.40), (cx + 0.38, 0.36)], accent, 3)


def _wisp(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body = style["body"]
    light = style["light"]
    cloth = style["cloth"]
    accent = style["accent"]
    cx = 0.50 + lunge
    sway = math.sin(t * math.tau) * 0.025
    # Trailing tatters.
    poly(draw, cell, [(cx - 0.17, 0.38 + bob), (cx + 0.15, 0.36 + bob), (cx + 0.20, 0.72),
                      (cx + 0.09, 0.82 + sway), (cx + 0.02, 0.73), (cx - 0.07, 0.88 - sway),
                      (cx - 0.15, 0.74), (cx - 0.23, 0.79)], fill=cloth, outline=Outline, width=3)
    ellipse(draw, cell, cx - 0.15, 0.24 + bob, cx + 0.16, 0.52 + bob, fill=body, outline=Outline, width=2)
    ellipse(draw, cell, cx - 0.10, 0.25 + bob, cx + 0.11, 0.44 + bob, fill=cloth)
    _enemy_eyes(draw, cell, cx - 0.004, 0.3225 + bob, style, spread=0.038, r=0.022)
    # Ribbon arms.
    line(draw, cell, [(cx - 0.12, 0.47), (cx - 0.27, 0.55 + sway), (cx - 0.32, 0.48)], body, 3)
    line(draw, cell, [(cx + 0.12, 0.47), (cx + 0.27, 0.55 - sway), (cx + 0.32, 0.48)], body, 3)
    for i in range(3):
        ellipse(draw, cell, cx - 0.05 + i * 0.06, 0.63 + i * 0.05 + sway, cx - 0.015 + i * 0.06, 0.66 + i * 0.05 + sway,
                fill=accent)
    if style.get("antlers"):
        for sign in (-1, 1):
            line(draw, cell, [(cx + sign * 0.08, 0.25 + bob), (cx + sign * 0.16, 0.14 + bob), (cx + sign * 0.24, 0.12 + bob)], accent, 2)
            line(draw, cell, [(cx + sign * 0.16, 0.14 + bob), (cx + sign * 0.21, 0.20 + bob)], accent, 1)
    if style.get("shards"):
        for x, y in ((0.24, 0.35), (0.76, 0.44), (0.31, 0.22)):
            poly(draw, cell, [(x, y - 0.05), (x + 0.04, y), (x, y + 0.07), (x - 0.04, y)], fill=accent, outline=Outline, width=1)
    if style.get("rift"):
        poly(draw, cell, [(cx - 0.025, 0.46), (cx + 0.03, 0.52), (cx - 0.01, 0.63), (cx - 0.045, 0.57)], fill=accent, outline=Outline, width=1)


def _beast(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body = style["body"]
    light = style["light"]
    cloth = style["cloth"]
    accent = style["accent"]
    cx = 0.50 + lunge
    step = math.sin(t * math.tau) * 0.03 if row == 1 else 0.0
    ellipse(draw, cell, cx - 0.26, 0.45 + bob, cx + 0.23, 0.76 + bob, fill=body, outline=Outline, width=3)
    ellipse(draw, cell, cx - 0.20, 0.49 + bob, cx + 0.15, 0.70 + bob, fill=mix(body, light, 0.28))
    ellipse(draw, cell, cx + 0.13, 0.30 + bob, cx + 0.38, 0.55 + bob, fill=light, outline=Outline, width=3)
    ellipse(draw, cell, cx + 0.18, 0.34 + bob, cx + 0.34, 0.48 + bob, fill=cloth)
    _enemy_eyes(draw, cell, cx + 0.29, 0.378 + bob, dict(style, eyes=style.get("eyes", "single")),
                spread=0.0, r=0.023)
    # Antlers.
    for sign in (-1, 1):
        line(draw, cell, [(cx + 0.23, 0.32 + bob), (cx + 0.20 + sign * 0.03, 0.19 + bob), (cx + 0.15 + sign * 0.10, 0.13 + bob)], accent, 2)
    # Legs.
    for i, x in enumerate((-0.17, -0.02, 0.12)):
        rect(draw, cell, cx + x - 0.035, 0.69, cx + x + 0.035, 0.91 + (step if i % 2 else -step), fill=cloth, outline=Outline, width=2, radius=0.02)
    line(draw, cell, [(cx - 0.24, 0.52), (cx - 0.34, 0.46 + math.sin(t * math.tau) * 0.03)], cloth, 3)


def _duelist(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body = style["body"]
    light = style["light"]
    cloth = style["cloth"]
    accent = style["accent"]
    cx = 0.50 + lunge
    rect(draw, cell, cx - 0.12, 0.34 + bob, cx + 0.12, 0.74, fill=body, outline=Outline, width=3, radius=0.03)
    poly(draw, cell, [(cx - 0.16, 0.38 + bob), (cx - 0.24, 0.31 + bob), (cx - 0.13, 0.27 + bob), (cx + 0.13, 0.27 + bob), (cx + 0.24, 0.31 + bob), (cx + 0.16, 0.38 + bob)],
         fill=cloth, outline=Outline, width=2)
    ellipse(draw, cell, cx - 0.09, 0.18 + bob, cx + 0.09, 0.34 + bob, fill=light, outline=Outline, width=3)
    rect(draw, cell, cx - 0.07, 0.235 + bob, cx + 0.07, 0.27 + bob, fill=accent)
    _enemy_eyes(draw, cell, cx, 0.2525 + bob, dict(style, eye=Outline, eyes=style.get("eyes", "slits")),
                spread=0.034, r=0.018)
    rect(draw, cell, cx - 0.08, 0.70, cx - 0.01, 0.91, fill=cloth, outline=Outline, width=2, radius=0.02)
    rect(draw, cell, cx + 0.01, 0.70, cx + 0.08, 0.91, fill=cloth, outline=Outline, width=2, radius=0.02)
    angle = -0.9 + (1.8 * t if row == 2 else 0.0)
    tip = (cx + math.cos(angle) * 0.36, 0.48 + math.sin(angle) * 0.30)
    line(draw, cell, [(cx + 0.10, 0.49), tip], (232, 238, 255, 255), 2)
    line(draw, cell, [(cx + 0.10, 0.49), tip], accent, 1)
    # Cape.
    poly(draw, cell, [(cx - 0.13, 0.38), (cx - 0.28, 0.48), (cx - 0.19, 0.80), (cx - 0.06, 0.70)],
         fill=cloth, outline=Outline, width=2)


def _keeper(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body = style["body"]
    light = style["light"]
    cloth = style["cloth"]
    accent = style["accent"]
    cx = 0.50 + lunge
    sway = math.sin(t * math.tau) * 0.006
    # Radiant halo: ring, inner ring and a crown of short rays.
    ellipse(draw, cell, cx - 0.23, 0.06 + bob, cx + 0.23, 0.20 + bob, outline=accent, width=3)
    ellipse(draw, cell, cx - 0.17, 0.09 + bob, cx + 0.17, 0.17 + bob, outline=accent, width=1)
    for i in range(9):
        a = math.pi + i * math.pi / 8
        rx, ry = cx + math.cos(a) * 0.25, 0.13 + bob + math.sin(a) * 0.085
        line(draw, cell, [(cx + math.cos(a) * 0.205, 0.13 + bob + math.sin(a) * 0.068), (rx, ry)], accent, 1)
    # Layered robe: dark outer mantle over a lit inner stole, wide hem.
    poly(draw, cell, [(cx - 0.27, 0.86), (cx - 0.20, 0.42 + bob), (cx - 0.09, 0.30 + bob),
                      (cx + 0.09, 0.30 + bob), (cx + 0.20, 0.42 + bob), (cx + 0.27, 0.86)],
         fill=cloth, outline=Outline, width=3)
    poly(draw, cell, [(cx - 0.14, 0.86), (cx - 0.11, 0.40 + bob), (cx + 0.11, 0.40 + bob), (cx + 0.14, 0.86)],
         fill=body)
    poly(draw, cell, [(cx - 0.055, 0.40 + bob), (cx + 0.055, 0.40 + bob), (cx + 0.065, 0.86), (cx - 0.065, 0.86)],
         fill=mix(body, (255, 255, 255), 0.22))
    # Hem band and two gold sashes.
    rect(draw, cell, cx - 0.28, 0.81, cx + 0.28, 0.86, fill=mix(cloth, Outline, 0.35), outline=Outline, width=2)
    rect(draw, cell, cx - 0.28, 0.815, cx + 0.28, 0.832, fill=accent)
    for y in (0.55, 0.68):
        rect(draw, cell, cx - 0.16, y, cx + 0.16, y + 0.028, fill=accent)
    # Shoulder mantle with a lit leading edge.
    poly(draw, cell, [(cx - 0.24, 0.40 + bob), (cx - 0.12, 0.30 + bob), (cx + 0.12, 0.30 + bob), (cx + 0.24, 0.40 + bob),
                      (cx + 0.16, 0.50 + bob), (cx - 0.16, 0.50 + bob)],
         fill=mix(cloth, light, 0.30), outline=Outline, width=2)
    line(draw, cell, [(cx - 0.22, 0.405 + bob), (cx - 0.10, 0.315 + bob), (cx + 0.10, 0.315 + bob), (cx + 0.22, 0.405 + bob)],
         mix(light, (255, 255, 255), 0.45), 2)
    # Sleeves crossed at the waist, hands in gold cuffs.
    line(draw, cell, [(cx - 0.18, 0.45 + bob), (cx - 0.10, 0.62), (cx + 0.02, 0.60)], cloth, 8)
    line(draw, cell, [(cx + 0.18, 0.45 + bob), (cx + 0.12, 0.60), (cx + 0.02, 0.60)], mix(cloth, light, 0.2), 7)
    ellipse(draw, cell, cx - 0.05, 0.575, cx + 0.06, 0.645, fill=light, outline=Outline, width=2)
    # Hooded head sunk in shadow, lit eyes, gold circlet.
    ellipse(draw, cell, cx - 0.09, 0.19 + bob, cx + 0.09, 0.34 + bob, fill=(18, 16, 26), outline=Outline, width=3)
    rect(draw, cell, cx - 0.085, 0.205 + bob, cx + 0.085, 0.235 + bob, fill=accent)
    _enemy_eyes(draw, cell, cx, 0.275 + bob, dict(style, eyes='glare'), spread=0.032, r=0.018)
    # Crozier: tall shaft, spiral head and a floating memory gem.
    line(draw, cell, [(cx + 0.26 + sway, 0.12), (cx + 0.26, 0.88)], Outline, 6)
    line(draw, cell, [(cx + 0.26 + sway, 0.12), (cx + 0.26, 0.88)], mix(cloth, light, 0.35), 3)
    ellipse(draw, cell, cx + 0.19, 0.06, cx + 0.33, 0.20, outline=accent, width=3)
    poly(draw, cell, [(cx + 0.26, 0.085), (cx + 0.30, 0.125), (cx + 0.26, 0.165), (cx + 0.22, 0.125)],
         fill=light, outline=Outline, width=1)
    ellipse(draw, cell, cx + 0.215, 0.105, cx + 0.245, 0.145, fill=(255, 250, 220))
    # Small blessing motes drifting off the hem.
    for i in range(3):
        mx = cx - 0.22 + i * 0.20
        my = 0.76 - i * 0.05 + math.sin(t * math.tau + i) * 0.01
        ellipse(draw, cell, mx - 0.012, my - 0.012, mx + 0.012, my + 0.012, fill=accent)


def _warden(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    # Colossal furnace torso with shoulder plates.
    rect(draw, cell, cx - 0.30, 0.34 + bob, cx + 0.30, 0.78, fill=body, outline=Outline, width=3, radius=0.06)
    poly(draw, cell, [(cx - 0.38, 0.42 + bob), (cx - 0.24, 0.30 + bob), (cx - 0.14, 0.44 + bob)], fill=cloth, outline=Outline, width=2)
    poly(draw, cell, [(cx + 0.38, 0.42 + bob), (cx + 0.24, 0.30 + bob), (cx + 0.14, 0.44 + bob)], fill=cloth, outline=Outline, width=2)
    # Furnace grate and molten heart.
    rect(draw, cell, cx - 0.16, 0.48 + bob, cx + 0.16, 0.66 + bob, fill=cloth, outline=Outline, width=2)
    for i in range(3):
        rect(draw, cell, cx - 0.12 + i * 0.09, 0.50 + bob, cx - 0.07 + i * 0.09, 0.64 + bob, fill=accent)
    ellipse(draw, cell, cx - 0.05, 0.71 + bob, cx + 0.05, 0.81 + bob, fill=accent)
    # Horned helm.
    ellipse(draw, cell, cx - 0.14, 0.18 + bob, cx + 0.14, 0.38 + bob, fill=light, outline=Outline, width=3)
    rect(draw, cell, cx - 0.10, 0.25 + bob, cx + 0.10, 0.30 + bob, fill=cloth)
    ellipse(draw, cell, cx - 0.05, 0.27 + bob, cx + 0.05, 0.32 + bob, fill=style["eye"])
    for sign in (-1, 1):
        poly(draw, cell, [(cx + sign * 0.12, 0.21 + bob), (cx + sign * 0.28, 0.10 + bob), (cx + sign * 0.16, 0.30 + bob)], fill=cloth, outline=Outline, width=2)
    # Heavy arms.
    line(draw, cell, [(cx - 0.28, 0.48), (cx - 0.36, 0.66), (cx - 0.30, 0.84)], body, 6)
    line(draw, cell, [(cx + 0.28, 0.48), (cx + 0.36, 0.66), (cx + 0.30, 0.84)], body, 6)
    rect(draw, cell, cx - 0.20, 0.78, cx - 0.06, 0.94, fill=cloth, outline=Outline, width=2)
    rect(draw, cell, cx + 0.06, 0.78, cx + 0.20, 0.94, fill=cloth, outline=Outline, width=2)


def _serpent(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    sway = math.sin(t * math.tau) * 0.04
    # Coiled body.
    for i, (x, y, w, h) in enumerate(((0.50, 0.80, 0.42, 0.14), (0.46, 0.72, 0.34, 0.12), (0.54, 0.64, 0.26, 0.10))):
        ellipse(draw, cell, cx + x - 0.5 - w / 2, y - h / 2 + bob, cx + x - 0.5 + w / 2, y + h / 2 + bob, fill=body if i % 2 else light, outline=Outline, width=2)
    # Neck and head.
    line(draw, cell, [(cx, 0.64 + bob), (cx - 0.10 + sway, 0.46 + bob), (cx - 0.02, 0.30 + bob)], light, 8)
    ellipse(draw, cell, cx - 0.13, 0.20 + bob, cx + 0.10, 0.36 + bob, fill=body, outline=Outline, width=3)
    ellipse(draw, cell, cx - 0.06, 0.24 + bob, cx + 0.01, 0.30 + bob, fill=style["eye"])
    # Fins and crest.
    poly(draw, cell, [(cx - 0.13, 0.27 + bob), (cx - 0.28, 0.20 + bob), (cx - 0.14, 0.34 + bob)], fill=accent, outline=Outline, width=1)
    poly(draw, cell, [(cx + 0.02, 0.18 + bob), (cx + 0.10, 0.08 + bob), (cx + 0.13, 0.22 + bob)], fill=accent, outline=Outline, width=1)
    for i in range(4):
        x = cx - 0.20 + i * 0.13
        poly(draw, cell, [(x, 0.46 + bob), (x + 0.04, 0.36 + bob), (x + 0.08, 0.46 + bob)], fill=accent)


def _matriarch(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    sway = math.sin(t * math.tau) * 0.03
    # Trunk and roots.
    poly(draw, cell, [(cx - 0.10, 0.30 + bob), (cx + 0.10, 0.30 + bob), (cx + 0.18, 0.92), (cx - 0.18, 0.92)], fill=cloth, outline=Outline, width=3)
    for sign in (-1, 1):
        line(draw, cell, [(cx, 0.86), (cx + sign * 0.22, 0.94), (cx + sign * 0.30, 0.90)], cloth, 5)
    # Crown of petals.
    for i in range(7):
        a = math.pi + i * math.pi / 6
        x = cx + math.cos(a) * 0.26
        y = 0.22 + bob + math.sin(a) * 0.12
        ellipse(draw, cell, x - 0.06, y - 0.05, x + 0.06, y + 0.05, fill=accent if i % 2 else light, outline=Outline, width=1)
    ellipse(draw, cell, cx - 0.10, 0.24 + bob, cx + 0.10, 0.40 + bob, fill=light, outline=Outline, width=2)
    ellipse(draw, cell, cx - 0.03, 0.29 + bob, cx + 0.03, 0.35 + bob, fill=style["eye"])
    # Thorn arms.
    for sign in (-1, 1):
        line(draw, cell, [(cx + sign * 0.12, 0.46), (cx + sign * 0.30, 0.44 + sway), (cx + sign * 0.38, 0.60)], body, 4)
        for k in range(3):
            x = cx + sign * (0.20 + k * 0.06)
            poly(draw, cell, [(x, 0.47), (x + sign * 0.04, 0.40), (x + sign * 0.02, 0.50)], fill=accent)


def _regent(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    # Gear halo.
    for i in range(10):
        a = i * math.tau / 10 + t * math.tau
        x = cx + math.cos(a) * 0.30
        y = 0.28 + bob + math.sin(a) * 0.30
        rect(draw, cell, x - 0.025, y - 0.025, x + 0.025, y + 0.025, fill=accent)
    ellipse(draw, cell, cx - 0.24, 0.04 + bob, cx + 0.24, 0.52 + bob, outline=accent, width=2)
    # Robed clockwork torso.
    poly(draw, cell, [(cx - 0.14, 0.30 + bob), (cx + 0.14, 0.30 + bob), (cx + 0.24, 0.90), (cx - 0.24, 0.90)], fill=cloth, outline=Outline, width=3)
    rect(draw, cell, cx - 0.10, 0.42 + bob, cx + 0.10, 0.64 + bob, fill=body, outline=Outline, width=2)
    ellipse(draw, cell, cx - 0.05, 0.48 + bob, cx + 0.05, 0.58 + bob, fill=accent)
    line(draw, cell, [(cx, 0.53 + bob), (cx + 0.03, 0.48 + bob)], cloth, 1)
    # Head with crown.
    ellipse(draw, cell, cx - 0.09, 0.18 + bob, cx + 0.09, 0.34 + bob, fill=light, outline=Outline, width=2)
    ellipse(draw, cell, cx - 0.03, 0.24 + bob, cx + 0.03, 0.29 + bob, fill=style["eye"])
    poly(draw, cell, [(cx - 0.12, 0.17 + bob), (cx - 0.15, 0.06 + bob), (cx - 0.05, 0.13 + bob), (cx, 0.03 + bob), (cx + 0.05, 0.13 + bob), (cx + 0.15, 0.06 + bob), (cx + 0.12, 0.17 + bob)], fill=accent, outline=Outline, width=1)
    # Pendulum arms.
    line(draw, cell, [(cx - 0.14, 0.44), (cx - 0.28, 0.62), (cx - 0.26, 0.82)], body, 4)
    line(draw, cell, [(cx + 0.14, 0.44), (cx + 0.28, 0.62), (cx + 0.26, 0.82)], body, 4)


def _sovereign(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    # Wide swamp body.
    ellipse(draw, cell, cx - 0.34, 0.40 + bob, cx + 0.34, 0.88 + bob, fill=body, outline=Outline, width=3)
    ellipse(draw, cell, cx - 0.24, 0.46 + bob, cx + 0.20, 0.76 + bob, fill=light)
    # Crown of reeds.
    for i in range(7):
        x = cx - 0.18 + i * 0.06
        h = 0.10 + (i % 3) * 0.03
        line(draw, cell, [(x, 0.34 + bob), (x + (i - 3) * 0.01, 0.34 - h + bob)], accent, 2)
    # Eyes.
    for x in (-0.14, 0.0, 0.14):
        ellipse(draw, cell, cx + x - 0.035, 0.48 + bob, cx + x + 0.035, 0.54 + bob, fill=style["eye"])
    # Tendrils.
    for sign in (-1, 1):
        line(draw, cell, [(cx + sign * 0.26, 0.68), (cx + sign * 0.42, 0.80), (cx + sign * 0.36, 0.94)], cloth, 4)
    for i in range(3):
        ellipse(draw, cell, cx - 0.10 + i * 0.10, 0.86 + bob, cx - 0.06 + i * 0.10, 0.90 + bob, fill=accent)


def _giant(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    sway = math.sin(t * math.tau) * 0.02
    # Massive hunched body.
    poly(draw, cell, [(cx - 0.30, 0.40 + bob), (cx - 0.18, 0.24 + bob), (cx + 0.18, 0.24 + bob), (cx + 0.30, 0.40 + bob), (cx + 0.24, 0.82), (cx + 0.08, 0.90), (cx - 0.08, 0.90), (cx - 0.24, 0.82)], fill=body, outline=Outline, width=3)
    ellipse(draw, cell, cx - 0.16, 0.34 + bob, cx + 0.16, 0.62 + bob, fill=cloth)
    # Small head.
    ellipse(draw, cell, cx - 0.09, 0.16 + bob, cx + 0.09, 0.30 + bob, fill=light, outline=Outline, width=2)
    ellipse(draw, cell, cx - 0.02, 0.21 + bob, cx + 0.04, 0.26 + bob, fill=style["eye"])
    # Long arms.
    line(draw, cell, [(cx - 0.26, 0.38), (cx - 0.42, 0.62 + sway), (cx - 0.34, 0.90)], body, 7)
    line(draw, cell, [(cx + 0.26, 0.38), (cx + 0.42, 0.62 - sway), (cx + 0.34, 0.90)], body, 7)
    # Broken chains.
    for i in range(3):
        ellipse(draw, cell, cx - 0.20 + i * 0.10, 0.68, cx - 0.17 + i * 0.10, 0.71, outline=accent, width=1)


def _queen(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    # Wings behind the body.
    for sign in (-1, 1):
        poly(draw, cell, [(cx, 0.38 + bob), (cx + sign * 0.42, 0.18 + bob), (cx + sign * 0.30, 0.52 + bob)], fill=(*accent[:3], 110), outline=Outline, width=1)
    # Abdomen and thorax.
    ellipse(draw, cell, cx - 0.26, 0.58 + bob, cx + 0.26, 0.92 + bob, fill=body, outline=Outline, width=3)
    for i in range(3):
        ellipse(draw, cell, cx - 0.18 + i * 0.02, 0.66 + i * 0.08 + bob, cx + 0.18 - i * 0.02, 0.72 + i * 0.08 + bob, fill=cloth)
    ellipse(draw, cell, cx - 0.15, 0.36 + bob, cx + 0.15, 0.62 + bob, fill=light, outline=Outline, width=3)
    # Head, eyes and crown of antennae.
    ellipse(draw, cell, cx - 0.10, 0.20 + bob, cx + 0.10, 0.39 + bob, fill=light, outline=Outline, width=2)
    for x in (-0.05, 0.05):
        ellipse(draw, cell, cx + x - 0.025, 0.27 + bob, cx + x + 0.025, 0.31 + bob, fill=style["eye"])
    for i in range(-2, 3):
        line(draw, cell, [(cx + i * 0.045, 0.19 + bob), (cx + i * 0.07, 0.08 + bob)], accent, 2)
    # Legs and stinger.
    for sign in (-1, 1):
        for i in range(3):
            line(draw, cell, [(cx + sign * 0.18, 0.60 + i * 0.08), (cx + sign * 0.36, 0.70 + i * 0.08), (cx + sign * 0.30, 0.84 + i * 0.04)], body, 3)
    poly(draw, cell, [(cx, 0.92 + bob), (cx - 0.05, 0.82 + bob), (cx + 0.05, 0.82 + bob)], fill=accent, outline=Outline, width=1)


def _cantor(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    """The Void Cantor: a floating chorister whose lower body dissolves.

    It used the small-enemy `hunched` body at 1.0 scale, which read as a scaled
    up scavenger rather than a boss, so it gets its own silhouette: a tattered
    choral robe that frays into ribbons, a broad hood, three eyes and two
    spindly conducting arms raised over a severed hymn.
    """
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    sway = math.sin(t * math.tau) * 0.018
    sink = 0.012 + 0.006 * math.sin(t * math.tau)  # it hovers, never touches down
    # Ribbon tatters trailing below the robe.
    for i in range(7):
        x0 = cx - 0.24 + i * 0.08
        depth = 0.20 + (i % 3) * 0.05
        poly(draw, cell, [(x0 - 0.035, 0.68 + sink), (x0 + 0.035, 0.68 + sink),
                          (x0 + 0.02 + sway, 0.68 + depth + sink), (x0 - 0.01 + sway, 0.68 + depth * 0.8 + sink)],
             fill=cloth, outline=Outline, width=1)
    # Choral robe: wide mantle tapering to a ragged waist.
    poly(draw, cell, [(cx - 0.30, 0.42 + bob), (cx - 0.16, 0.24 + bob), (cx + 0.16, 0.24 + bob),
                      (cx + 0.30, 0.42 + bob), (cx + 0.24, 0.70 + sink), (cx - 0.24, 0.70 + sink)],
         fill=cloth, outline=Outline, width=3)
    poly(draw, cell, [(cx - 0.10, 0.44 + bob), (cx + 0.10, 0.44 + bob), (cx + 0.13, 0.68 + sink), (cx - 0.13, 0.68 + sink)],
         fill=body)
    # Choir stalls stitched down the front.
    for i in range(3):
        y = 0.50 + i * 0.06 + bob
        line(draw, cell, [(cx - 0.08, y), (cx + 0.08, y)], accent, 2)
        ellipse(draw, cell, cx - 0.012, y - 0.012, cx + 0.012, y + 0.012, fill=light)
    # Shoulder cowl with hanging stole ends.
    poly(draw, cell, [(cx - 0.26, 0.38 + bob), (cx - 0.10, 0.28 + bob), (cx + 0.10, 0.28 + bob), (cx + 0.26, 0.38 + bob),
                      (cx + 0.18, 0.47 + bob), (cx - 0.18, 0.47 + bob)],
         fill=mix(cloth, light, 0.28), outline=Outline, width=2)
    for sign in (-1, 1):
        poly(draw, cell, [(cx + sign * 0.19, 0.45 + bob), (cx + sign * 0.25, 0.45 + bob),
                          (cx + sign * 0.28 + sway, 0.66 + bob), (cx + sign * 0.21 + sway, 0.66 + bob)],
             fill=accent, outline=Outline, width=1)
    # Deep hood, three-eyes and a shadowed mouth open in song.
    ellipse(draw, cell, cx - 0.14, 0.10 + bob, cx + 0.14, 0.34 + bob, fill=cloth, outline=Outline, width=3)
    ellipse(draw, cell, cx - 0.105, 0.145 + bob, cx + 0.105, 0.30 + bob, fill=(12, 11, 20))
    _enemy_eyes(draw, cell, cx, 0.205 + bob, dict(style, eyes='many'), spread=0.058, r=0.021)
    ellipse(draw, cell, cx - 0.022, 0.252 + bob, cx + 0.022, 0.286 + bob, fill=accent)
    # Conducting arms with long bony fingers.
    for sign in (-1, 1):
        line(draw, cell, [(cx + sign * 0.19, 0.44 + bob), (cx + sign * 0.31, 0.35 + bob), (cx + sign * 0.34, 0.23 + bob)],
             body, 5)
        for f in range(3):
            fx = cx + sign * (0.32 + f * 0.018)
            line(draw, cell, [(cx + sign * 0.34, 0.23 + bob), (fx, 0.10 + bob - f * 0.012)], light, 2)
    # Hymn glyphs orbiting the hood.
    for i in range(4):
        a = t * math.tau + i * math.pi / 2
        gx = cx + math.cos(a) * 0.30
        gy = 0.20 + bob + math.sin(a) * 0.055
        poly(draw, cell, [(gx, gy - 0.022), (gx + 0.016, gy), (gx, gy + 0.022), (gx - 0.016, gy)],
             fill=accent, outline=Outline, width=1)


def _tyrant(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    sway = math.sin(t * math.tau) * 0.02
    bone = mix(light, (232, 226, 208), 0.45)
    dark_bone = mix(bone, Outline, 0.34)
    # Tattered emperor cloak behind everything, with a ragged hem.
    poly(draw, cell, [(cx - 0.29, 0.30 + bob), (cx + 0.29, 0.30 + bob), (cx + 0.44, 0.90),
                      (cx + 0.30, 0.82), (cx + 0.20, 0.92), (cx + 0.06, 0.84), (cx - 0.06, 0.93),
                      (cx - 0.20, 0.83), (cx - 0.32, 0.91), (cx - 0.44, 0.90)],
         fill=cloth, outline=Outline, width=3)
    # Pauldrons: layered bone plates with spikes.
    for sign in (-1, 1):
        poly(draw, cell, [(cx + sign * 0.13, 0.32 + bob), (cx + sign * 0.34, 0.26 + bob),
                          (cx + sign * 0.40, 0.42 + bob), (cx + sign * 0.17, 0.46 + bob)],
             fill=bone, outline=Outline, width=3)
        poly(draw, cell, [(cx + sign * 0.20, 0.30 + bob), (cx + sign * 0.35, 0.24 + bob),
                          (cx + sign * 0.26, 0.34 + bob)], fill=dark_bone)
        for i in range(2):
            sp = cx + sign * (0.28 + i * 0.06)
            line(draw, cell, [(sp, 0.30 + bob - i * 0.02), (sp + sign * 0.05, 0.16 + bob - i * 0.05)],
                 accent, 3)
    # Breastplate over a visible ribcage.
    rect(draw, cell, cx - 0.19, 0.34 + bob, cx + 0.19, 0.72 + bob, fill=body, outline=Outline, width=3, radius=0.04)
    for i in range(4):
        y = 0.42 + i * 0.065 + bob
        line(draw, cell, [(cx - 0.15, y), (cx + 0.15, y)], dark_bone, 3)
        line(draw, cell, [(cx - 0.15, y - 1.2 / cell), (cx + 0.15, y - 1.2 / cell)], bone, 1)
    rect(draw, cell, cx - 0.03, 0.36 + bob, cx + 0.03, 0.72 + bob, fill=dark_bone, outline=Outline, width=1)
    # Sternum jewel.
    poly(draw, cell, [(cx, 0.60 + bob), (cx + 0.045, 0.655 + bob), (cx, 0.71 + bob), (cx - 0.045, 0.655 + bob)],
         fill=accent, outline=Outline, width=1)
    # Skull with a heavy jaw, sockets and a ribbed crown.
    ellipse(draw, cell, cx - 0.125, 0.13 + bob, cx + 0.125, 0.31 + bob, fill=bone, outline=Outline, width=3)
    poly(draw, cell, [(cx - 0.09, 0.24 + bob), (cx + 0.09, 0.24 + bob), (cx + 0.07, 0.335 + bob), (cx - 0.07, 0.335 + bob)],
         fill=bone, outline=Outline, width=2)
    for i in range(4):
        rect(draw, cell, cx - 0.065 + i * 0.037, 0.285 + bob, cx - 0.05 + i * 0.037, 0.325 + bob, fill=dark_bone)
    _enemy_eyes(draw, cell, cx, 0.205 + bob, dict(style, eyes='hollow'), spread=0.052, r=0.030)
    ellipse(draw, cell, cx - 0.018, 0.245 + bob, cx + 0.018, 0.27 + bob, fill=dark_bone)
    # Crown of five tall bone spikes with a gem at the centre.
    for i in range(-2, 3):
        h = 0.10 if i == 0 else 0.075 - abs(i) * 0.012
        poly(draw, cell, [(cx + i * 0.052 - 0.022, 0.145 + bob), (cx + i * 0.052 + 0.022, 0.145 + bob),
                          (cx + i * 0.058, 0.145 + bob - h)], fill=bone, outline=Outline, width=1)
    poly(draw, cell, [(cx, 0.105 + bob), (cx + 0.022, 0.145 + bob), (cx, 0.185 + bob), (cx - 0.022, 0.145 + bob)],
         fill=accent, outline=Outline, width=1)
    # Great cleaver held low, blade catching the light.
    poly(draw, cell, [(cx + 0.24, 0.48 + bob), (cx + 0.44, 0.22 + sway), (cx + 0.40, 0.60 + bob), (cx + 0.27, 0.64 + bob)],
         fill=mix(light, (236, 240, 248), 0.35), outline=Outline, width=3)
    line(draw, cell, [(cx + 0.28, 0.55 + bob), (cx + 0.40, 0.35 + sway)], mix(light, (255, 255, 255), 0.6), 2)
    line(draw, cell, [(cx + 0.24, 0.57 + bob), (cx + 0.30, 0.72 + bob)], cloth, 6)
    rect(draw, cell, cx + 0.215, 0.505 + bob, cx + 0.275, 0.535 + bob, fill=accent, outline=Outline, width=1)


def _hound(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.46 + lunge
    # Ribbed torso and four legs.
    ellipse(draw, cell, cx - 0.26, 0.46 + bob, cx + 0.18, 0.68 + bob, fill=body, outline=Outline, width=3)
    for i in range(3):
        line(draw, cell, [(cx - 0.20 + i * 0.10, 0.48 + bob), (cx - 0.18 + i * 0.10, 0.64 + bob)], light, 2)
    for x in (cx - 0.20, cx - 0.08, cx + 0.04, cx + 0.14):
        line(draw, cell, [(x, 0.64 + bob), (x, 0.92)], body, 3)
    # Skull head with a long snout and a hanging jaw.
    ellipse(draw, cell, cx + 0.10, 0.36 + bob, cx + 0.34, 0.58 + bob, fill=light, outline=Outline, width=2)
    poly(draw, cell, [(cx + 0.30, 0.44 + bob), (cx + 0.46, 0.48 + bob), (cx + 0.30, 0.54 + bob)], fill=light, outline=Outline, width=1)
    ellipse(draw, cell, cx + 0.18, 0.43 + bob, cx + 0.24, 0.49 + bob, fill=accent)
    line(draw, cell, [(cx + 0.30, 0.55 + bob), (cx + 0.42, 0.57 + bob)], cloth, 2)
    # Ears, tail and a broken collar.
    poly(draw, cell, [(cx + 0.14, 0.37 + bob), (cx + 0.12, 0.26 + bob), (cx + 0.22, 0.35 + bob)], fill=cloth, outline=Outline, width=1)
    line(draw, cell, [(cx - 0.25, 0.52 + bob), (cx - 0.42, 0.36)], body, 3)
    ellipse(draw, cell, cx - 0.03, 0.50 + bob, cx + 0.09, 0.60 + bob, outline=accent, width=1)


def _hierophant(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.50 + lunge
    sway = math.sin(t * math.tau) * 0.03
    # Long drowned robe and inner mantle.
    poly(draw, cell, [(cx - 0.22, 0.42 + bob), (cx + 0.22, 0.42 + bob),
                      (cx + 0.36, 0.94), (cx + 0.18, 0.88), (cx, 0.96),
                      (cx - 0.18, 0.88), (cx - 0.36, 0.94)],
         fill=cloth, outline=Outline, width=3)
    poly(draw, cell, [(cx - 0.14, 0.44 + bob), (cx + 0.14, 0.44 + bob),
                      (cx + 0.20, 0.88), (cx - 0.20, 0.88)],
         fill=body)
    for i in range(3):
        line(draw, cell, [(cx - 0.16 + i * 0.16, 0.46 + bob), (cx - 0.22 + i * 0.16, 0.90)], light, 2)
    poly(draw, cell, [(cx, 0.48 + bob), (cx + 0.07, 0.58 + bob), (cx, 0.68 + bob), (cx - 0.07, 0.58 + bob)],
         fill=accent, outline=Outline, width=2)
    # Mask and halo of eyes.
    ellipse(draw, cell, cx - 0.13, 0.22 + bob, cx + 0.13, 0.42 + bob, fill=light, outline=Outline, width=3)
    for x in (-0.06, 0.06):
        ellipse(draw, cell, cx + x - 0.03, 0.29 + bob, cx + x + 0.03, 0.35 + bob, fill=style["eye"])
        ellipse(draw, cell, cx + x - 0.012, 0.315 + bob, cx + x + 0.012, 0.34 + bob, fill=Outline)
    ellipse(draw, cell, cx - 0.28, 0.02 + bob, cx + 0.28, 0.22 + bob, outline=accent, width=3)
    for i in range(5):
        a = math.pi + i * math.pi / 4
        x = cx + math.cos(a) * 0.26
        y = 0.12 + bob + math.sin(a) * 0.09
        ellipse(draw, cell, x - 0.028, y - 0.028, x + 0.028, y + 0.028, fill=accent, outline=Outline, width=1)
    # Four conducting arms.
    for sign in (-1, 1):
        for i, y in enumerate((0.48, 0.62)):
            line(draw, cell, [(cx + sign * 0.16, y + bob), (cx + sign * (0.38 + i * 0.04), y - 0.04 + sway)], light, 3)
            line(draw, cell, [(cx + sign * (0.30 + i * 0.03), y + 0.05), (cx + sign * (0.42 + i * 0.04), y + 0.12)], accent, 2)


def _behemoth(draw: ImageDraw.ImageDraw, cell: int, style: dict, row: int, frame: int, t: float) -> None:
    bob, lunge = _enemy_common(draw, cell, style, row, frame, t)
    body, light, cloth, accent = style["body"], style["light"], style["cloth"], style["accent"]
    cx = 0.46 + lunge
    sway = math.sin(t * math.tau) * 0.02
    # Tail with glowing tip.
    line(draw, cell, [(cx - 0.30, 0.52 + bob), (cx - 0.42, 0.38 + sway)], light, 4)
    ellipse(draw, cell, cx - 0.45, 0.34 + sway, cx - 0.39, 0.41 + sway, fill=accent, outline=Outline, width=1)
    # Huge low body and four armored legs.
    for x in (cx - 0.24, cx - 0.10, cx + 0.04, cx + 0.18):
        rect(draw, cell, x - 0.04, 0.64 + bob, x + 0.04, 0.93, fill=body, outline=Outline, width=2, radius=0.01)
    ellipse(draw, cell, cx - 0.32, 0.40 + bob, cx + 0.24, 0.72 + bob, fill=body, outline=Outline, width=3)
    for i in range(3):
        line(draw, cell, [(cx - 0.22 + i * 0.12, 0.46 + bob), (cx - 0.18 + i * 0.12, 0.66 + bob)], light, 3)
    ellipse(draw, cell, cx - 0.08, 0.50 + bob, cx + 0.04, 0.62 + bob, fill=accent, outline=Outline, width=2)
    # Horned skull.
    ellipse(draw, cell, cx + 0.14, 0.32 + bob, cx + 0.40, 0.56 + bob, fill=light, outline=Outline, width=3)
    for x in (cx + 0.20, cx + 0.32):
        ellipse(draw, cell, x - 0.035, 0.40 + bob, x + 0.035, 0.46 + bob, fill=style["eye"])
    for sign, base in ((-1, cx + 0.20), (1, cx + 0.35)):
        poly(draw, cell, [(base, 0.34 + bob), (base + sign * 0.10, 0.16 + bob), (base + sign * 0.05, 0.36 + bob)],
             fill=accent, outline=Outline, width=2)
    poly(draw, cell, [(cx + 0.34, 0.52 + bob), (cx + 0.46, 0.56 + bob), (cx + 0.32, 0.58 + bob)], fill=light, outline=Outline, width=1)
    # Spiked ridge.
    for i in range(5):
        x = cx - 0.26 + i * 0.11
        poly(draw, cell, [(x, 0.42 + bob), (x + 0.04, 0.26 + bob), (x + 0.09, 0.42 + bob)], fill=accent, outline=Outline, width=2)


ENEMY_DRAW = {
    "construct": _construct,
    "hunched": _hunched,
    "wisp": _wisp,
    "beast": _beast,
    "duelist": _duelist,
    "keeper": _keeper,
    "warden": _warden,
    "serpent": _serpent,
    "matriarch": _matriarch,
    "regent": _regent,
    "sovereign": _sovereign,
    "giant": _giant,
    "queen": _queen,
    "tyrant": _tyrant,
    "hound": _hound,
    "hierophant": _hierophant,
    "cantor": _cantor,
    "behemoth": _behemoth,
}


def rim_light(img: Image.Image, color: tuple[int, ...], offset: int = 2 * SS,
              strength: int = 96) -> None:
    """Lights the top-left silhouette edge so actors read against dark tiles.

    Takes the alpha channel, shifts a copy down-right, and keeps only the band
    where the shifted copy is empty: the outline that faces the light source.
    """
    alpha = img.getchannel("A")
    shifted = Image.new("L", img.size, 0)
    shifted.paste(alpha, (offset, offset))
    rim = ImageChops.subtract(alpha, shifted).filter(ImageFilter.GaussianBlur(SS * 0.8))
    layer = Image.new("RGBA", img.size, tuple(color[:3]) + (0,))
    layer.putalpha(rim.point(lambda value: int(value * strength / 255)))
    img.alpha_composite(layer)


def enemy_frame(kind: str, row: int, frame: int, frames: int, cell: int = ENEMY_CELL) -> Image.Image:
    img = blank(cell)
    draw = ImageDraw.Draw(img)
    style = ENEMY_STYLES[kind]
    t = frame / frames
    bob, _ = _enemy_common(draw, cell, style, row, frame, t)
    # Redraw shadow once over the base after the common helper.
    if row == 3:
        draw.rectangle((0, 0, cell * SS, cell * SS), fill=(0, 0, 0, 0))
        _enemy_common(draw, cell, style, row, frame, t)
    glow(img, lambda g: ellipse(g, cell, 0.42, 0.26 + bob, 0.58, 0.42 + bob, fill=style["accent"], ), 2.4)
    ENEMY_DRAW[style["kind"]](draw, cell, style, row, frame, t)
    if row != 3:
        # Rim light belongs on living frames only; the death strip fades out.
        rim_light(img, mix(style["light"], (255, 255, 255), 0.35))
    if row == 3:
        alpha = max(60, 255 - frame * 50)
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        overlay.alpha_composite(img)
        img = overlay
        img.putalpha(img.getchannel("A").point(lambda value: min(value, alpha)))
    return img


# ---------------------------------------------------------------------------
# Tiles
# ---------------------------------------------------------------------------


def tile_image(biome: str, tile_type: str, variant: int) -> Image.Image:
    cell = TILE
    img = Image.new("RGBA", (cell * SS, cell * SS), (0, 0, 0, 0))
    if tile_type == "empty":
        return img
    draw = ImageDraw.Draw(img)
    art = BIOME_ART[biome]
    rng = random.Random(f"{biome}:{tile_type}:{variant}")
    dark, base, light, accent = art["dark"], art["base"], art["light"], art["accent"]

    if tile_type in ("floor", "wall", "hazard", "secret"):
        rect(draw, cell, 0, 0, 1, 1, fill=dark)
    if tile_type == "floor":
        rect(draw, cell, 0, 0, 1, 1, fill=base)
        rect(draw, cell, 0, 0, 1, 0.28, fill=light)
        rect(draw, cell, 0, 0.24, 1, 0.30, fill=mix(light, accent, 0.4))
        for _ in range(3 + variant):
            x = rng.uniform(0.08, 0.9)
            y = rng.uniform(0.35, 0.9)
            line(draw, cell, [(x, y), (x + rng.uniform(-0.12, 0.12), y + rng.uniform(0.08, 0.22))], dark, 1)
        if biome in ("forest", "sanctuary"):
            for _ in range(2 + variant):
                x = rng.uniform(0.1, 0.85)
                ellipse(draw, cell, x, 0.02, x + 0.07, 0.09, fill=art["foliage"])
    elif tile_type == "wall":
        rect(draw, cell, 0, 0, 1, 1, fill=base)
        for row in range(3):
            y = row / 3
            line(draw, cell, [(0, y), (1, y)], dark, 2)
            offset = 0.5 if row % 2 else 0.0
            for col in range(2):
                x = (col + offset) / 2
                line(draw, cell, [(x, y), (x, y + 1 / 3)], dark, 2)
        rect(draw, cell, 0, 0, 1, 0.07, fill=light)
        if biome == "crystal":
            for _ in range(2 + variant):
                x = rng.uniform(0.1, 0.8)
                y = rng.uniform(0.15, 0.75)
                poly(draw, cell, [(x, y), (x + 0.08, y + 0.04), (x + 0.05, y + 0.16), (x - 0.03, y + 0.12)], fill=accent, outline=dark, width=1)
    elif tile_type == "platform":
        rect(draw, cell, 0.02, 0.18, 0.98, 0.44, fill=base, outline=Outline, width=1, radius=0.02)
        rect(draw, cell, 0.02, 0.18, 0.98, 0.28, fill=light)
        rect(draw, cell, 0.12, 0.42, 0.22, 0.82, fill=dark)
        rect(draw, cell, 0.78, 0.42, 0.88, 0.82, fill=dark)
        line(draw, cell, [(0.03, 0.44), (0.97, 0.44)], accent, 1)
    elif tile_type == "hazard":
        rect(draw, cell, 0, 0.35, 1, 1, fill=dark)
        for i in range(4):
            x = 0.08 + i * 0.24 + variant * 0.01
            poly(draw, cell, [(x, 0.72), (x + 0.10, 0.18), (x + 0.20, 0.72)], fill=art["hazard"], outline=Outline, width=1)
            line(draw, cell, [(x + 0.10, 0.24), (x + 0.10, 0.62)], accent, 1)
    elif tile_type == "water":
        rect(draw, cell, 0, 0.1, 1, 1, fill=art["water"])
        for i in range(4):
            y = 0.18 + i * 0.2
            line(draw, cell, [(0, y), (0.25, y - 0.04), (0.5, y), (0.75, y - 0.04), (1, y)], mix(art["water"], light, 0.55), 1)
            line(draw, cell, [(0, y + 0.05), (0.3, y + 0.01), (0.6, y + 0.05), (1, y + 0.02)], rgba(light[:3], 100), 1)
    elif tile_type == "ladder":
        rect(draw, cell, 0.22, 0, 0.29, 1, fill=art["foliage"] if biome == "forest" else mix(base, light, 0.3))
        rect(draw, cell, 0.70, 0, 0.77, 1, fill=art["foliage"] if biome == "forest" else mix(base, light, 0.3))
        for i in range(4):
            y = 0.12 + i * 0.24
            rect(draw, cell, 0.20, y, 0.79, y + 0.07, fill=light, outline=Outline, width=1)
    elif tile_type == "door":
        rect(draw, cell, 0, 0, 1, 1, fill=dark)
        rect(draw, cell, 0.12, 0.16, 0.88, 1, fill=base, outline=Outline, width=2, radius=0.10)
        rect(draw, cell, 0.20, 0.24, 0.80, 1, fill=mix(art["water"], dark, 0.55), outline=light, width=1, radius=0.08)
        ellipse(draw, cell, 0.32, 0.30, 0.44, 0.42, outline=accent, width=1)
        line(draw, cell, [(0.38, 0.31), (0.44, 0.37)], accent, 1)
        ellipse(draw, cell, 0.70, 0.56, 0.75, 0.61, fill=accent)
    elif tile_type == "secret":
        rect(draw, cell, 0, 0, 1, 1, fill=base)
        line(draw, cell, [(0.08, 0.05), (0.25, 0.38), (0.18, 0.70), (0.36, 0.96)], dark, 2)
        line(draw, cell, [(0.62, 0.06), (0.72, 0.31), (0.60, 0.55), (0.78, 0.80)], dark, 2)
        poly(draw, cell, [(0.42, 0.36), (0.58, 0.36), (0.62, 0.52), (0.50, 0.66), (0.38, 0.52)], fill=None, outline=accent, width=2)
        line(draw, cell, [(0.5, 0.41), (0.5, 0.59)], accent, 1)
    return img


# ---------------------------------------------------------------------------
# Backgrounds, props, UI, particles
# ---------------------------------------------------------------------------


def background_image(biome: str) -> Image.Image:
    art = BACKGROUND_ART[biome]
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)
    top, bottom = art["top"], art["bottom"]
    for y in range(size):
        t = y / size
        color = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        draw.line([(0, y), (size, y)], fill=color)
    rng = random.Random(f"background:{biome}")
    for _ in range(150):
        x, y = rng.randrange(size), rng.randrange(size)
        radius = rng.choice((1, 1, 1, 2))
        alpha = rng.randrange(30, 150)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=art["accent"] + (alpha,))
    # Distant fog.
    fog = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fog_draw = ImageDraw.Draw(fog)
    for _ in range(7):
        x = rng.randrange(-100, size)
        y = rng.randrange(80, size - 60)
        w = rng.randrange(120, 320)
        h = rng.randrange(24, 70)
        fog_draw.ellipse((x, y, x + w, y + h), fill=art["accent"] + (18,))
    fog = fog.filter(ImageFilter.GaussianBlur(18))
    img.alpha_composite(fog)
    # Silhouettes.
    sil = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sil)
    color = art["silhouette"] + (255,)
    if biome in ("ruins", "sanctuary"):
        for i in range(5):
            x = 20 + i * 105 + rng.randrange(-15, 15)
            w = rng.randrange(48, 90)
            h = rng.randrange(130, 300)
            sd.rectangle((x, size - h, x + w, size), fill=color)
            if biome == "sanctuary":
                sd.arc((x - 10, size - h - 35, x + w + 10, size - h + 60), 180, 360, fill=color, width=18)
            else:
                sd.polygon([(x, size - h), (x + w / 2, size - h - 32), (x + w, size - h)], fill=color)
    elif biome == "forest":
        for i in range(11):
            x = i * 52 + rng.randrange(-12, 12)
            trunk = max(8, 22 - i % 3 * 4)
            height = rng.randrange(170, 330)
            sd.rectangle((x, size - height, x + trunk, size), fill=color)
            sd.ellipse((x - 55, size - height - 60, x + trunk + 55, size - height + 60), fill=color)
    elif biome == "caves":
        for i in range(12):
            x = i * 48 + rng.randrange(-10, 10)
            width = rng.randrange(18, 42)
            height = rng.randrange(60, 180)
            sd.polygon([(x, 0), (x + width, 0), (x + width / 2, height)], fill=color)
            sd.polygon([(x, size), (x + width, size), (x + width / 2, size - height * 0.7)], fill=color)
    elif biome == "crystal":
        for i in range(12):
            x = rng.randrange(0, size)
            y = size - rng.randrange(80, 280)
            w = rng.randrange(18, 52)
            h = rng.randrange(70, 220)
            sd.polygon([(x, y), (x + w, y + h * 0.25), (x + w * 0.6, y + h), (x - w * 0.2, y + h * 0.55)], fill=color)
            sd.line([(x + w * 0.3, y + 12), (x + w * 0.4, y + h * 0.7)], art["accent"] + (80,), width=2)
    elif biome == "void":
        for i in range(5):
            x = 40 + i * 105
            sd.polygon([(x, size), (x + 24, size * 0.25), (x + 12, size * 0.55), (x + 52, 0), (x + 66, size)], fill=color)
        sd.ellipse((190, 150, 330, 290), outline=art["accent"] + (130,), width=2)
        sd.ellipse((214, 174, 306, 266), outline=art["accent"] + (70,), width=1)
    elif biome == "ash":
        # Burnt trunks, a broken arch and drifting embers.
        for i in range(9):
            x = i * 58 + rng.randrange(-14, 14)
            h = rng.randrange(150, 340)
            w = rng.randrange(8, 20)
            sd.polygon([(x, size), (x + w, size), (x + w * 0.7, size - h), (x + w * 0.1, size - h)], fill=color)
            for b in range(2):
                by = size - h * (0.55 + b * 0.2)
                sd.line([(x + w * 0.4, by), (x + w * 0.4 + rng.choice((-1, 1)) * rng.randrange(20, 46), by - 24)], fill=color, width=4)
        sd.arc((150, size - 190, 380, size + 30), 180, 360, fill=color, width=26)
        for _ in range(40):
            ex, ey = rng.randrange(size), rng.randrange(size)
            sd.ellipse((ex, ey, ex + 2, ey + 2), fill=art["accent"] + (rng.randrange(70, 170),))
    elif biome == "abyss":
        # Sunken arches and tall kelp fans under deep water.
        for i in range(4):
            x = 20 + i * 130 + rng.randrange(-12, 12)
            w = rng.randrange(58, 86)
            h = rng.randrange(140, 230)
            sd.rectangle((x, size - h, x + w, size), fill=color)
            sd.arc((x - 6, size - h - w * 0.5, x + w + 6, size - h + w * 0.5), 180, 360, fill=color, width=14)
        for i in range(14):
            x = rng.randrange(size)
            h = rng.randrange(90, 260)
            sway = rng.randrange(-14, 14)
            sd.line([(x, size), (x + sway * 0.4, size - h * 0.5), (x + sway, size - h)], fill=color, width=rng.randrange(3, 7))
        for _ in range(30):
            bx, by = rng.randrange(size), rng.randrange(size)
            r = rng.randrange(1, 4)
            sd.ellipse((bx - r, by - r, bx + r, by + r), outline=art["accent"] + (90,), width=1)
    elif biome == "frost":
        # Jagged ice ridges across a pale horizon.
        for i in range(8):
            x = i * 66 + rng.randrange(-18, 18)
            w = rng.randrange(70, 140)
            h = rng.randrange(90, 240)
            sd.polygon([(x, size), (x + w * 0.45, size - h), (x + w, size)], fill=color)
        for i in range(6):
            x = rng.randrange(size)
            y = size - rng.randrange(180, 320)
            sd.polygon([(x, y), (x + 16, y + 34), (x + 4, y + 60), (x - 10, y + 30)], fill=color)
        sd.rectangle((0, size - 26, size, size), fill=art["silhouette"] + (255,))
    elif biome == "bloom":
        # Overgrown arches swallowed by enormous blossoms.
        for i in range(4):
            x = 10 + i * 128 + rng.randrange(-10, 10)
            w = rng.randrange(64, 92)
            h = rng.randrange(150, 230)
            sd.rectangle((x, size - h, x + 16, size), fill=color)
            sd.rectangle((x + w - 16, size - h, x + w, size), fill=color)
            sd.arc((x, size - h - 20, x + w, size - h + w), 180, 360, fill=color, width=16)
        for _ in range(16):
            cx, cy = rng.randrange(size), rng.randrange(60, size - 40)
            r = rng.randrange(10, 26)
            for petal in range(6):
                a = petal * math.tau / 6
                px, py = cx + math.cos(a) * r * 0.7, cy + math.sin(a) * r * 0.7
                sd.ellipse((px - r * 0.5, py - r * 0.5, px + r * 0.5, py + r * 0.5), fill=color)
    elif biome == "foundry":
        # Chimney stacks, pipe gantries and furnace glow behind the wall.
        for i in range(6):
            x = 10 + i * 86 + rng.randrange(-14, 14)
            w = rng.randrange(28, 50)
            h = rng.randrange(180, 380)
            sd.rectangle((x, size - h, x + w, size), fill=color)
            sd.rectangle((x - 6, size - h, x + w + 6, size - h + 14), fill=color)
        for i in range(3):
            y = size - 120 - i * 70
            sd.rectangle((0, y, size, y + 10), fill=color)
            for gx in range(30, size, 90):
                sd.line([(gx, y), (gx, y + 40)], fill=color, width=5)
        for _ in range(26):
            gx, gy = rng.randrange(size), rng.randrange(size)
            sd.ellipse((gx - 2, gy - 2, gx + 2, gy + 2), fill=art["accent"] + (rng.randrange(60, 150),))
    elif biome == "mire":
        # Gnarled swamp trees with hanging moss over still water.
        for i in range(9):
            x = i * 58 + rng.randrange(-16, 16)
            h = rng.randrange(160, 320)
            w = rng.randrange(10, 24)
            lean = rng.randrange(-26, 26)
            sd.polygon([(x, size), (x + w, size), (x + w + lean, size - h), (x + lean, size - h)], fill=color)
            for m in range(3):
                mx = x + lean + rng.randrange(-30, 30)
                sd.line([(mx, size - h + 30), (mx + rng.randrange(-8, 8), size - h + rng.randrange(70, 140))],
                        fill=color, width=rng.randrange(2, 5))
        sd.rectangle((0, size - 34, size, size), fill=art["silhouette"] + (255,))
        for _ in range(20):
            bx, by = rng.randrange(size), size - rng.randrange(6, 40)
            sd.line([(bx, by), (bx + rng.randrange(10, 40), by)], fill=art["accent"] + (50,), width=1)
    elif biome == "hive":
        # Giant hexagonal chambers stacked into comb walls.
        def cell(cx: float, cy: float, r: float) -> None:
            sd.polygon(
                [(cx + math.cos(math.pi / 3 * i - math.pi / 6) * r,
                  cy + math.sin(math.pi / 3 * i - math.pi / 6) * r) for i in range(6)],
                fill=color,
            )

        for row in range(4):
            for col in range(6):
                cx = 40 + col * 92 + (46 if row % 2 else 0)
                cy = size - 40 - row * 84
                cell(cx, cy, rng.randrange(30, 44))
        for _ in range(30):
            gx, gy = rng.randrange(size), rng.randrange(size)
            sd.ellipse((gx - 2, gy - 2, gx + 2, gy + 2), fill=art["accent"] + (rng.randrange(70, 160),))
    elif biome == "catacomb":
        # Receding stone arches over stacked tomb niches.
        for i in range(5):
            x = 12 + i * 104 + rng.randrange(-8, 8)
            w = rng.randrange(58, 76)
            h = rng.randrange(190, 300)
            sd.rectangle((x, size - h, x + 14, size), fill=color)
            sd.rectangle((x + w - 14, size - h, x + w, size), fill=color)
            sd.arc((x, size - h - 24, x + w, size - h + w), 180, 360, fill=color, width=14)
            for niche in range(3):
                ny = size - h + 46 + niche * 62
                sd.rectangle((x + 22, ny, x + w - 22, ny + 26), fill=color)
        for _ in range(24):
            dx, dy = rng.randrange(size), rng.randrange(size)
            sd.ellipse((dx - 2, dy - 2, dx + 2, dy + 2), fill=art["accent"] + (rng.randrange(40, 120),))
    sil = sil.filter(ImageFilter.GaussianBlur(1.2))
    img.alpha_composite(sil)
    return img


def prop_image(kind: str) -> Image.Image:
    cell = 192 if kind in ("furn_dais", "furn_rug") or kind.startswith("building_") else 96
    img = blank(cell)
    draw = ImageDraw.Draw(img)
    palette = {
        "memory_fountain": ((92, 88, 112), (166, 160, 188), (111, 231, 255)),
        "shrine": ((74, 66, 58), (176, 158, 128), (255, 214, 130)),
        "statue": ((104, 92, 78), (178, 158, 128), (255, 217, 138)),
        "crystal_cluster": ((78, 52, 128), (196, 144, 255), (116, 244, 255)),
        "ancient_tree": ((52, 74, 48), (112, 152, 86), (198, 255, 156)),
        "ruins_door": ((90, 74, 60), (160, 132, 104), (255, 217, 138)),
        "sanctuary_altar": ((126, 100, 52), (232, 204, 138), (255, 244, 196)),
        "void_rift": ((16, 16, 28), (64, 56, 92), (92, 232, 255)),
        "memory_chest": ((80, 60, 44), (146, 112, 70), (255, 217, 138)),
        "barrel": ((78, 52, 32), (150, 102, 56), (255, 170, 80)),
        "lever": ((64, 58, 74), (140, 134, 160), (255, 225, 140)),
        "npc_archivist": ((50, 58, 100), (128, 146, 214), (150, 220, 255)),
        "npc_smith": ((86, 46, 34), (196, 110, 70), (255, 180, 90)),
        "npc_gardener": ((38, 70, 44), (110, 160, 96), (190, 255, 150)),
        "bone_pile": ((46, 44, 38), (168, 162, 140), (143, 216, 200)),
        "hive_comb": ((62, 42, 16), (168, 120, 48), (255, 196, 96)),
        "station_hearth": ((54, 36, 28), (146, 104, 72), (255, 170, 80)),
        "station_armory": ((52, 46, 40), (150, 138, 118), (220, 196, 140)),
        "station_infirmary": ((42, 54, 52), (168, 190, 176), (150, 240, 210)),
        "station_wellspring": ((40, 52, 58), (120, 168, 184), (111, 231, 255)),
        "station_watchtower": ((58, 48, 34), (176, 150, 104), (255, 224, 140)),
        "station_bulwark": ((48, 48, 56), (140, 144, 168), (200, 214, 255)),
        "station_vault": ((56, 42, 24), (156, 118, 56), (255, 208, 110)),
        "station_training": ((60, 44, 28), (170, 128, 76), (255, 196, 120)),
        "station_meditation": ((46, 48, 56), (150, 156, 170), (150, 240, 255)),
        "station_notice": ((54, 40, 26), (160, 122, 72), (240, 224, 176)),
        "furn_table": ((52, 40, 28), (148, 114, 74), (255, 214, 140)),
        "furn_chair": ((48, 38, 28), (128, 98, 66), (220, 180, 120)),
        "furn_shelf": ((45, 36, 26), (124, 92, 58), (230, 200, 150)),
        "furn_crate": ((55, 44, 30), (140, 110, 72), (210, 180, 120)),
        "furn_planter": ((38, 52, 38), (104, 146, 90), (180, 240, 160)),
        "furn_lantern": ((50, 48, 54), (150, 146, 160), (255, 224, 150)),
        "furn_rug": ((44, 40, 48), (106, 92, 118), (206, 168, 108)),
        "furn_banner": ((34, 58, 66), (86, 142, 154), (255, 214, 140)),
        "furn_bench": ((54, 40, 26), (140, 104, 66), (220, 180, 120)),
        "furn_dais": ((46, 42, 34), (134, 116, 88), (226, 196, 132)),
        "furn_column": ((50, 46, 40), (142, 132, 112), (224, 196, 140)),
        "cog_pillar": ((52, 44, 32), (154, 128, 82), (255, 190, 96)),
        "ice_spire": ((44, 62, 78), (160, 206, 230), (220, 248, 255)),
        "coral": ((30, 62, 58), (108, 170, 156), (120, 240, 220)),
        "npc_warden": ((44, 50, 66), (124, 140, 176), (150, 210, 255)),
        "npc_lamplighter": ((48, 42, 32), (150, 122, 76), (255, 216, 130)),
        "building_archive": ((38, 40, 62), (128, 126, 158), (168, 170, 255)),
        "building_forge": ((52, 32, 26), (150, 98, 70), (255, 158, 78)),
        "building_garden": ((34, 50, 34), (112, 148, 96), (168, 240, 150)),
        "building_barracks": ((46, 46, 52), (140, 142, 158), (196, 214, 255)),
        "building_lamphouse": ((50, 40, 26), (162, 128, 78), (255, 214, 130)),
        "furn_books": ((46, 34, 44), (168, 132, 96), (206, 178, 120)),
        "furn_candle": ((42, 36, 30), (196, 186, 160), (255, 214, 130)),
        "furn_anvil": ((40, 40, 46), (108, 112, 126), (255, 150, 70)),
        "furn_weapon_rack": ((40, 34, 28), (140, 116, 82), (196, 214, 255)),
        "furn_stool": ((44, 34, 24), (150, 116, 78), (226, 200, 150)),
        "furn_vines": ((34, 48, 32), (92, 130, 78), (150, 210, 120)),
        "furn_brazier": ((42, 34, 28), (128, 104, 76), (255, 168, 82)),
        "furn_herbs": ((38, 42, 30), (126, 132, 88), (196, 226, 150)),
        "furn_desk": ((44, 34, 26), (150, 116, 78), (240, 226, 190)),
        "furn_cauldron": ((34, 34, 38), (94, 98, 106), (150, 240, 170)),
        "furn_strings": ((46, 38, 26), (168, 138, 84), (255, 220, 140)),
        "cairn_stack": ((40, 38, 36), (118, 116, 112), (255, 196, 110)),
    }[kind]
    dark, light, accent = palette
    ellipse(draw, cell, 0.18, 0.82, 0.82, 0.94, fill=Shadow)
    if kind.startswith("building_"):
        # A house facade: pitched roof, plaster wall, lit windows, a plank door
        # and a hanging sign that carries the resident's colour.
        roof = mix(dark, (18, 14, 12), 0.35)
        win = mix(accent, (255, 244, 210), 0.55)
        # Chimney behind the roofline.
        rect(draw, cell, 0.70, 0.10, 0.80, 0.30, fill=roof, outline=Outline, width=2)
        # Wall block.
        rect(draw, cell, 0.10, 0.40, 0.90, 0.94, fill=light, outline=Outline, width=3, radius=0.02)
        # Pitched roof.
        poly(draw, cell, [(0.02, 0.42), (0.50, 0.08), (0.98, 0.42)], fill=roof, outline=Outline, width=3)
        poly(draw, cell, [(0.10, 0.40), (0.50, 0.14), (0.90, 0.40)], outline=mix(roof, light, 0.5), width=1)
        rect(draw, cell, 0.04, 0.38, 0.96, 0.44, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.04, 0.42, 0.96, 0.455, fill=accent)
        # Windows with warm light and cross mullions.
        for x0 in (0.17, 0.61):
            rect(draw, cell, x0, 0.51, x0 + 0.22, 0.66, fill=win, outline=Outline, width=2)
            line(draw, cell, [(x0 + 0.11, 0.51), (x0 + 0.11, 0.66)], dark, 1)
            line(draw, cell, [(x0, 0.585), (x0 + 0.22, 0.585)], dark, 1)
        # Door and step.
        rect(draw, cell, 0.40, 0.60, 0.60, 0.94, fill=dark, outline=Outline, width=3, radius=0.03)
        rect(draw, cell, 0.44, 0.64, 0.56, 0.94, fill=mix(dark, light, 0.35), outline=Outline, width=1)
        ellipse(draw, cell, 0.525, 0.76, 0.555, 0.79, fill=accent, outline=Outline, width=1)
        rect(draw, cell, 0.38, 0.93, 0.62, 0.97, fill=light, outline=Outline, width=1)
        # Hanging sign above the door.
        rect(draw, cell, 0.40, 0.465, 0.60, 0.495, fill=accent, outline=Outline, width=1)
        line(draw, cell, [(0.44, 0.495), (0.44, 0.60)], dark, 1)
        line(draw, cell, [(0.56, 0.495), (0.56, 0.60)], dark, 1)
        if kind == "building_archive":
            for i in range(3):
                rect(draw, cell, 0.43 + i * 0.05, 0.468, 0.455 + i * 0.05, 0.492, fill=dark)
        elif kind == "building_forge":
            poly(draw, cell, [(0.44, 0.49), (0.50, 0.468), (0.56, 0.49), (0.52, 0.492), (0.50, 0.478), (0.48, 0.492)], fill=dark)
        elif kind == "building_garden":
            line(draw, cell, [(0.12, 0.44), (0.14, 0.70), (0.10, 0.94)], accent, 2)
            line(draw, cell, [(0.88, 0.44), (0.86, 0.72), (0.90, 0.94)], accent, 2)
            ellipse(draw, cell, 0.08, 0.86, 0.22, 0.98, fill=mix(light, accent, 0.4), outline=Outline, width=1)
            ellipse(draw, cell, 0.78, 0.86, 0.92, 0.98, fill=mix(light, accent, 0.4), outline=Outline, width=1)
        elif kind == "building_barracks":
            for x0 in (0.14, 0.76):
                rect(draw, cell, x0, 0.46, x0 + 0.10, 0.90, fill=accent, outline=Outline, width=1)
                poly(draw, cell, [(x0, 0.90), (x0 + 0.05, 0.96), (x0 + 0.10, 0.90)], fill=dark)
        elif kind == "building_lamphouse":
            rect(draw, cell, 0.50, 0.02, 0.54, 0.12, fill=dark, outline=Outline, width=1)
            ellipse(draw, cell, 0.44, 0.05, 0.60, 0.14, fill=win, outline=Outline, width=1)
            for x0 in (0.28, 0.68):
                rect(draw, cell, x0, 0.54, x0 + 0.04, 0.60, fill=dark, outline=Outline, width=1)
                ellipse(draw, cell, x0 - 0.02, 0.50, x0 + 0.06, 0.58, fill=win, outline=accent, width=1)
        glow(
            img,
            lambda d: ellipse(d, cell, 0.14, 0.46, 0.86, 0.72, fill=(255, 206, 130, 46)),
            blur=6.0,
        )
    elif kind == "memory_fountain":
        ellipse(draw, cell, 0.16, 0.62, 0.84, 0.86, fill=dark, outline=Outline, width=2)
        ellipse(draw, cell, 0.22, 0.64, 0.78, 0.78, fill=light)
        rect(draw, cell, 0.32, 0.70, 0.68, 0.94, fill=dark, outline=Outline, width=2)
        line(draw, cell, [(0.50, 0.66), (0.50, 0.30)], accent, 3)
        for i in range(4):
            ellipse(draw, cell, 0.38 + i * 0.06, 0.28 - i * 0.02, 0.44 + i * 0.06, 0.34 - i * 0.02, fill=accent)
    elif kind == "statue":
        # A weathered memorial: stepped plinth, robed guardian with a bowed
        # hood, a sword planted point-down, and moss in the cracks.
        moss = (78, 96, 58)
        chip = mix(light, dark, 0.55)
        # Two-tier plinth.
        rect(draw, cell, 0.22, 0.84, 0.78, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.28, 0.78, 0.72, 0.86, fill=chip, outline=Outline, width=2)
        rect(draw, cell, 0.30, 0.845, 0.70, 0.855, fill=mix(dark, light, 0.35))
        # Robe body, widest at the hem.
        poly(
            draw,
            cell,
            [(0.37, 0.42), (0.50, 0.38), (0.63, 0.42), (0.69, 0.80), (0.31, 0.80)],
            fill=light,
            outline=Outline,
            width=3,
        )
        poly(draw, cell, [(0.44, 0.44), (0.56, 0.44), (0.60, 0.78), (0.40, 0.78)], fill=mix(light, dark, 0.22))
        # Shoulder mantle.
        poly(draw, cell, [(0.34, 0.43), (0.50, 0.37), (0.66, 0.43), (0.62, 0.52), (0.38, 0.52)], fill=chip, outline=Outline, width=2)
        line(draw, cell, [(0.34, 0.445), (0.66, 0.445)], mix(light, (255, 255, 255), 0.3), 1)
        # Sword: hilt at the chest, blade down through the robe.
        rect(draw, cell, 0.41, 0.50, 0.59, 0.515, fill=dark, outline=Outline, width=1)
        rect(draw, cell, 0.485, 0.455, 0.515, 0.505, fill=dark)
        poly(draw, cell, [(0.475, 0.515), (0.525, 0.515), (0.515, 0.80), (0.485, 0.80)], fill=(214, 222, 232), outline=Outline, width=1)
        # Bowed hood and shadowed face.
        poly(draw, cell, [(0.38, 0.36), (0.50, 0.16), (0.62, 0.36), (0.56, 0.42), (0.44, 0.42)], fill=chip, outline=Outline, width=3)
        ellipse(draw, cell, 0.44, 0.275, 0.56, 0.375, fill=(26, 26, 34), outline=Outline, width=1)
        # Weathering: hairline cracks, a chipped corner and moss at the base.
        line(draw, cell, [(0.60, 0.47), (0.64, 0.60), (0.61, 0.70)], mix(chip, Outline, 0.35), 1)
        line(draw, cell, [(0.40, 0.58), (0.37, 0.66)], mix(chip, Outline, 0.35), 1)
        poly(draw, cell, [(0.72, 0.78), (0.78, 0.78), (0.78, 0.82)], fill=dark)
        ellipse(draw, cell, 0.26, 0.80, 0.36, 0.87, fill=moss)
        ellipse(draw, cell, 0.64, 0.82, 0.74, 0.88, fill=moss)
        ellipse(draw, cell, 0.46, 0.84, 0.56, 0.90, fill=mix(moss, (60, 90, 50), 0.5))
    elif kind == "crystal_cluster":
        for i, (x, h) in enumerate(((0.34, 0.62), (0.50, 0.80), (0.66, 0.52))):
            poly(draw, cell, [(x, 0.90 - h), (x + 0.10, 0.90 - h * 0.55), (x + 0.05, 0.92), (x - 0.07, 0.92), (x - 0.11, 0.90 - h * 0.62)],
                 fill=light if i == 1 else dark, outline=Outline, width=2)
            line(draw, cell, [(x + 0.01, 0.92 - h * 0.7), (x + 0.01, 0.88)], accent, 1)
    elif kind == "ancient_tree":
        # A gnarled, leaning tree: split trunk, root flare, layered canopy and
        # a few glowing spores caught in the branches.
        bark_hi = mix(light, (190, 170, 120), 0.45)
        # Canopy sits behind the trunk so the silhouette reads as one tree.
        ellipse(draw, cell, 0.10, 0.06, 0.62, 0.46, fill=dark, outline=Outline, width=3)
        ellipse(draw, cell, 0.38, 0.02, 0.92, 0.42, fill=dark, outline=Outline, width=3)
        ellipse(draw, cell, 0.20, 0.12, 0.80, 0.44, fill=light, outline=Outline, width=2)
        ellipse(draw, cell, 0.30, 0.10, 0.68, 0.34, fill=mix(light, accent, 0.35))
        ellipse(draw, cell, 0.24, 0.16, 0.44, 0.32, fill=mix(light, accent, 0.2))
        # Root flare and a leaning, forked trunk.
        poly(draw, cell, [(0.34, 0.90), (0.66, 0.90), (0.60, 0.60), (0.52, 0.42), (0.44, 0.60)], fill=dark, outline=Outline, width=2)
        poly(draw, cell, [(0.44, 0.88), (0.38, 0.90), (0.44, 0.80)], fill=dark, outline=Outline, width=1)
        poly(draw, cell, [(0.56, 0.88), (0.64, 0.90), (0.56, 0.80)], fill=dark, outline=Outline, width=1)
        line(draw, cell, [(0.50, 0.86), (0.52, 0.62), (0.48, 0.46)], bark_hi, 2)
        line(draw, cell, [(0.53, 0.58), (0.72, 0.40)], bark_hi, 2)
        line(draw, cell, [(0.47, 0.56), (0.30, 0.36)], bark_hi, 2)
        # Spores drifting from the canopy.
        for sx, sy in ((0.66, 0.30), (0.74, 0.44), (0.34, 0.42), (0.24, 0.50)):
            ellipse(draw, cell, sx - 0.02, sy - 0.02, sx + 0.02, sy + 0.02, fill=accent)
    elif kind == "ruins_door":
        rect(draw, cell, 0.16, 0.16, 0.84, 0.94, fill=dark, outline=Outline, width=3, radius=0.28)
        rect(draw, cell, 0.24, 0.26, 0.76, 0.94, fill=light, outline=Outline, width=2, radius=0.22)
        ellipse(draw, cell, 0.44, 0.42, 0.56, 0.54, fill=accent, outline=Outline, width=1)
        line(draw, cell, [(0.50, 0.46), (0.50, 0.56)], dark, 1)
    elif kind == "sanctuary_altar":
        # A tiered stone altar holding a floating gold memory core.
        stone = mix(light, dark, 0.35)
        rect(draw, cell, 0.16, 0.80, 0.84, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.22, 0.70, 0.78, 0.82, fill=stone, outline=Outline, width=2)
        rect(draw, cell, 0.28, 0.52, 0.72, 0.72, fill=light, outline=Outline, width=3)
        rect(draw, cell, 0.28, 0.52, 0.72, 0.56, fill=mix(light, (255, 255, 255), 0.45))
        # Carved rune band on the altar face.
        for i in range(3):
            rect(draw, cell, 0.36 + i * 0.11, 0.60, 0.42 + i * 0.11, 0.66, fill=dark)
        # Candles at the corners.
        for x in (0.24, 0.70):
            rect(draw, cell, x, 0.46, x + 0.06, 0.52, fill=(236, 226, 200), outline=Outline, width=1)
            ellipse(draw, cell, x + 0.01, 0.41, x + 0.05, 0.46, fill=(255, 214, 130))
        # Memory core, floating over the slab with a shaft of light.
        ellipse(draw, cell, 0.40, 0.16, 0.60, 0.36, fill=(255, 234, 160, 55))
        ellipse(draw, cell, 0.43, 0.19, 0.57, 0.33, fill=accent, outline=Outline, width=2)
        ellipse(draw, cell, 0.465, 0.225, 0.505, 0.265, fill=(255, 255, 255))
        poly(draw, cell, [(0.44, 0.34), (0.56, 0.34), (0.62, 0.52), (0.38, 0.52)], fill=(255, 234, 160, 26))
    elif kind == "void_rift":
        poly(draw, cell, [(0.46, 0.10), (0.64, 0.35), (0.56, 0.55), (0.70, 0.84), (0.50, 0.70), (0.40, 0.92), (0.32, 0.60), (0.38, 0.34)],
             fill=dark, outline=accent, width=2)
        ellipse(draw, cell, 0.42, 0.34, 0.56, 0.54, fill=accent)
    elif kind == "memory_chest":
        rect(draw, cell, 0.20, 0.48, 0.80, 0.88, fill=dark, outline=Outline, width=3, radius=0.04)
        rect(draw, cell, 0.20, 0.38, 0.80, 0.56, fill=light, outline=Outline, width=3, radius=0.10)
        rect(draw, cell, 0.46, 0.48, 0.54, 0.62, fill=accent, outline=Outline, width=1)
        rect(draw, cell, 0.20, 0.57, 0.80, 0.61, fill=accent)
    elif kind == "barrel":
        ellipse(draw, cell, 0.24, 0.30, 0.76, 0.92, fill=dark, outline=Outline, width=3)
        for y in (0.42, 0.62, 0.82):
            rect(draw, cell, 0.22, y, 0.78, y + 0.05, fill=light, outline=Outline, width=1)
        rect(draw, cell, 0.40, 0.36, 0.60, 0.44, fill=accent, outline=Outline, width=1)
    elif kind == "shrine":
        # A small wayside shrine: stepped base, gabled stone hood and a memory
        # flame burning in the alcove, so shrines never read as fountains.
        stone = mix(light, dark, 0.30)
        rect(draw, cell, 0.20, 0.84, 0.80, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.26, 0.78, 0.74, 0.86, fill=stone, outline=Outline, width=2)
        # Pillars and the dark alcove between them.
        rect(draw, cell, 0.30, 0.44, 0.40, 0.80, fill=light, outline=Outline, width=2)
        rect(draw, cell, 0.60, 0.44, 0.70, 0.80, fill=light, outline=Outline, width=2)
        rect(draw, cell, 0.40, 0.44, 0.60, 0.80, fill=(20, 18, 26), outline=Outline, width=2)
        line(draw, cell, [(0.33, 0.46), (0.33, 0.79)], mix(light, (255, 255, 255), 0.28), 1)
        line(draw, cell, [(0.63, 0.46), (0.63, 0.79)], mix(light, (255, 255, 255), 0.28), 1)
        # Gabled hood with a carved keystone.
        poly(draw, cell, [(0.18, 0.46), (0.50, 0.16), (0.82, 0.46)], fill=stone, outline=Outline, width=3)
        poly(draw, cell, [(0.26, 0.44), (0.50, 0.21), (0.74, 0.44)], fill=mix(stone, light, 0.35))
        rect(draw, cell, 0.455, 0.28, 0.545, 0.35, fill=dark, outline=Outline, width=1)
        # Memory flame in the alcove, with its halo.
        ellipse(draw, cell, 0.42, 0.50, 0.58, 0.74, fill=(255, 214, 130, 60))
        poly(draw, cell, [(0.50, 0.50), (0.565, 0.60), (0.545, 0.72), (0.50, 0.78), (0.455, 0.72), (0.435, 0.60)],
             fill=accent, outline=Outline, width=1)
        poly(draw, cell, [(0.50, 0.55), (0.535, 0.63), (0.52, 0.72), (0.50, 0.75), (0.48, 0.72), (0.465, 0.63)],
             fill=(255, 250, 220))
        # Offerings stacked at the foot.
        ellipse(draw, cell, 0.30, 0.86, 0.38, 0.92, fill=accent)
        ellipse(draw, cell, 0.62, 0.86, 0.70, 0.92, fill=accent)
    elif kind == "lever":
        # A floor lever: iron base plate, pivot housing and a brass handle.
        rect(draw, cell, 0.24, 0.74, 0.76, 0.94, fill=dark, outline=Outline, width=3, radius=0.04)
        rect(draw, cell, 0.30, 0.78, 0.70, 0.82, fill=light, outline=Outline, width=1)
        for x in (0.30, 0.70):
            ellipse(draw, cell, x - 0.022, 0.88, x + 0.022, 0.924, fill=light)
        ellipse(draw, cell, 0.40, 0.62, 0.60, 0.80, fill=mix(light, dark, 0.35), outline=Outline, width=2)
        # Handle canted to the right, read as "ready".
        line(draw, cell, [(0.50, 0.70), (0.64, 0.40)], Outline, 8)
        line(draw, cell, [(0.50, 0.70), (0.64, 0.40)], light, 4)
        ellipse(draw, cell, 0.60, 0.30, 0.72, 0.42, fill=accent, outline=Outline, width=2)
        ellipse(draw, cell, 0.635, 0.335, 0.665, 0.365, fill=(255, 252, 226))
        ellipse(draw, cell, 0.44, 0.66, 0.56, 0.78, fill=mix(light, (255, 255, 255), 0.2), outline=Outline, width=1)
    elif kind == "bone_pile":
        # A readable pile at 60 px: crossed femurs behind a skull with sockets,
        # a jaw, and two rib arcs curving out of the heap.
        rect(draw, cell, 0.14, 0.86, 0.86, 0.94, fill=(0, 0, 0, 70))
        # Crossed femurs behind the skull.
        line(draw, cell, [(0.20, 0.88), (0.78, 0.62)], light, 6)
        line(draw, cell, [(0.22, 0.64), (0.80, 0.88)], light, 6)
        for x, y in ((0.19, 0.87), (0.76, 0.61), (0.21, 0.63), (0.79, 0.87)):
            ellipse(draw, cell, x - 0.035, y - 0.035, x + 0.035, y + 0.035, fill=light, outline=Outline, width=1)
        # Rib arcs.
        for i, (x0, y0, x1) in enumerate(((0.30, 0.70, 0.56), (0.34, 0.78, 0.62))):
            line(draw, cell, [(x0, y0), (0.46, y0 - 0.05 - i * 0.02), (x1, y0 + 0.01)], light, 3)
        # Skull: cranium, brow, sockets, nose and teeth.
        ellipse(draw, cell, 0.32, 0.26, 0.68, 0.62, fill=light, outline=Outline, width=3)
        poly(draw, cell, [(0.35, 0.50), (0.65, 0.50), (0.60, 0.66), (0.40, 0.66)], fill=light, outline=Outline, width=2)
        ellipse(draw, cell, 0.375, 0.375, 0.465, 0.475, fill=dark)
        ellipse(draw, cell, 0.535, 0.375, 0.625, 0.475, fill=dark)
        poly(draw, cell, [(0.48, 0.47), (0.52, 0.47), (0.50, 0.53)], fill=dark)
        for i in range(4):
            rect(draw, cell, 0.425 + i * 0.04, 0.575, 0.45 + i * 0.04, 0.645, fill=dark)
        line(draw, cell, [(0.36, 0.33), (0.44, 0.30)], mix(light, (255, 255, 255), 0.4), 2)
    elif kind == "hive_comb":
        # A honeycomb cluster: hexagonal wax cells, one burst cell glowing, and
        # drips running off the bottom edge.
        def hexagon(cx: float, cy: float, r: float) -> list[tuple[float, float]]:
            return [
                (cx + math.cos(math.pi / 3 * i - math.pi / 6) * r,
                 cy + math.sin(math.pi / 3 * i - math.pi / 6) * r)
                for i in range(6)
            ]

        wax = mix(dark, light, 0.45)
        poly(draw, cell, hexagon(0.33, 0.30, 0.15), fill=wax, outline=Outline, width=2)
        poly(draw, cell, hexagon(0.33, 0.30, 0.09), fill=mix(light, accent, 0.35))
        poly(draw, cell, hexagon(0.67, 0.30, 0.15), fill=wax, outline=Outline, width=2)
        poly(draw, cell, hexagon(0.67, 0.30, 0.09), fill=mix(light, accent, 0.35))
        poly(draw, cell, hexagon(0.50, 0.56, 0.15), fill=wax, outline=Outline, width=2)
        poly(draw, cell, hexagon(0.50, 0.56, 0.10), fill=(255, 220, 130))
        poly(draw, cell, hexagon(0.50, 0.56, 0.045), fill=(255, 255, 210))
        poly(draw, cell, hexagon(0.28, 0.76, 0.13), fill=wax, outline=Outline, width=2)
        poly(draw, cell, hexagon(0.72, 0.76, 0.13), fill=wax, outline=Outline, width=2)
        # Honey drips.
        line(draw, cell, [(0.42, 0.70), (0.42, 0.86)], mix(accent, (255, 255, 255), 0.3), 3)
        ellipse(draw, cell, 0.40, 0.85, 0.44, 0.90, fill=mix(accent, (255, 255, 255), 0.3))
        line(draw, cell, [(0.60, 0.68), (0.60, 0.80)], mix(accent, (255, 255, 255), 0.3), 3)
        ellipse(draw, cell, 0.58, 0.79, 0.62, 0.84, fill=mix(accent, (255, 255, 255), 0.3))
    elif kind == "cog_pillar":
        # A riveted foundry column crowned by a turning gear, with pipe elbows.
        steel = mix(light, dark, 0.25)
        rect(draw, cell, 0.22, 0.86, 0.78, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.33, 0.40, 0.67, 0.88, fill=steel, outline=Outline, width=3)
        for y in (0.50, 0.62, 0.74, 0.84):
            rect(draw, cell, 0.33, y, 0.67, y + 0.035, fill=dark, outline=Outline, width=1)
        for x, y in ((0.37, 0.46), (0.63, 0.46), (0.37, 0.80), (0.63, 0.80)):
            ellipse(draw, cell, x - 0.022, y - 0.022, x + 0.022, y + 0.022, fill=light)
        # Crown gear: rim, teeth and hub.
        rim = 0.21
        for i in range(10):
            a = i * math.tau / 10
            tx, ty = 0.50 + math.cos(a) * rim, 0.26 + math.sin(a) * rim
            poly(draw, cell, [(tx - 0.045, ty - 0.045), (tx + 0.045, ty - 0.045), (tx + 0.045, ty + 0.045), (tx - 0.045, ty + 0.045)],
                 fill=steel, outline=Outline, width=1)
        ellipse(draw, cell, 0.50 - rim, 0.26 - rim, 0.50 + rim, 0.26 + rim, fill=steel, outline=Outline, width=2)
        ellipse(draw, cell, 0.50 - rim * 0.55, 0.26 - rim * 0.55, 0.50 + rim * 0.55, 0.26 + rim * 0.55, fill=dark, outline=Outline, width=1)
        ellipse(draw, cell, 0.46, 0.22, 0.54, 0.30, fill=accent, outline=Outline, width=1)
        # Steam pipe along the side.
        line(draw, cell, [(0.71, 0.60), (0.80, 0.60), (0.80, 0.44)], mix(light, dark, 0.5), 4)
    elif kind == "ice_spire":
        # A cluster of faceted shards rising from a frozen shelf.
        shelf = mix(dark, light, 0.4)
        shards = ((0.50, 0.10, 0.15, 0.82), (0.28, 0.40, 0.11, 0.84), (0.72, 0.36, 0.10, 0.84), (0.60, 0.52, 0.08, 0.86))
        for cx, top, half, base in shards:
            poly(draw, cell, [(cx, top), (cx + half, top + (base - top) * 0.62), (cx + half * 0.55, base), (cx - half * 0.55, base), (cx - half, top + (base - top) * 0.62)],
                 fill=light, outline=Outline, width=2)
            poly(draw, cell, [(cx, top + 0.02), (cx + half * 0.42, base - 0.05), (cx, base - 0.03), (cx - half * 0.42, base - 0.05)],
                 fill=mix(light, accent, 0.45))
        poly(draw, cell, [(0.50, 0.16), (0.555, 0.46), (0.50, 0.74), (0.445, 0.46)], fill=accent)
        ellipse(draw, cell, 0.44, 0.34, 0.56, 0.50, fill=(210, 245, 255, 80))
        # Frozen shelf in front, so the shards are planted rather than floating.
        poly(draw, cell, [(0.10, 0.82), (0.90, 0.82), (0.80, 0.94), (0.20, 0.94)], fill=shelf, outline=Outline, width=2)
        poly(draw, cell, [(0.16, 0.845), (0.84, 0.845), (0.78, 0.905), (0.22, 0.905)], fill=mix(shelf, (230, 250, 255), 0.22))
        for x in (0.26, 0.50, 0.74):
            ellipse(draw, cell, x - 0.03, 0.905, x + 0.03, 0.935, fill=(232, 250, 255, 210))
    elif kind == "coral":
        # Branching abyss coral: a thick trunk, two fans and polyp tips.
        rock = mix(dark, light, 0.15)
        ellipse(draw, cell, 0.18, 0.86, 0.82, 0.98, fill=rock, outline=Outline, width=2)
        line(draw, cell, [(0.50, 0.94), (0.48, 0.62), (0.44, 0.40)], dark, 9)
        line(draw, cell, [(0.48, 0.66), (0.30, 0.50), (0.24, 0.30)], dark, 6)
        line(draw, cell, [(0.49, 0.60), (0.70, 0.48), (0.78, 0.28)], dark, 6)
        line(draw, cell, [(0.44, 0.44), (0.36, 0.22)], dark, 4)
        line(draw, cell, [(0.50, 0.94), (0.48, 0.62), (0.44, 0.40)], light, 5)
        line(draw, cell, [(0.48, 0.66), (0.30, 0.50), (0.24, 0.30)], light, 3)
        line(draw, cell, [(0.49, 0.60), (0.70, 0.48), (0.78, 0.28)], light, 3)
        line(draw, cell, [(0.44, 0.44), (0.36, 0.22)], light, 2)
        for x, y in ((0.24, 0.28), (0.78, 0.26), (0.36, 0.20), (0.44, 0.38)):
            ellipse(draw, cell, x - 0.035, y - 0.035, x + 0.035, y + 0.035, fill=accent, outline=Outline, width=1)
        # Fan ribs between the branches.
        for i in range(3):
            line(draw, cell, [(0.50, 0.58), (0.62 + i * 0.03, 0.40 - i * 0.06)], mix(light, accent, 0.4), 2)
    elif kind == "furn_table":
        rect(draw, cell, 0.14, 0.44, 0.86, 0.56, fill=light, outline=Outline, width=2, radius=0.03)
        for x in (0.22, 0.78):
            line(draw, cell, [(x, 0.56), (x, 0.94)], dark, 4)
        rect(draw, cell, 0.22, 0.34, 0.44, 0.42, fill=accent, outline=Outline, width=1)
        rect(draw, cell, 0.56, 0.36, 0.74, 0.42, fill=(240, 232, 204), outline=Outline, width=1)
        line(draw, cell, [(0.63, 0.30), (0.63, 0.36)], accent, 2)
    elif kind == "furn_chair":
        rect(draw, cell, 0.32, 0.24, 0.68, 0.48, fill=dark, outline=Outline, width=2, radius=0.03)
        rect(draw, cell, 0.28, 0.46, 0.72, 0.58, fill=light, outline=Outline, width=2, radius=0.03)
        for x in (0.32, 0.68):
            line(draw, cell, [(x, 0.58), (x, 0.92)], dark, 3)
    elif kind == "furn_shelf":
        rect(draw, cell, 0.18, 0.16, 0.82, 0.94, fill=dark, outline=Outline, width=3, radius=0.02)
        for y in (0.34, 0.54, 0.74):
            rect(draw, cell, 0.20, y, 0.80, y + 0.04, fill=light)
        for i, x in enumerate((0.24, 0.36, 0.52, 0.66)):
            rect(draw, cell, x, 0.22, x + 0.08, 0.34, fill=accent if i % 2 else (210, 190, 160), outline=Outline, width=1)
            rect(draw, cell, x, 0.42, x + 0.07, 0.54, fill=(190, 220, 180) if i % 2 else accent, outline=Outline, width=1)
        rect(draw, cell, 0.28, 0.62, 0.54, 0.74, fill=(230, 220, 190), outline=Outline, width=1)
    elif kind == "furn_crate":
        rect(draw, cell, 0.20, 0.34, 0.80, 0.92, fill=light, outline=Outline, width=3, radius=0.02)
        line(draw, cell, [(0.20, 0.34), (0.80, 0.92)], dark, 2)
        line(draw, cell, [(0.80, 0.34), (0.20, 0.92)], dark, 2)
        rect(draw, cell, 0.20, 0.58, 0.80, 0.63, fill=accent)
    elif kind == "furn_planter":
        poly(draw, cell, [(0.28, 0.58), (0.72, 0.58), (0.64, 0.94), (0.36, 0.94)], fill=dark, outline=Outline, width=2)
        for sign, x in ((-1, 0.34), (1, 0.66), (-1, 0.44), (1, 0.56)):
            line(draw, cell, [(0.50, 0.58), (x, 0.30 + abs(x - 0.5) * 0.4)], light, 3)
            ellipse(draw, cell, x - 0.07, 0.24 + abs(x - 0.5) * 0.3, x + 0.07, 0.38 + abs(x - 0.5) * 0.3, fill=accent, outline=Outline, width=1)
    elif kind == "furn_dais":
        ellipse(draw, cell, 0.02, 0.06, 0.98, 0.94, fill=dark, outline=Outline, width=2)
        ellipse(draw, cell, 0.07, 0.11, 0.93, 0.89, fill=light, outline=Outline, width=1)
        ellipse(draw, cell, 0.14, 0.18, 0.86, 0.82, fill=dark, outline=accent, width=2)
        ellipse(draw, cell, 0.20, 0.24, 0.80, 0.76, outline=light, width=1)
        for i in range(8):
            a = i * math.tau / 8
            x = 0.50 + math.cos(a) * 0.40
            y = 0.50 + math.sin(a) * 0.40
            rect(draw, cell, x - 0.012, y - 0.012, x + 0.012, y + 0.012, fill=accent)
    elif kind == "furn_column":
        rect(draw, cell, 0.26, 0.88, 0.74, 0.96, fill=light, outline=Outline, width=2)
        rect(draw, cell, 0.32, 0.82, 0.68, 0.90, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.36, 0.16, 0.64, 0.84, fill=light, outline=Outline, width=2)
        for x in (0.42, 0.50, 0.58):
            line(draw, cell, [(x, 0.20), (x, 0.80)], dark, 1)
        rect(draw, cell, 0.28, 0.10, 0.72, 0.18, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.30, 0.18, 0.70, 0.21, fill=accent)
        rect(draw, cell, 0.34, 0.44, 0.66, 0.48, fill=accent)
    elif kind == "furn_rug":
        # A round woven carpet with fringe, not a framed square picture.
        ellipse(draw, cell, 0.04, 0.08, 0.96, 0.92, fill=dark, outline=Outline, width=1)
        ellipse(draw, cell, 0.10, 0.15, 0.90, 0.85, outline=accent, width=2)
        ellipse(draw, cell, 0.16, 0.21, 0.84, 0.79, outline=light, width=1)
        for i in range(8):
            a = i * math.tau / 8
            x0 = 0.50 + math.cos(a) * 0.13
            y0 = 0.50 + math.sin(a) * 0.13
            x1 = 0.50 + math.cos(a) * 0.25
            y1 = 0.50 + math.sin(a) * 0.25
            poly(draw, cell, [(x0, y0), (x1, y1), (0.50 + math.cos(a + 0.5) * 0.14, 0.50 + math.sin(a + 0.5) * 0.14)], fill=accent)
        ellipse(draw, cell, 0.42, 0.42, 0.58, 0.58, fill=accent, outline=Outline, width=1)
        for i in range(16):
            a = i * math.tau / 16
            x = 0.50 + math.cos(a) * 0.45
            y = 0.50 + math.sin(a) * 0.45
            line(draw, cell, [(x, y), (0.50 + math.cos(a) * 0.50, 0.50 + math.sin(a) * 0.50)], light, 1)
    elif kind == "furn_banner":
        # Standing banner: pole, crossbar and hanging cloth.
        rect(draw, cell, 0.46, 0.14, 0.54, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.36, 0.90, 0.64, 0.96, fill=dark, outline=Outline, width=2)
        line(draw, cell, [(0.24, 0.16), (0.76, 0.16)], accent, 3)
        poly(draw, cell, [(0.26, 0.18), (0.74, 0.18), (0.72, 0.74), (0.50, 0.86), (0.28, 0.74)],
             fill=light, outline=Outline, width=2)
        poly(draw, cell, [(0.34, 0.25), (0.66, 0.25), (0.64, 0.68), (0.50, 0.78), (0.36, 0.68)],
             outline=accent, width=1)
        ellipse(draw, cell, 0.43, 0.38, 0.57, 0.52, fill=dark, outline=accent, width=2)
        line(draw, cell, [(0.30, 0.18), (0.32, 0.28)], accent, 2)
        line(draw, cell, [(0.70, 0.18), (0.68, 0.28)], accent, 2)
    elif kind == "furn_bench":
        rect(draw, cell, 0.10, 0.44, 0.90, 0.56, fill=light, outline=Outline, width=3, radius=0.03)
        for x in (0.18, 0.38, 0.62, 0.82):
            line(draw, cell, [(x, 0.56), (x, 0.94)], dark, 3)
        rect(draw, cell, 0.12, 0.30, 0.88, 0.38, fill=dark, outline=Outline, width=2)
        for x in (0.22, 0.50, 0.78):
            rect(draw, cell, x - 0.03, 0.32, x + 0.03, 0.36, fill=accent)
    elif kind == "furn_lantern":
        line(draw, cell, [(0.50, 0.94), (0.50, 0.42)], dark, 4)
        poly(draw, cell, [(0.34, 0.42), (0.66, 0.42), (0.60, 0.16), (0.40, 0.16)], fill=accent, outline=Outline, width=2)
        rect(draw, cell, 0.42, 0.22, 0.58, 0.38, fill=(255, 244, 200))
        ellipse(draw, cell, 0.30, 0.08, 0.70, 0.48, fill=(255, 220, 140, 60))
        rect(draw, cell, 0.34, 0.92, 0.66, 0.98, fill=dark)
    elif kind == "cairn_stack":
        # Four weathered stones balanced into a cairn, with a lit rune slot.
        ellipse(draw, cell, 0.12, 0.84, 0.88, 0.98, fill=Shadow)
        for (x0, y0, x1, y1) in ((0.20, 0.70, 0.80, 0.86), (0.28, 0.56, 0.72, 0.72), (0.36, 0.44, 0.64, 0.58), (0.42, 0.34, 0.58, 0.46)):
            ellipse(draw, cell, x0, y0, x1, y1, fill=light, outline=Outline, width=2)
            ellipse(draw, cell, x0 + 0.05, y0 + 0.02, x0 + 0.16, y0 + 0.06, fill=(255, 255, 255, 55))
        rect(draw, cell, 0.455, 0.50, 0.545, 0.545, fill=accent, outline=Outline, width=1)
        glow(draw._image, lambda d: ellipse(d, cell, 0.34, 0.30, 0.66, 0.60, fill=(255, 190, 110, 60)), blur=4.0)
    elif kind == "furn_desk":
        # A writing desk with an open ledger and a quill.
        rect(draw, cell, 0.10, 0.46, 0.90, 0.60, fill=light, outline=Outline, width=2, radius=0.02)
        for x in (0.16, 0.84):
            rect(draw, cell, x - 0.04, 0.60, x + 0.04, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.26, 0.34, 0.62, 0.48, fill=accent, outline=Outline, width=1)
        line(draw, cell, [(0.44, 0.34), (0.44, 0.48)], Outline, 1)
        for i in range(3):
            line(draw, cell, [(0.28, 0.39 + i * 0.03), (0.42, 0.39 + i * 0.03)], dark, 1)
        line(draw, cell, [(0.68, 0.36), (0.76, 0.20)], (240, 236, 220), 2)
        rect(draw, cell, 0.74, 0.30, 0.80, 0.38, fill=dark, outline=Outline, width=1)
    elif kind == "furn_cauldron":
        # An iron pot on three legs, with a slow green light inside.
        ellipse(draw, cell, 0.18, 0.42, 0.82, 0.62, fill=dark, outline=Outline, width=3)
        poly(draw, cell, [(0.16, 0.50), (0.84, 0.50), (0.74, 0.88), (0.26, 0.88)], fill=light, outline=Outline, width=3)
        ellipse(draw, cell, 0.22, 0.44, 0.78, 0.58, fill=accent, outline=Outline, width=1)
        for x in (0.30, 0.50, 0.70):
            line(draw, cell, [(x, 0.88), (x + 0.02, 0.96)], dark, 3)
        glow(draw._image, lambda d: ellipse(d, cell, 0.24, 0.34, 0.76, 0.62, fill=(120, 240, 160, 55)), blur=5.0)
    elif kind == "furn_strings":
        # A string of small lamps strung along the back wall.
        line(draw, cell, [(0.02, 0.26), (0.98, 0.34)], dark, 2)
        for i in range(5):
            x = 0.10 + i * 0.20
            y = 0.26 + i * 0.016
            line(draw, cell, [(x, y), (x, y + 0.10)], dark, 1)
            ellipse(draw, cell, x - 0.05, y + 0.10, x + 0.05, y + 0.22, fill=accent, outline=Outline, width=1)
            ellipse(draw, cell, x - 0.12, y + 0.04, x + 0.12, y + 0.28, fill=(255, 220, 140, 40))
    elif kind == "furn_books":
        # A leaning stack of tomes with a ribbon marker.
        for i, (x0, y0, w) in enumerate(((0.24, 0.74, 0.50), (0.28, 0.62, 0.46), (0.22, 0.50, 0.52))):
            rect(draw, cell, x0, y0, x0 + w, y0 + 0.11, fill=(light if i % 2 else accent), outline=Outline, width=2)
            rect(draw, cell, x0, y0 + 0.015, x0 + 0.05, y0 + 0.095, fill=dark)
        line(draw, cell, [(0.62, 0.50), (0.62, 0.38), (0.68, 0.34)], accent, 2)
        ellipse(draw, cell, 0.18, 0.86, 0.82, 0.96, fill=(0, 0, 0, 70))
    elif kind == "furn_candle":
        rect(draw, cell, 0.40, 0.86, 0.60, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.44, 0.48, 0.56, 0.88, fill=light, outline=Outline, width=2)
        line(draw, cell, [(0.50, 0.48), (0.50, 0.40)], dark, 2)
        ellipse(draw, cell, 0.44, 0.28, 0.56, 0.42, fill=accent, outline=Outline, width=1)
        ellipse(draw, cell, 0.33, 0.16, 0.67, 0.50, fill=(255, 220, 140, 55))
    elif kind == "furn_anvil":
        rect(draw, cell, 0.30, 0.82, 0.70, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.40, 0.64, 0.60, 0.84, fill=dark, outline=Outline, width=2)
        poly(draw, cell, [(0.18, 0.52), (0.82, 0.52), (0.72, 0.66), (0.28, 0.66)], fill=light, outline=Outline, width=2)
        poly(draw, cell, [(0.16, 0.52), (0.10, 0.56), (0.18, 0.60)], fill=light, outline=Outline, width=1)
        rect(draw, cell, 0.36, 0.46, 0.56, 0.52, fill=accent)
        for i in range(3):
            line(draw, cell, [(0.58 + i * 0.06, 0.50), (0.62 + i * 0.06, 0.40)], (255, 190, 120, 120), 2)
    elif kind == "furn_weapon_rack":
        rect(draw, cell, 0.20, 0.30, 0.28, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.72, 0.30, 0.80, 0.94, fill=dark, outline=Outline, width=2)
        rect(draw, cell, 0.20, 0.42, 0.80, 0.48, fill=light, outline=Outline, width=2)
        for x in (0.34, 0.50, 0.66):
            line(draw, cell, [(x, 0.18), (x, 0.86)], light, 3)
            poly(draw, cell, [(x - 0.03, 0.22), (x, 0.12), (x + 0.03, 0.22)], fill=accent, outline=Outline, width=1)
            line(draw, cell, [(x - 0.05, 0.40), (x + 0.05, 0.40)], accent, 2)
    elif kind == "furn_stool":
        ellipse(draw, cell, 0.28, 0.36, 0.72, 0.58, fill=light, outline=Outline, width=2)
        ellipse(draw, cell, 0.34, 0.40, 0.66, 0.54, fill=accent, outline=Outline, width=1)
        for x in (0.36, 0.64):
            line(draw, cell, [(x, 0.54), (x, 0.88)], dark, 3)
        line(draw, cell, [(0.36, 0.70), (0.64, 0.70)], dark, 2)
    elif kind == "furn_vines":
        for x, drop in ((0.28, 0.86), (0.44, 0.68), (0.60, 0.92), (0.76, 0.74)):
            line(draw, cell, [(x, 0.10), (x + 0.03, drop)], light, 2)
            for t in (0.30, 0.48, 0.66):
                if t > drop:
                    continue
                ellipse(draw, cell, x - 0.05, t, x + 0.06, t + 0.07, fill=accent, outline=Outline, width=1)
    elif kind == "furn_brazier":
        line(draw, cell, [(0.40, 0.92), (0.46, 0.60)], dark, 4)
        line(draw, cell, [(0.60, 0.92), (0.54, 0.60)], dark, 4)
        poly(draw, cell, [(0.24, 0.56), (0.76, 0.56), (0.66, 0.74), (0.34, 0.74)], fill=dark, outline=Outline, width=2)
        for x, h in ((0.38, 0.26), (0.50, 0.36), (0.62, 0.24)):
            poly(draw, cell, [(x - 0.05, 0.58), (x, 0.58 - h), (x + 0.05, 0.58)], fill=accent, outline=Outline, width=1)
        ellipse(draw, cell, 0.22, 0.30, 0.78, 0.72, fill=(255, 170, 90, 45))
    elif kind == "furn_herbs":
        line(draw, cell, [(0.16, 0.18), (0.84, 0.18)], dark, 3)
        for x, drop in ((0.28, 0.70), (0.42, 0.62), (0.56, 0.74), (0.70, 0.64)):
            line(draw, cell, [(x, 0.18), (x, drop)], light, 2)
            for t in (0.30, 0.44, 0.58):
                if t > drop:
                    continue
                ellipse(draw, cell, x - 0.045, t, x + 0.045, t + 0.08, fill=accent, outline=Outline, width=1)
    elif kind == "station_hearth":
        ellipse(draw, cell, 0.18, 0.62, 0.82, 0.96, fill=dark, outline=Outline, width=3)
        ellipse(draw, cell, 0.24, 0.56, 0.76, 0.76, fill=light, outline=Outline, width=2)
        ellipse(draw, cell, 0.34, 0.60, 0.66, 0.74, fill=accent)
        for x, h in ((0.40, 0.20), (0.50, 0.28), (0.60, 0.18)):
            poly(draw, cell, [(x - 0.045, 0.60), (x, 0.60 - h), (x + 0.045, 0.60)], fill=accent, outline=Outline, width=1)
        rect(draw, cell, 0.16, 0.90, 0.84, 0.96, fill=light)
    elif kind == "station_armory":
        # Thin posts, a bright shield and three visible weapons; at 60px the old
        # version collapsed into two black slabs.
        rect(draw, cell, 0.18, 0.34, 0.25, 0.94, fill=light, outline=Outline, width=2)
        rect(draw, cell, 0.75, 0.34, 0.82, 0.94, fill=light, outline=Outline, width=2)
        rect(draw, cell, 0.18, 0.34, 0.82, 0.41, fill=accent, outline=Outline, width=1)
        for x in (0.36, 0.50, 0.64):
            line(draw, cell, [(x, 0.22), (x, 0.86)], light, 3)
            poly(draw, cell, [(x - 0.035, 0.24), (x, 0.14), (x + 0.035, 0.24)], fill=accent, outline=Outline, width=1)
            line(draw, cell, [(x - 0.05, 0.46), (x + 0.05, 0.46)], accent, 2)
        ellipse(draw, cell, 0.32, 0.56, 0.68, 0.80, fill=light, outline=accent, width=3)
        line(draw, cell, [(0.50, 0.58), (0.50, 0.78)], accent, 2)
        line(draw, cell, [(0.40, 0.66), (0.60, 0.66)], accent, 2)
    elif kind == "station_infirmary":
        rect(draw, cell, 0.16, 0.48, 0.84, 0.86, fill=dark, outline=Outline, width=3, radius=0.04)
        rect(draw, cell, 0.22, 0.40, 0.48, 0.54, fill=light, outline=Outline, width=2, radius=0.03)
        rect(draw, cell, 0.52, 0.56, 0.78, 0.82, fill=light)
        line(draw, cell, [(0.65, 0.60), (0.65, 0.78)], accent, 2)
        line(draw, cell, [(0.58, 0.69), (0.72, 0.69)], accent, 2)
        for x in (0.22, 0.78):
            line(draw, cell, [(x, 0.86), (x, 0.96)], dark, 3)
    elif kind == "station_wellspring":
        ellipse(draw, cell, 0.16, 0.60, 0.84, 0.96, fill=dark, outline=Outline, width=3)
        ellipse(draw, cell, 0.24, 0.58, 0.76, 0.78, fill=accent)
        ellipse(draw, cell, 0.30, 0.60, 0.70, 0.72, fill=light)
        for x in (0.22, 0.78):
            line(draw, cell, [(x, 0.62), (x, 0.20)], light, 3)
        line(draw, cell, [(0.20, 0.20), (0.80, 0.20)], light, 4)
        line(draw, cell, [(0.50, 0.20), (0.50, 0.44)], accent, 2)
    elif kind == "station_watchtower":
        poly(draw, cell, [(0.34, 0.96), (0.42, 0.30), (0.58, 0.30), (0.66, 0.96)], fill=dark, outline=Outline, width=3)
        for y in (0.48, 0.64, 0.80):
            rect(draw, cell, 0.42, y, 0.58, y + 0.05, light)
        ellipse(draw, cell, 0.38, 0.12, 0.62, 0.32, fill=light, outline=Outline, width=2)
        ellipse(draw, cell, 0.45, 0.17, 0.55, 0.27, fill=accent)
        poly(draw, cell, [(0.30, 0.12), (0.50, 0.02), (0.70, 0.12)], fill=light, outline=Outline, width=1)
    elif kind == "station_bulwark":
        rect(draw, cell, 0.10, 0.44, 0.90, 0.92, fill=dark, outline=Outline, width=3, radius=0.04)
        for y in (0.56, 0.72):
            rect(draw, cell, 0.10, y, 0.90, y + 0.04, light)
        poly(draw, cell, [(0.50, 0.28), (0.74, 0.40), (0.66, 0.70), (0.50, 0.82), (0.34, 0.70), (0.26, 0.40)], fill=light, outline=Outline, width=2)
        line(draw, cell, [(0.50, 0.38), (0.50, 0.72)], accent, 3)
        line(draw, cell, [(0.38, 0.50), (0.62, 0.50)], accent, 3)
    elif kind == "station_vault":
        rect(draw, cell, 0.14, 0.46, 0.86, 0.94, fill=dark, outline=Outline, width=3, radius=0.04)
        rect(draw, cell, 0.14, 0.30, 0.86, 0.54, fill=light, outline=Outline, width=3, radius=0.08)
        for x in (0.26, 0.74):
            rect(draw, cell, x - 0.03, 0.32, x + 0.03, 0.92, fill=accent)
        rect(draw, cell, 0.46, 0.56, 0.54, 0.66, fill=accent, outline=Outline, width=1)
        ellipse(draw, cell, 0.47, 0.58, 0.53, 0.64, fill=dark)
    elif kind == "station_training":
        rect(draw, cell, 0.46, 0.34, 0.54, 0.94, fill=dark, outline=Outline, width=2)
        line(draw, cell, [(0.22, 0.48), (0.78, 0.48)], light, 4)
        line(draw, cell, [(0.22, 0.48), (0.18, 0.62)], light, 3)
        line(draw, cell, [(0.78, 0.48), (0.82, 0.62)], light, 3)
        ellipse(draw, cell, 0.38, 0.18, 0.62, 0.38, fill=light, outline=Outline, width=2)
        ellipse(draw, cell, 0.44, 0.24, 0.56, 0.34, fill=accent)
        for y in (0.52, 0.66):
            line(draw, cell, [(0.36, y), (0.64, y)], accent, 2)
    elif kind == "station_meditation":
        ellipse(draw, cell, 0.18, 0.62, 0.82, 0.90, fill=dark, outline=Outline, width=3)
        ellipse(draw, cell, 0.26, 0.58, 0.74, 0.74, fill=light, outline=Outline, width=2)
        poly(draw, cell, [(0.50, 0.32), (0.62, 0.46), (0.50, 0.60), (0.38, 0.46)], fill=accent, outline=Outline, width=2)
        for x in (0.20, 0.80):
            rect(draw, cell, x - 0.025, 0.30, x + 0.025, 0.64, fill=light)
    elif kind == "station_notice":
        for x in (0.24, 0.76):
            rect(draw, cell, x - 0.03, 0.30, x + 0.03, 0.94, fill=dark)
        rect(draw, cell, 0.10, 0.22, 0.90, 0.68, fill=light, outline=Outline, width=3, radius=0.03)
        rect(draw, cell, 0.18, 0.30, 0.42, 0.44, fill=(240, 232, 200), outline=Outline, width=1)
        rect(draw, cell, 0.48, 0.28, 0.62, 0.42, fill=(235, 226, 190), outline=Outline, width=1)
        rect(draw, cell, 0.66, 0.34, 0.82, 0.48, fill=(245, 236, 205), outline=Outline, width=1)
        rect(draw, cell, 0.18, 0.50, 0.58, 0.62, fill=(238, 230, 198), outline=Outline, width=1)
        for x, y in ((0.30, 0.38), (0.55, 0.36), (0.74, 0.42)):
            ellipse(draw, cell, x - 0.015, y - 0.015, x + 0.015, y + 0.015, fill=accent)
    elif kind.startswith("npc_"):
        # A hooded resident: shoulders, arms, robe hem and boots all connect to
        # a single silhouette so the figure reads as a person at 58 px tall.
        trim = mix(accent, (255, 246, 214), 0.35)
        hem = mix(dark, Outline, 0.45)
        skin = (214, 178, 146)
        # Boots peek under the hem.
        rect(draw, cell, 0.40, 0.88, 0.48, 0.95, fill=hem, outline=Outline, width=2, radius=0.015)
        rect(draw, cell, 0.52, 0.88, 0.60, 0.95, fill=hem, outline=Outline, width=2, radius=0.015)
        # Robe: shoulders wider than the waist so it is not a plain box.
        poly(
            draw,
            cell,
            [(0.36, 0.40), (0.50, 0.36), (0.64, 0.40), (0.70, 0.90), (0.30, 0.90)],
            fill=dark,
            outline=Outline,
            width=3,
        )
        # Front panel and vertical fold for form.
        poly(draw, cell, [(0.43, 0.44), (0.57, 0.44), (0.61, 0.86), (0.39, 0.86)], fill=mix(dark, light, 0.30))
        line(draw, cell, [(0.50, 0.46), (0.50, 0.85)], hem, 2)
        # Shoulder mantle, then the hem band with its accent trim.
        poly(draw, cell, [(0.34, 0.38), (0.50, 0.33), (0.66, 0.38), (0.62, 0.50), (0.38, 0.50)], fill=light, outline=Outline, width=2)
        rect(draw, cell, 0.31, 0.85, 0.69, 0.90, fill=hem, outline=Outline, width=2)
        rect(draw, cell, 0.31, 0.855, 0.69, 0.875, fill=trim)
        # Arms with cuffs, one raised so the pose has gesture.
        line(draw, cell, [(0.37, 0.46), (0.30, 0.60), (0.32, 0.72)], dark, 7)
        line(draw, cell, [(0.63, 0.46), (0.70, 0.60), (0.67, 0.70)], dark, 7)
        ellipse(draw, cell, 0.28, 0.70, 0.37, 0.79, fill=skin, outline=Outline, width=2)
        ellipse(draw, cell, 0.64, 0.68, 0.73, 0.77, fill=skin, outline=Outline, width=2)
        # Hood brim over a shadowed face with a single bright gaze.
        draw.polygon(
            [(int(0.34 * cell * SS), int(0.40 * cell * SS)), (int(0.50 * cell * SS), int(0.14 * cell * SS)),
             (int(0.66 * cell * SS), int(0.40 * cell * SS))],
            fill=mix(light, (255, 255, 255), 0.18),
            outline=Outline,
            width=int(3 * SS),
        )
        ellipse(draw, cell, 0.42, 0.24, 0.58, 0.40, fill=(18, 16, 26), outline=Outline, width=2)
        rect(draw, cell, 0.455, 0.321, 0.487, 0.343, fill=accent, radius=0.004)
        rect(draw, cell, 0.513, 0.321, 0.545, 0.343, fill=accent, radius=0.004)
        # Role props silhouette the resident at a glance.
        if kind == "npc_archivist":
            # A tome held open, pages catching the vault light.
            rect(draw, cell, 0.36, 0.62, 0.50, 0.80, fill=mix(accent, (255, 255, 255), 0.35), outline=Outline, width=2)
            rect(draw, cell, 0.50, 0.62, 0.64, 0.80, fill=trim, outline=Outline, width=2)
            line(draw, cell, [(0.50, 0.63), (0.50, 0.79)], Outline, 2)
            ellipse(draw, cell, 0.46, 0.30, 0.55, 0.38, fill=(30, 26, 40, 0))
        elif kind == "npc_smith":
            # Hammer over the shoulder and a heavy apron.
            rect(draw, cell, 0.68, 0.20, 0.72, 0.66, fill=mix(dark, (90, 70, 50), 0.4), outline=Outline, width=2)
            poly(draw, cell, [(0.60, 0.16), (0.80, 0.16), (0.81, 0.24), (0.59, 0.24)], fill=light, outline=Outline, width=2)
            rect(draw, cell, 0.42, 0.55, 0.58, 0.86, fill=mix(dark, (40, 34, 30), 0.5), outline=Outline, width=2)
            for y in (0.62, 0.70, 0.78):
                line(draw, cell, [(0.43, y), (0.57, y)], accent, 1)
        elif kind == "npc_gardener":
            # Shears and a sprig of living green.
            line(draw, cell, [(0.70, 0.60), (0.80, 0.44)], light, 3)
            line(draw, cell, [(0.74, 0.60), (0.66, 0.44)], light, 3)
            ellipse(draw, cell, 0.74, 0.30, 0.84, 0.42, fill=accent, outline=Outline, width=2)
            line(draw, cell, [(0.79, 0.42), (0.82, 0.55)], mix(dark, (40, 80, 40), 0.3), 2)
        elif kind == "npc_warden":
            # Crested helm and a gate spear planted at the shoulder.
            poly(draw, cell, [(0.38, 0.20), (0.50, 0.02), (0.62, 0.20)], fill=trim, outline=Outline, width=2)
            line(draw, cell, [(0.80, 0.14), (0.80, 0.94)], light, 4)
            poly(draw, cell, [(0.74, 0.12), (0.80, 0.02), (0.86, 0.12)], fill=accent, outline=Outline, width=2)
            rect(draw, cell, 0.38, 0.54, 0.62, 0.72, fill=mix(dark, light, 0.25), outline=light, width=2)
        elif kind == "npc_lamplighter":
            # A hung lantern that reads as the room's light source: halo first,
            # then the hot lantern glass over it.
            ellipse(draw, cell, 0.58, 0.42, 0.84, 0.76, fill=(255, 228, 160, 60))
            line(draw, cell, [(0.70, 0.30), (0.70, 0.52)], hem, 2)
            rect(draw, cell, 0.62, 0.50, 0.78, 0.66, fill=mix(accent, (255, 255, 255), 0.4), outline=Outline, width=2)
            ellipse(draw, cell, 0.655, 0.53, 0.745, 0.63, fill=(255, 244, 206))
    return img


def ui_image(kind: str) -> Image.Image:
    cell = 64
    img = blank(cell)
    draw = ImageDraw.Draw(img)
    accent = {
        "health": ((228, 72, 82), (255, 158, 156)),
        "mana": ((92, 176, 255), (206, 240, 255)),
        "stamina": ((226, 190, 92), (255, 244, 194)),
        "memory_fragment": ((150, 120, 255), (228, 214, 255)),
        "fragment_shard": ((112, 231, 255), (216, 252, 255)),
    }[kind]
    dark, light = accent
    ellipse(draw, cell, 0.08, 0.08, 0.92, 0.92, fill=(16, 16, 30, 235), outline=(255, 217, 138, 255), width=3)
    ellipse(draw, cell, 0.15, 0.15, 0.85, 0.85, outline=(80, 68, 48, 255), width=2)
    if kind == "health":
        poly(draw, cell, [(0.50, 0.78), (0.22, 0.48), (0.23, 0.31), (0.36, 0.24), (0.50, 0.36), (0.64, 0.24), (0.77, 0.31), (0.78, 0.48)],
             fill=dark, outline=Outline, width=2)
        ellipse(draw, cell, 0.31, 0.28, 0.45, 0.40, fill=light)
    elif kind == "mana":
        poly(draw, cell, [(0.50, 0.16), (0.72, 0.52), (0.50, 0.84), (0.28, 0.52)], fill=dark, outline=Outline, width=2)
        poly(draw, cell, [(0.50, 0.24), (0.62, 0.51), (0.50, 0.72)], fill=light)
    elif kind == "stamina":
        poly(draw, cell, [(0.62, 0.18), (0.36, 0.52), (0.50, 0.52), (0.38, 0.84), (0.68, 0.45), (0.54, 0.45)],
             fill=dark, outline=Outline, width=2)
    else:
        poly(draw, cell, [(0.50, 0.16), (0.74, 0.46), (0.50, 0.84), (0.26, 0.46)], fill=dark, outline=Outline, width=2)
        poly(draw, cell, [(0.50, 0.26), (0.63, 0.46), (0.50, 0.70), (0.37, 0.46)], fill=light)
    return img


def particle_image(kind: str) -> Image.Image:
    cell = 64
    img = blank(cell)
    draw = ImageDraw.Draw(img)
    rng = random.Random(f"particle:{kind}")
    layers = {
        "spark": (255, 228, 132),
        "smoke": (150, 140, 170),
        "blood": (172, 36, 52),
        "magic": (156, 112, 255),
    }
    color = layers[kind]
    if kind == "smoke":
        for _ in range(7):
            x, y = rng.uniform(0.25, 0.75), rng.uniform(0.25, 0.75)
            r = rng.uniform(0.10, 0.24)
            ellipse(draw, cell, x - r, y - r, x + r, y + r, fill=rgba(color, rng.randrange(30, 70)))
    elif kind == "spark":
        for i in range(12):
            angle = i / 12 * math.tau
            length = rng.uniform(0.18, 0.36)
            line(draw, cell, [(0.5, 0.5), (0.5 + math.cos(angle) * length, 0.5 + math.sin(angle) * length)], rgba(color, 190), 1)
        ellipse(draw, cell, 0.42, 0.42, 0.58, 0.58, fill=(255, 255, 255, 255))
    elif kind == "blood":
        for _ in range(6):
            x, y = rng.uniform(0.32, 0.68), rng.uniform(0.32, 0.68)
            r = rng.uniform(0.04, 0.11)
            ellipse(draw, cell, x - r, y - r, x + r, y + r, fill=rgba(color, 220))
        poly(draw, cell, [(0.5, 0.18), (0.62, 0.46), (0.5, 0.78), (0.38, 0.46)], fill=rgba(color, 235))
    else:
        for i in range(8):
            angle = i / 8 * math.tau
            x = 0.5 + math.cos(angle) * 0.28
            y = 0.5 + math.sin(angle) * 0.28
            ellipse(draw, cell, x - 0.05, y - 0.05, x + 0.05, y + 0.05, fill=rgba(color, 210))
        ellipse(draw, cell, 0.38, 0.38, 0.62, 0.62, fill=(220, 250, 255, 240))
    return img


def banner_image() -> Image.Image:
    width, height = 1200, 300
    img = Image.new("RGBA", (width, height), (9, 9, 18, 255))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / height
        color = (int(9 + t * 38), int(9 + t * 26), int(18 + t * 62), 255)
        draw.line([(0, y), (width, y)], fill=color)
    rng = random.Random("banner")
    for _ in range(160):
        x, y = rng.randrange(width), rng.randrange(height)
        r = rng.choice((1, 1, 2))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(111, 231, 255, rng.randrange(30, 130)))
    for i in range(9):
        x = 80 + i * 132
        y = 40 + (i % 3) * 22
        draw.polygon([(x, y), (x + 18, y + 32), (x, y + 64), (x - 18, y + 32)], fill=(150, 120, 255, 55), outline=(180, 230, 255, 120), width=2)
    font_path = None
    for candidate in ("C:/Windows/Fonts/georgia.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        if Path(candidate).exists():
            font_path = candidate
            break
    title_font = ImageFont.truetype(font_path, 64) if font_path else ImageFont.load_default()
    sub_font = ImageFont.truetype(font_path, 22) if font_path else ImageFont.load_default()
    draw.text((width / 2, 132), "MEMORY RECONSTRUCTION", font=title_font, fill=(255, 226, 174, 255), anchor="mm")
    draw.text((width / 2, 192), "Every fragment remembers a world", font=sub_font, fill=(192, 212, 232, 255), anchor="mm")
    return img


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


def build() -> None:
    SPRITES.mkdir(parents=True, exist_ok=True)
    rng = random.Random(20261020)

    # Player animation strips.
    player_meta = {
        "frameSize": {"width": PLAYER_CELL, "height": PLAYER_CELL},
        "origin": {"x": 0.5, "y": 0.88},
        "animations": {},
    }
    # Every stance carries its own held weapon in idle, walk and attack, so the
    # silhouette changes when the player switches, not only the hit effect.
    player_anims = [
        ("idle", "idle", "sword", 4, 6, True),
        ("walk", "walk", "sword", 6, 10, True),
        ("dash", "dash", "sword", 4, 14, False),
        ("idle_spear", "idle", "spear", 4, 6, True),
        ("idle_greatsword", "idle", "greatsword", 4, 6, True),
        ("walk_spear", "walk", "spear", 6, 10, True),
        ("walk_greatsword", "walk", "greatsword", 6, 10, True),
        ("attack", "attack", "sword", 5, 13, False),
        ("attack_spear", "attack", "spear", 4, 18, False),
        ("attack_greatsword", "attack", "greatsword", 6, 9, False),
    ]
    for state, render_state, weapon, frames, fps, loop in player_anims:
        sheet = Image.new("RGBA", (PLAYER_CELL * frames, PLAYER_CELL), (0, 0, 0, 0))
        for frame in range(frames):
            sheet.alpha_composite(
                downsample(player_frame(render_state, frame, frames, weapon), PLAYER_CELL),
                (frame * PLAYER_CELL, 0),
            )
        path = SPRITES / "player" / f"{state}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path)
        player_meta["animations"][state] = {
            "texture": f"sprites/player/{state}.png",
            "frames": frames,
            "fps": fps,
            "loop": loop,
        }
        print(f"player/{state}.png ({frames} frames)")

    # Enemy sheets: 4 columns x 4 rows (idle, walk, attack, death). Bosses are
    # authored at 192px so they stay sharp at their large display size; mobs use
    # 96px. The runtime renders with nearest filtering.
    boss_styles = {
        "guardian", "spirit", "crystalGolem", "crystalGuardian", "cinderWarden",
        "clockworkRegent", "leviathan", "forgottenGiant", "frostWarden",
        "mireSovereign", "thornMatriarch", "hiveQueen", "boneTyrant", "keeper",
        "choirHierophant", "hollowBehemoth",
    }
    enemy_meta = {}
    for kind in ENEMY_STYLES:
        cell = BOSS_CELL if kind in boss_styles else ENEMY_CELL
        sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))
        for row in range(4):
            for frame in range(4):
                cell_img = downsample(enemy_frame(kind, row, frame, 4, cell), cell)
                sheet.alpha_composite(cell_img, (frame * cell, row * cell))
        path = SPRITES / "enemies" / f"{kind}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path)
        enemy_meta[kind] = {
            "texture": f"sprites/enemies/{kind}.png",
            "frameWidth": cell,
            "frameHeight": cell,
            "columns": 4,
            "rows": 4,
            "origin": {"x": 0.5, "y": 0.90},
            "animations": {
                "idle": {"row": 0, "frames": 4, "fps": 5, "loop": True},
                "walk": {"row": 1, "frames": 4, "fps": 9, "loop": True},
                "attack": {"row": 2, "frames": 4, "fps": 12, "loop": False},
                "death": {"row": 3, "frames": 4, "fps": 6, "loop": False},
            },
        }
        print(f"enemies/{kind}.png")

    # Tilesets.
    tileset_meta = {}
    for biome in BIOME_ART:
        atlas = Image.new("RGBA", (TILE * TILE_COLUMNS, TILE * len(TILE_ROWS)), (0, 0, 0, 0))
        for row, tile_type in enumerate(TILE_ROWS):
            for variant in range(TILE_COLUMNS):
                tile = downsample(tile_image(biome, tile_type, variant), TILE)
                atlas.alpha_composite(tile, (variant * TILE, row * TILE))
        path = SPRITES / "tilesets" / f"{biome}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(path)
        tileset_meta[biome] = {
            "texture": f"sprites/tilesets/{biome}.png",
            "tileSize": TILE,
            "columns": TILE_COLUMNS,
            "rows": len(TILE_ROWS),
            "rowMap": {name: index for index, name in enumerate(TILE_ROWS)},
        }
        print(f"tilesets/{biome}.png")

    # Backgrounds.
    background_meta = {}
    for biome in BACKGROUND_ART:
        path = SPRITES / "backgrounds" / f"{biome}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        background_image(biome).save(path)
        background_meta[biome] = f"sprites/backgrounds/{biome}.png"
        print(f"backgrounds/{biome}.png")

    # Props.
    props = [
        "memory_fountain", "statue", "crystal_cluster", "ancient_tree", "ruins_door",
        "sanctuary_altar", "void_rift", "memory_chest", "barrel", "lever", "shrine",
        "npc_archivist", "npc_smith", "npc_gardener", "bone_pile", "hive_comb",
        "station_hearth", "station_armory", "station_infirmary", "station_wellspring",
        "station_watchtower", "station_bulwark", "station_vault", "station_training",
        "station_meditation", "station_notice", "npc_warden", "npc_lamplighter",
        "cog_pillar", "ice_spire", "coral",
        "furn_table", "furn_chair", "furn_shelf", "furn_crate", "furn_planter", "furn_lantern",
        "furn_rug", "furn_banner", "furn_bench", "furn_dais", "furn_column",
        "furn_books", "furn_candle", "furn_anvil", "furn_weapon_rack", "furn_stool",
        "furn_vines", "furn_brazier", "furn_herbs", "cairn_stack",
        "furn_desk", "furn_cauldron", "furn_strings",
        "building_archive", "building_forge", "building_garden", "building_barracks",
        "building_lamphouse",
    ]
    prop_meta = {}
    for prop in props:
        path = SPRITES / "props" / f"{prop}.png"
        prop_size = 192 if prop in ("furn_dais", "furn_rug") or prop.startswith("building_") else 96
        save_cell(prop_image(prop), prop_size, path)
        prop_meta[prop] = f"sprites/props/{prop}.png"
        print(f"props/{prop}.png")

    # UI icons.
    ui = ["health", "mana", "stamina", "memory_fragment", "fragment_shard"]
    ui_meta = {}
    for icon in ui:
        path = SPRITES / "ui" / f"{icon}.png"
        save_cell(ui_image(icon), 64, path)
        ui_meta[icon] = f"sprites/ui/{icon}.png"
        print(f"ui/{icon}.png")

    # Particles.
    particle_meta = {}
    for particle in ["spark", "smoke", "blood", "magic"]:
        path = SPRITES / "particles" / f"{particle}.png"
        save_cell(particle_image(particle), 64, path)
        particle_meta[particle] = f"sprites/particles/{particle}.png"
        print(f"particles/{particle}.png")

    banner_image().save(ASSETS / "banner.png")

    atlas = {
        "version": "2.0.0",
        "theme": {
            "name": "Memory Light",
            "description": "Weathered matter lit by remembered light: indigo shadow, cyan memory, gold sanctuary.",
            "palette": {
                "void": "#0A0A14",
                "indigo": "#1F2442",
                "memoryCyan": "#6FE7FF",
                "paleGold": "#FFD98A",
                "lavender": "#B89CFF",
                "ember": "#FF6B6B",
                "sanctuary": "#FFF4D0",
            },
        },
        "player": player_meta,
        "enemies": enemy_meta,
        "tilesets": tileset_meta,
        "backgrounds": background_meta,
        "props": prop_meta,
        "ui": ui_meta,
        "particles": particle_meta,
    }
    atlas_path = ASSETS / "data" / "sprite_atlas.json"
    atlas_path.parent.mkdir(parents=True, exist_ok=True)
    atlas_text = json.dumps(atlas, indent=2) + "\n"
    atlas_path.write_text(atlas_text, encoding="utf-8")
    # The game imports the atlas from src/data; keep the two copies in step.
    (SRC_DATA / "sprite_atlas.json").write_text(atlas_text, encoding="utf-8")

    graphics_assets = {
        "version": "2.0.0",
        "generated": "2026-10-20",
        "atlas": "data/sprite_atlas.json",
        "assets": {
            "player": {state: meta["texture"] for state, meta in player_meta["animations"].items()},
            "enemies": {kind: meta["texture"] for kind, meta in enemy_meta.items()},
            "tilesets": {biome: meta["texture"] for biome, meta in tileset_meta.items()},
            "backgrounds": background_meta,
            "props": prop_meta,
            "ui": ui_meta,
            "particles": particle_meta,
        },
        "notes": "Hand-painted 2.5D sprite sheets and tile atlases for the Memory Light art direction.",
    }
    (ASSETS / "data" / "graphics.assets.json").write_text(json.dumps(graphics_assets, indent=2) + "\n", encoding="utf-8")

    manifest = {
        "version": "2.0.0",
        "generated": "2026-10-20",
        "textures": {
            **{f"player_{state}": meta["texture"] for state, meta in player_meta["animations"].items()},
            **{f"enemy_{kind}": meta["texture"] for kind, meta in enemy_meta.items()},
            **{f"tileset_{biome}": meta["texture"] for biome, meta in tileset_meta.items()},
            **{f"background_{biome}": path for biome, path in background_meta.items()},
            **{f"prop_{prop}": path for prop, path in prop_meta.items()},
            **{f"ui_{icon}": path for icon, path in ui_meta.items()},
            **{f"particle_{particle}": path for particle, path in particle_meta.items()},
        },
        "audio": {},
        "shaders": {
            "sprite": "shaders/sprite.wgsl",
            "sprite_lit": "shaders/sprite_lit.wgsl",
            "post_bloom": "shaders/post_bloom.wgsl",
            "post_vignette": "shaders/post_vignette.wgsl",
            "post_crt": "shaders/post_crt.wgsl",
            "post_colorgrading": "shaders/post_colorgrading.wgsl",
            "particle": "shaders/particle.wgsl",
            "light": "shaders/light.wgsl",
        },
        "data": {
            "graphics": "data/graphics.config.json",
            "audio": "data/audio.config.json",
            "gameplay": "data/gameplay.config.json",
            "ai": "data/ai.config.json",
            "sprite_atlas": "data/sprite_atlas.json",
            "graphics_assets": "data/graphics.assets.json",
            "items": "data/items.json",
            "enemies": "data/enemies.json",
            "abilities": "data/abilities.json",
            "biomes": "data/biomes.json",
            "dialogue": "data/dialogue.json",
            "lore": "data/lore.json",
        },
    }
    (ASSETS / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"sprite atlas: {atlas_path.relative_to(ROOT)}")
    print("asset generation complete")


if __name__ == "__main__":
    build()
