"""Draw one icon per relic in src/data/equipment.json into assets/sprites/ui/relic_<id>.png.

Run from the project root:
    python scripts/generate_relic_icons.py

Deterministic and Pillow-only. It reuses the drawing helpers of generate_art_assets.py (which only
defines things on import) so the icons share the line weight, outline and supersampling of the rest
of the art. Icons are 64 px on a transparent background; the inventory box supplies the frame and
the rarity colour. A relic added to equipment.json without a drawing here fails loudly.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from PIL import ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_art_assets import Outline, blank, ellipse, glow, line, poly, rect, save_cell  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
EQUIPMENT = ROOT / "src" / "data" / "equipment.json"
OUT = ROOT / "assets" / "sprites" / "ui"
CELL = 64

STEEL = (205, 220, 236)
STEEL_DARK = (110, 124, 146)
GOLD = (255, 217, 138)
GOLD_DARK = (176, 128, 58)
LEATHER = (122, 84, 52)
WOOD = (110, 76, 46)


def _diagonal_blade(d, tip, hilt, half_width, fill, edge, guard, grip, pommel) -> None:
    """A straight blade from hilt to tip with a crossguard, grip and pommel."""
    (tx, ty), (hx, hy) = tip, hilt
    dist = math.hypot(tx - hx, ty - hy)
    ux, uy = (tx - hx) / dist, (ty - hy) / dist
    nx, ny = -uy, ux
    poly(d, CELL, [
        (hx + nx * half_width, hy + ny * half_width),
        (tx - ux * 0.08 + nx * half_width * 0.7, ty - uy * 0.08 + ny * half_width * 0.7),
        (tx, ty),
        (tx - ux * 0.08 - nx * half_width * 0.7, ty - uy * 0.08 - ny * half_width * 0.7),
        (hx - nx * half_width, hy - ny * half_width),
    ], fill=fill, outline=Outline, width=2)
    line(d, CELL, [(hx, hy), (tx - ux * 0.06, ty - uy * 0.06)], edge, 1)
    line(d, CELL, [(hx + nx * 0.13, hy + ny * 0.13), (hx - nx * 0.13, hy - ny * 0.13)], guard, 3)
    gx, gy = hx - ux * 0.13, hy - uy * 0.13
    line(d, CELL, [(hx, hy), (gx, gy)], grip, 3)
    ellipse(d, CELL, gx - 0.04, gy - 0.04, gx + 0.04, gy + 0.04, fill=pommel, outline=Outline, width=1)


def rusted_edge(img, d) -> None:
    _diagonal_blade(d, (0.82, 0.18), (0.32, 0.68), 0.085, (150, 112, 82), (196, 160, 120),
                    (120, 90, 60), LEATHER, (120, 90, 60))
    for x, y in ((0.52, 0.47), (0.62, 0.38), (0.45, 0.56)):
        ellipse(d, CELL, x - 0.025, y - 0.02, x + 0.025, y + 0.02, fill=(164, 82, 40))


def echo_dagger(img, d) -> None:
    glow(img, lambda g: ellipse(g, CELL, 0.42, 0.18, 0.80, 0.56, fill=(111, 231, 255, 110)), 3)
    _diagonal_blade(d, (0.70, 0.30), (0.40, 0.60), 0.05, (170, 236, 255), (255, 255, 255),
                    GOLD, (42, 38, 54), (111, 231, 255))
    _diagonal_blade(d, (0.80, 0.20), (0.56, 0.44), 0.035, (111, 231, 255, 120), (210, 250, 255, 140),
                    (0, 0, 0, 0), (0, 0, 0, 0), (0, 0, 0, 0))


def choir_staff(img, d) -> None:
    line(d, CELL, [(0.30, 0.84), (0.62, 0.30)], WOOD, 4)
    line(d, CELL, [(0.30, 0.84), (0.62, 0.30)], (150, 108, 70), 1)
    glow(img, lambda g: ellipse(g, CELL, 0.52, 0.10, 0.86, 0.44, fill=(206, 190, 255, 140)), 3)
    ellipse(d, CELL, 0.58, 0.16, 0.80, 0.38, outline=GOLD, width=3)
    ellipse(d, CELL, 0.63, 0.21, 0.75, 0.33, fill=(220, 210, 255), outline=Outline, width=1)
    for a in (-0.6, 0.0, 0.6):
        x, y = 0.69 + math.cos(a - 1.57) * 0.16, 0.27 + math.sin(a - 1.57) * 0.16
        line(d, CELL, [(0.69, 0.13), (x, y)], GOLD, 1)


def void_cleaver(img, d) -> None:
    glow(img, lambda g: poly(g, CELL, [(0.40, 0.14), (0.86, 0.20), (0.80, 0.56), (0.48, 0.50)],
                             fill=(150, 70, 255, 120)), 3)
    poly(d, CELL, [(0.40, 0.16), (0.84, 0.22), (0.78, 0.54), (0.48, 0.48)], fill=(46, 28, 74),
         outline=Outline, width=2)
    line(d, CELL, [(0.84, 0.22), (0.78, 0.54)], (196, 140, 255), 2)
    for x, y in ((0.58, 0.30), (0.68, 0.40), (0.60, 0.42)):
        ellipse(d, CELL, x - 0.015, y - 0.015, x + 0.015, y + 0.015, fill=(214, 180, 255))
    line(d, CELL, [(0.46, 0.46), (0.22, 0.82)], (42, 38, 54), 4)
    ellipse(d, CELL, 0.17, 0.78, 0.27, 0.88, fill=(150, 70, 255), outline=Outline, width=1)


def ember_core(img, d) -> None:
    # A burning orb held in an iron cage on a short haft: a weapon, not a pendant like Ember Charm.
    line(d, CELL, [(0.50, 0.62), (0.50, 0.90)], (42, 38, 54), 4)
    glow(img, lambda g: ellipse(g, CELL, 0.18, 0.10, 0.82, 0.74, fill=(255, 120, 40, 150)), 4)
    ellipse(d, CELL, 0.30, 0.18, 0.70, 0.58, fill=(214, 76, 30), outline=Outline, width=2)
    ellipse(d, CELL, 0.38, 0.26, 0.62, 0.50, fill=(255, 168, 64))
    ellipse(d, CELL, 0.44, 0.32, 0.54, 0.42, fill=(255, 240, 180))
    for x0, x1 in ((0.30, 0.40), (0.70, 0.60)):
        line(d, CELL, [(0.50, 0.12), (x0, 0.38), (x1, 0.62)], (70, 64, 80), 3)
    line(d, CELL, [(0.50, 0.12), (0.50, 0.18)], (70, 64, 80), 3)
    line(d, CELL, [(0.36, 0.62), (0.64, 0.62)], (70, 64, 80), 3)


def _torso(d, fill, trim, collar=None) -> None:
    poly(d, CELL, [(0.30, 0.22), (0.42, 0.18), (0.58, 0.18), (0.70, 0.22), (0.82, 0.38), (0.72, 0.44),
                   (0.70, 0.82), (0.30, 0.82), (0.28, 0.44), (0.18, 0.38)], fill=fill, outline=Outline, width=2)
    line(d, CELL, [(0.30, 0.80), (0.70, 0.80)], trim, 2)
    if collar:
        poly(d, CELL, [(0.42, 0.18), (0.50, 0.32), (0.58, 0.18)], fill=collar, outline=Outline, width=1)


def scavenger_vest(img, d) -> None:
    _torso(d, (128, 96, 64), (88, 64, 42), (70, 52, 36))
    rect(d, CELL, 0.34, 0.50, 0.46, 0.62, fill=(150, 116, 80), outline=Outline, width=1)
    rect(d, CELL, 0.54, 0.56, 0.66, 0.68, fill=(104, 120, 96), outline=Outline, width=1)
    for y in (0.40, 0.52, 0.64):
        line(d, CELL, [(0.49, y), (0.51, y + 0.04)], (210, 190, 150), 1)


def crystal_mail(img, d) -> None:
    glow(img, lambda g: ellipse(g, CELL, 0.24, 0.20, 0.76, 0.80, fill=(111, 231, 255, 70)), 3)
    _torso(d, (64, 150, 176), (170, 240, 255), (40, 90, 116))
    for row, y in enumerate((0.40, 0.52, 0.64)):
        for col in range(4):
            x = 0.36 + col * 0.09 + (0.045 if row % 2 else 0)
            poly(d, CELL, [(x, y - 0.04), (x + 0.035, y), (x, y + 0.04), (x - 0.035, y)], fill=(170, 240, 255))


def void_shroud(img, d) -> None:
    glow(img, lambda g: ellipse(g, CELL, 0.20, 0.14, 0.80, 0.86, fill=(150, 70, 255, 90)), 4)
    poly(d, CELL, [(0.50, 0.12), (0.70, 0.26), (0.80, 0.84), (0.62, 0.76), (0.50, 0.86), (0.38, 0.76),
                   (0.20, 0.84), (0.30, 0.26)], fill=(52, 30, 84), outline=Outline, width=2)
    ellipse(d, CELL, 0.40, 0.22, 0.60, 0.40, fill=(14, 10, 26))
    ellipse(d, CELL, 0.44, 0.28, 0.48, 0.32, fill=(214, 180, 255))
    ellipse(d, CELL, 0.52, 0.28, 0.56, 0.32, fill=(214, 180, 255))


def mire_talisman(img, d) -> None:
    _torso(d, (74, 104, 64), (130, 160, 90), (52, 74, 46))
    line(d, CELL, [(0.40, 0.24), (0.50, 0.46), (0.60, 0.24)], (150, 130, 90), 1)
    poly(d, CELL, [(0.50, 0.44), (0.58, 0.54), (0.50, 0.66), (0.42, 0.54)], fill=(120, 190, 110), outline=Outline, width=1)
    ellipse(d, CELL, 0.47, 0.51, 0.53, 0.57, fill=(220, 255, 200))


def colossus_plate(img, d) -> None:
    _torso(d, (176, 186, 200), STEEL_DARK, (120, 132, 150))
    ellipse(d, CELL, 0.12, 0.26, 0.36, 0.46, fill=(150, 162, 180), outline=Outline, width=2)
    ellipse(d, CELL, 0.64, 0.26, 0.88, 0.46, fill=(150, 162, 180), outline=Outline, width=2)
    line(d, CELL, [(0.50, 0.32), (0.50, 0.78)], STEEL_DARK, 2)
    for x, y in ((0.38, 0.46), (0.62, 0.46), (0.38, 0.66), (0.62, 0.66)):
        ellipse(d, CELL, x - 0.02, y - 0.02, x + 0.02, y + 0.02, fill=GOLD)


def duelist_mantle(img, d) -> None:
    poly(d, CELL, [(0.26, 0.24), (0.74, 0.24), (0.86, 0.80), (0.64, 0.70), (0.50, 0.84), (0.36, 0.70),
                   (0.14, 0.80)], fill=(168, 36, 52), outline=Outline, width=2)
    poly(d, CELL, [(0.26, 0.24), (0.74, 0.24), (0.66, 0.36), (0.34, 0.36)], fill=(214, 70, 82), outline=Outline, width=1)
    line(d, CELL, [(0.28, 0.27), (0.72, 0.27)], GOLD, 2)
    ellipse(d, CELL, 0.45, 0.25, 0.55, 0.35, fill=GOLD, outline=Outline, width=1)


def _cord(d) -> None:
    line(d, CELL, [(0.30, 0.14), (0.50, 0.40), (0.70, 0.14)], (150, 120, 84), 2)


def ember_charm(img, d) -> None:
    _cord(d)
    glow(img, lambda g: ellipse(g, CELL, 0.30, 0.34, 0.70, 0.80, fill=(255, 122, 58, 120)), 3)
    poly(d, CELL, [(0.50, 0.38), (0.64, 0.58), (0.58, 0.78), (0.42, 0.78), (0.36, 0.58)], fill=(230, 100, 44),
         outline=Outline, width=2)
    poly(d, CELL, [(0.50, 0.52), (0.56, 0.64), (0.50, 0.74), (0.44, 0.64)], fill=(255, 210, 120))


def tide_lens(img, d) -> None:
    glow(img, lambda g: ellipse(g, CELL, 0.18, 0.18, 0.82, 0.82, fill=(79, 184, 255, 90)), 3)
    ellipse(d, CELL, 0.20, 0.20, 0.80, 0.80, fill=(36, 82, 140), outline=GOLD, width=3)
    ellipse(d, CELL, 0.28, 0.28, 0.72, 0.72, fill=(79, 184, 255), outline=Outline, width=1)
    line(d, CELL, [(0.30, 0.56), (0.40, 0.50), (0.50, 0.56), (0.60, 0.50), (0.70, 0.56)], (210, 245, 255), 2)
    ellipse(d, CELL, 0.36, 0.32, 0.46, 0.42, fill=(230, 250, 255))


def thorn_ring(img, d) -> None:
    ellipse(d, CELL, 0.22, 0.26, 0.78, 0.82, outline=(70, 120, 60), width=5)
    for k in range(8):
        a = k * math.pi / 4
        x, y = 0.50 + math.cos(a) * 0.30, 0.54 + math.sin(a) * 0.30
        ox, oy = 0.50 + math.cos(a) * 0.40, 0.54 + math.sin(a) * 0.40
        poly(d, CELL, [(x + math.sin(a) * 0.06, y - math.cos(a) * 0.06), (ox, oy),
                       (x - math.sin(a) * 0.06, y + math.cos(a) * 0.06)], fill=(126, 224, 122), outline=Outline, width=1)
    ellipse(d, CELL, 0.44, 0.16, 0.56, 0.28, fill=(200, 40, 60), outline=Outline, width=1)


def clockwork_gear(img, d) -> None:
    pts = []
    for k in range(24):
        a = k * math.pi / 12
        r = 0.36 if k % 2 == 0 else 0.28
        pts.append((0.50 + math.cos(a) * r, 0.50 + math.sin(a) * r))
    poly(d, CELL, pts, fill=(196, 160, 82), outline=Outline, width=2)
    ellipse(d, CELL, 0.32, 0.32, 0.68, 0.68, fill=GOLD_DARK, outline=Outline, width=1)
    ellipse(d, CELL, 0.42, 0.42, 0.58, 0.58, fill=(40, 34, 30))
    line(d, CELL, [(0.50, 0.50), (0.50, 0.36)], GOLD, 2)
    line(d, CELL, [(0.50, 0.50), (0.60, 0.54)], GOLD, 2)


def sun_core(img, d) -> None:
    glow(img, lambda g: ellipse(g, CELL, 0.12, 0.12, 0.88, 0.88, fill=(255, 216, 74, 150)), 4)
    for k in range(12):
        a = k * math.pi / 6
        r0, r1 = 0.24, 0.40 if k % 2 == 0 else 0.33
        line(d, CELL, [(0.5 + math.cos(a) * r0, 0.5 + math.sin(a) * r0),
                       (0.5 + math.cos(a) * r1, 0.5 + math.sin(a) * r1)], (255, 200, 60), 3)
    ellipse(d, CELL, 0.28, 0.28, 0.72, 0.72, fill=(255, 196, 52), outline=Outline, width=2)
    ellipse(d, CELL, 0.38, 0.36, 0.56, 0.54, fill=(255, 246, 200))


def bog_crown(img, d) -> None:
    poly(d, CELL, [(0.18, 0.70), (0.18, 0.34), (0.32, 0.50), (0.42, 0.26), (0.50, 0.46), (0.58, 0.26),
                   (0.68, 0.50), (0.82, 0.34), (0.82, 0.70)], fill=(120, 150, 60), outline=Outline, width=2)
    rect(d, CELL, 0.18, 0.62, 0.82, 0.74, fill=(96, 110, 48), outline=Outline, width=1)
    for x in (0.32, 0.50, 0.68):
        ellipse(d, CELL, x - 0.035, 0.645, x + 0.035, 0.715, fill=(170, 220, 90))
    line(d, CELL, [(0.26, 0.74), (0.24, 0.86)], (90, 120, 50), 2)
    line(d, CELL, [(0.74, 0.74), (0.78, 0.84)], (90, 120, 50), 2)


def soul_anchor(img, d) -> None:
    glow(img, lambda g: ellipse(g, CELL, 0.20, 0.14, 0.80, 0.86, fill=(185, 166, 255, 90)), 3)
    ellipse(d, CELL, 0.42, 0.12, 0.58, 0.28, outline=(200, 190, 230), width=3)
    line(d, CELL, [(0.50, 0.28), (0.50, 0.80)], (200, 190, 230), 4)
    line(d, CELL, [(0.36, 0.38), (0.64, 0.38)], (200, 190, 230), 3)
    line(d, CELL, [(0.22, 0.60), (0.30, 0.76), (0.50, 0.82), (0.70, 0.76), (0.78, 0.60)], (200, 190, 230), 4)
    poly(d, CELL, [(0.18, 0.62), (0.26, 0.56), (0.26, 0.66)], fill=(200, 190, 230))
    poly(d, CELL, [(0.82, 0.62), (0.74, 0.56), (0.74, 0.66)], fill=(200, 190, 230))


def storm_dial(img, d) -> None:
    ellipse(d, CELL, 0.18, 0.18, 0.82, 0.82, fill=(30, 46, 70), outline=STEEL, width=3)
    for k in range(12):
        a = k * math.pi / 6
        line(d, CELL, [(0.5 + math.cos(a) * 0.24, 0.5 + math.sin(a) * 0.24),
                       (0.5 + math.cos(a) * 0.29, 0.5 + math.sin(a) * 0.29)], (159, 232, 255), 1)
    poly(d, CELL, [(0.56, 0.26), (0.40, 0.52), (0.50, 0.52), (0.42, 0.74), (0.62, 0.46), (0.52, 0.46)],
         fill=(200, 244, 255), outline=Outline, width=1)


def ember_ward(img, d) -> None:
    poly(d, CELL, [(0.50, 0.14), (0.80, 0.24), (0.78, 0.54), (0.50, 0.86), (0.22, 0.54), (0.20, 0.24)],
         fill=(140, 40, 40), outline=Outline, width=2)
    poly(d, CELL, [(0.50, 0.22), (0.72, 0.30), (0.70, 0.52), (0.50, 0.76), (0.30, 0.52), (0.28, 0.30)],
         fill=(196, 64, 54))
    glow(img, lambda g: ellipse(g, CELL, 0.36, 0.36, 0.64, 0.66, fill=(255, 140, 70, 160)), 2)
    poly(d, CELL, [(0.50, 0.34), (0.58, 0.48), (0.54, 0.62), (0.46, 0.62), (0.42, 0.48)], fill=(255, 190, 90))


def scout_hood(img, d) -> None:
    # A soft, pointed hood with a shadowed face: light gear for a wanderer who travels fast.
    poly(d, CELL, [(0.50, 0.10), (0.74, 0.26), (0.82, 0.58), (0.70, 0.84), (0.30, 0.84), (0.18, 0.58),
                   (0.26, 0.26)], fill=(96, 116, 74), outline=Outline, width=2)
    poly(d, CELL, [(0.50, 0.18), (0.66, 0.32), (0.62, 0.60), (0.38, 0.60), (0.34, 0.32)],
         fill=(48, 58, 40), outline=Outline, width=1)
    ellipse(d, CELL, 0.42, 0.42, 0.47, 0.47, fill=(230, 200, 120))
    ellipse(d, CELL, 0.53, 0.42, 0.58, 0.47, fill=(230, 200, 120))
    line(d, CELL, [(0.50, 0.10), (0.50, 0.04)], (150, 170, 110), 2)
    line(d, CELL, [(0.30, 0.66), (0.70, 0.66)], (150, 170, 110), 1)


def iron_helm(img, d) -> None:
    # A kettle helm: domed crown, wide brim and a nose guard.
    poly(d, CELL, [(0.24, 0.46), (0.30, 0.24), (0.50, 0.14), (0.70, 0.24), (0.76, 0.46)],
         fill=(142, 152, 168), outline=Outline, width=2)
    line(d, CELL, [(0.50, 0.14), (0.50, 0.46)], STEEL, 1)
    poly(d, CELL, [(0.10, 0.46), (0.90, 0.46), (0.82, 0.58), (0.18, 0.58)],
         fill=(112, 124, 142), outline=Outline, width=2)
    poly(d, CELL, [(0.50, 0.58), (0.58, 0.66), (0.54, 0.86), (0.46, 0.86), (0.42, 0.66)],
         fill=(166, 176, 192), outline=Outline, width=1)
    for x in (0.34, 0.66):
        ellipse(d, CELL, x - 0.02, 0.28, x + 0.02, 0.32, fill=(60, 66, 78))


def oracle_circlet(img, d) -> None:
    # A thin circlet with a raised gem and three motes of foresight.
    ellipse(d, CELL, 0.16, 0.40, 0.84, 0.66, outline=GOLD, width=4)
    poly(d, CELL, [(0.50, 0.16), (0.62, 0.34), (0.50, 0.48), (0.38, 0.34)], fill=(120, 220, 240),
         outline=Outline, width=2)
    ellipse(d, CELL, 0.46, 0.28, 0.54, 0.36, fill=(230, 250, 255))
    for x, y in ((0.30, 0.16), (0.70, 0.16), (0.78, 0.78)):
        ellipse(d, CELL, x - 0.025, y - 0.025, x + 0.025, y + 0.025,
                fill=(200, 250, 255), outline=Outline, width=1)


def void_visor(img, d) -> None:
    # A sealed dark helm with one burning slit.
    poly(d, CELL, [(0.28, 0.16), (0.72, 0.16), (0.84, 0.44), (0.74, 0.86), (0.26, 0.86), (0.16, 0.44)],
         fill=(44, 32, 68), outline=Outline, width=2)
    poly(d, CELL, [(0.30, 0.22), (0.70, 0.22), (0.76, 0.48), (0.66, 0.60), (0.34, 0.60), (0.24, 0.48)],
         fill=(24, 18, 40))
    glow(img, lambda g: ellipse(g, CELL, 0.22, 0.36, 0.78, 0.52, fill=(180, 90, 255, 140)), 2)
    poly(d, CELL, [(0.28, 0.40), (0.72, 0.40), (0.64, 0.48), (0.36, 0.48)], fill=(214, 140, 255))
    line(d, CELL, [(0.32, 0.72), (0.42, 0.66)], (150, 90, 210), 2)
    line(d, CELL, [(0.60, 0.66), (0.68, 0.74)], (150, 90, 210), 2)
    line(d, CELL, [(0.50, 0.64), (0.50, 0.80)], (120, 70, 180), 2)


DRAWINGS = {
    "rusted_edge": rusted_edge, "echo_dagger": echo_dagger, "choir_staff": choir_staff,
    "void_cleaver": void_cleaver, "ember_core": ember_core,
    "scavenger_vest": scavenger_vest, "crystal_mail": crystal_mail, "void_shroud": void_shroud,
    "mire_talisman": mire_talisman, "colossus_plate": colossus_plate, "duelist_mantle": duelist_mantle,
    "ember_charm": ember_charm, "tide_lens": tide_lens, "thorn_ring": thorn_ring,
    "clockwork_gear": clockwork_gear, "sun_core": sun_core, "bog_crown": bog_crown,
    "soul_anchor": soul_anchor, "storm_dial": storm_dial, "ember_ward": ember_ward,
    "scout_hood": scout_hood, "iron_helm": iron_helm, "oracle_circlet": oracle_circlet,
    "void_visor": void_visor,
}


def main() -> int:
    items = json.loads(EQUIPMENT.read_text(encoding="utf-8"))["items"]
    missing = [item["id"] for item in items if item["id"] not in DRAWINGS]
    if missing:
        print(f"Error: no icon drawing for {', '.join(missing)}.", file=sys.stderr)
        print("Why: every relic in equipment.json shows its icon in the inventory.", file=sys.stderr)
        print("Fix: add a drawing to DRAWINGS in scripts/generate_relic_icons.py.", file=sys.stderr)
        return 1
    for item in items:
        img = blank(CELL)
        DRAWINGS[item["id"]](img, ImageDraw.Draw(img))
        save_cell(img, CELL, OUT / f"relic_{item['id']}.png")
    print(f"[OK] wrote {len(items)} relic icons to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
