#!/usr/bin/env python3
"""
Fuori Rete: Crisis at Cisco Naples — Master Asset Generator
Milestone 1: Dependencies, Asset Pipeline & Local Spritesheet Generation

Programmatically generates all retro pixel art assets for Fuori Rete:
1. Animated character spritesheets (160x256 px, 4 directions x 5 frames, 32x64 px/frame)
2. Character expression portraits (neutral, tense, satisfied) at 64x64 and 128x128
3. Isometric floor tiles (64x32 px) & walls/doors (64x80 px) & combined atlas (256x112 px)
4. Furniture & equipment sprites (desks, switch rack, server rack, espresso bar, monstera, pizza box, atlas)
5. Panoramic Vesuvius window vistas (320x180 px) & isometric wall windows (96x80 px) for 3 time phases
6. Strict 16-color palette quantization via pipeline/quantize_palette.py
7. Manifest generation (public/assets/manifest.json) indexing every asset with URL and dimensions
"""

import os
import sys
import json
from PIL import Image, ImageDraw

# Add pipeline directory to sys.path for direct palette integration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PIPELINE_DIR = os.path.join(PROJECT_ROOT, "pipeline")
if PIPELINE_DIR not in sys.path:
    sys.path.append(PIPELINE_DIR)

try:
    from quantize_palette import PALETTE_COLORS, quantize_image
except ImportError:
    # Fallback to official 16-color palette definition
    PALETTE_COLORS = [
        (0, 188, 235),    # 0. Cisco Cyan
        (2, 132, 199),    # 1. Azzurro Napoli
        (3, 105, 161),    # 2. Cisco Deep Blue
        (13, 39, 77),     # 3. Cisco Navy
        (15, 23, 42),     # 4. Slate Dark
        (2, 6, 23),       # 5. Void Black
        (255, 255, 255),  # 6. Pure White
        (203, 213, 225),  # 7. Light Stone
        (16, 185, 129),   # 8. Matrix Green
        (245, 158, 11),   # 9. Warning Amber
        (239, 68, 68),    # 10. Threat Red
        (180, 83, 9),     # 11. Oak Parquet Light
        (146, 64, 14),    # 12. Oak Parquet Dark
        (124, 45, 18),    # 13. Terracotta Brick Dark
        (154, 52, 18),    # 14. Terracotta Brick Light
        (254, 240, 138),  # 15. Vesuvius Sunset Gold
    ]

# RGBA Named Palette for fast drawing
PALETTE = {
    "cyan": (0, 188, 235, 255),
    "azure": (2, 132, 199, 255),
    "azzurro": (2, 132, 199, 255),
    "napoli": (2, 132, 199, 255),
    "deep_blue": (3, 105, 161, 255),
    "navy": (13, 39, 77, 255),
    "slate": (15, 23, 42, 255),
    "slate_dark": (15, 23, 42, 255),
    "void": (2, 6, 23, 255),
    "void_black": (2, 6, 23, 255),
    "white": (255, 255, 255, 255),
    "stone": (203, 213, 225, 255),
    "light_stone": (203, 213, 225, 255),
    "green": (16, 185, 129, 255),
    "matrix_green": (16, 185, 129, 255),
    "amber": (245, 158, 11, 255),
    "warning_amber": (245, 158, 11, 255),
    "red": (239, 68, 68, 255),
    "threat_red": (239, 68, 68, 255),
    "oak_light": (180, 83, 9, 255),
    "parquet_light": (180, 83, 9, 255),
    "oak_dark": (146, 64, 14, 255),
    "parquet_dark": (146, 64, 14, 255),
    "terracotta_dark": (124, 45, 18, 255),
    "brick_dark": (124, 45, 18, 255),
    "terracotta_light": (154, 52, 18, 255),
    "brick_light": (154, 52, 18, 255),
    "gold": (254, 240, 138, 255),
    "sunset_gold": (254, 240, 138, 255),
    "transparent": (0, 0, 0, 0),
}


# ============================================================================
# 1. QUANTIZATION & SAVE UTILITY
# ============================================================================

def quantize_pil_image(img: Image.Image, scale_factor: int = 1) -> Image.Image:
    """Applies Euclidean nearest-color quantization to strictly enforce the 16-color retro palette."""
    img = img.convert("RGBA")
    if scale_factor > 1:
        w, h = img.size
        img = img.resize((w // scale_factor, h // scale_factor), Image.Resampling.NEAREST)
        img = img.resize((w, h), Image.Resampling.NEAREST)

    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 32:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            best_color = PALETTE_COLORS[0]
            best_dist = float("inf")
            for pr, pg, pb in PALETTE_COLORS:
                dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
                if dist < best_dist:
                    best_dist = dist
                    best_color = (pr, pg, pb)
            pixels[x, y] = (best_color[0], best_color[1], best_color[2], 255)
    return img


def save_and_quantize(img: Image.Image, output_path: str):
    """Saves image and guarantees 100% compliance with pipeline/quantize_palette.py."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    quantized = quantize_pil_image(img)
    quantized.save(output_path, "PNG")


# ============================================================================
# 2. CHARACTER SPRITESHEETS GENERATOR (explorer_m1_1 spec)
# ============================================================================

FRAME_W = 32
FRAME_H = 64
CHAR_COLS = 5
CHAR_ROWS = 4
SHEET_W = FRAME_W * CHAR_COLS  # 160
SHEET_H = FRAME_H * CHAR_ROWS  # 256


def get_character_config(char_type: str) -> dict:
    if char_type == "rosaria":
        return {
            "type": "rosaria",
            "skin_base": PALETTE["sunset_gold"],
            "skin_shadow": PALETTE["parquet_light"],
            "hair_main": PALETTE["brick_light"],
            "hair_dark": PALETTE["brick_dark"],
            "hair_accent": PALETTE["parquet_light"],
            "top_main": PALETTE["brick_dark"],
            "top_light": PALETTE["brick_light"],
            "top_collar": PALETTE["white"],
            "pants_main": PALETTE["slate_dark"],
            "pants_light": PALETTE["navy"],
            "shoes_main": PALETTE["void_black"],
            "shoe_sole": PALETTE["stone"],
            "hair_style": "bun",
            "glasses": True,
            "glasses_col": PALETTE["stone"],
            "beard": False,
            "badge_type": "key",
            "prop": "notebook",
        }
    elif char_type == "ciro":
        return {
            "type": "ciro",
            "skin_base": PALETTE["sunset_gold"],
            "skin_shadow": PALETTE["parquet_light"],
            "hair_main": PALETTE["void_black"],
            "hair_dark": PALETTE["slate_dark"],
            "hair_accent": PALETTE["slate_dark"],
            "top_main": PALETTE["amber"],
            "top_light": PALETTE["sunset_gold"],
            "top_collar": PALETTE["azure"],
            "pants_main": PALETTE["slate_dark"],
            "pants_light": PALETTE["navy"],
            "shoes_main": PALETTE["white"],
            "shoe_sole": PALETTE["threat_red"],
            "hair_style": "curly",
            "glasses": False,
            "beard": False,
            "badge_type": "tool_pouch",
            "prop": "headset",
        }
    elif char_type == "marco":
        return {
            "type": "marco",
            "skin_base": PALETTE["sunset_gold"],
            "skin_shadow": PALETTE["parquet_light"],
            "hair_main": PALETTE["void_black"],
            "hair_dark": PALETTE["slate_dark"],
            "hair_accent": PALETTE["slate_dark"],
            "top_main": PALETTE["navy"],
            "top_light": PALETTE["deep_blue"],
            "top_collar": PALETTE["white"],
            "pants_main": PALETTE["slate_dark"],
            "pants_light": PALETTE["deep_blue"],
            "shoes_main": PALETTE["slate_dark"],
            "shoe_sole": PALETTE["white"],
            "hair_style": "slick",
            "glasses": True,
            "glasses_col": PALETTE["cyan"],
            "beard": True,
            "beard_col": PALETTE["void_black"],
            "badge_type": "console_cable",
            "prop": "ccna_badge",
        }
    else:  # protagonist (netcadet)
        return {
            "type": "protagonist",
            "skin_base": PALETTE["sunset_gold"],
            "skin_shadow": PALETTE["parquet_light"],
            "hair_main": PALETTE["slate_dark"],
            "hair_dark": PALETTE["void_black"],
            "hair_accent": PALETTE["stone"],
            "top_main": PALETTE["cyan"],
            "top_light": PALETTE["azure"],
            "top_collar": PALETTE["white"],
            "pants_main": PALETTE["navy"],
            "pants_light": PALETTE["deep_blue"],
            "shoes_main": PALETTE["white"],
            "shoe_sole": PALETTE["slate_dark"],
            "hair_style": "spiky",
            "glasses": False,
            "beard": False,
            "badge_type": "intern_badge",
            "prop": "none",
        }


def draw_char_arm(draw: ImageDraw.ImageDraw, x: int, y: int, cfg: dict, is_front: bool = True):
    col_main = cfg["top_main"]
    col_light = cfg["top_light"]
    skin = cfg["skin_base"]
    outline = PALETTE["void_black"]

    # Upper Sleeve (4x7 px)
    draw.rectangle([x, y, x + 3, y + 6], fill=col_main)
    if is_front:
        draw.line([(x + 1, y), (x + 1, y + 5)], fill=col_light)
    draw.rectangle([x, y, x + 3, y + 6], outline=outline)

    # Forearm & Hand (4x5 px)
    draw.rectangle([x, y + 7, x + 3, y + 11], fill=skin)
    draw.line([(x, y + 7), (x + 3, y + 7)], fill=cfg["top_collar"])
    draw.rectangle([x, y + 7, x + 3, y + 11], outline=outline)


def draw_char_legs(draw: ImageDraw.ImageDraw, base_dir: str, bob_y: int,
                   l_dx: int, l_dy: int, r_dx: int, r_dy: int, cfg: dict):
    outline = PALETTE["void_black"]
    pants = cfg["pants_main"]
    pants_light = cfg["pants_light"]
    shoe = cfg["shoes_main"]
    sole = cfg["shoe_sole"]

    # Left Leg (X: 10..14)
    lx = 10 + l_dx
    ly_top = 43 + bob_y
    ly_bot = 55 + bob_y + l_dy
    draw.rectangle([lx, ly_top, lx + 4, ly_bot], fill=pants)
    draw.line([(lx + 1, ly_top), (lx + 1, ly_bot - 1)], fill=pants_light)
    draw.rectangle([lx, ly_top, lx + 4, ly_bot], outline=outline)
    sy = ly_bot + 1
    draw.rectangle([lx - 1, sy, lx + 4, sy + 3], fill=shoe)
    draw.line([(lx - 1, sy + 3), (lx + 4, sy + 3)], fill=sole)
    draw.rectangle([lx - 1, sy, lx + 4, sy + 3], outline=outline)

    # Right Leg (X: 17..21)
    rx = 17 + r_dx
    ry_top = 43 + bob_y
    ry_bot = 55 + bob_y + r_dy
    draw.rectangle([rx, ry_top, rx + 4, ry_bot], fill=pants)
    draw.line([(rx + 1, ry_top), (rx + 1, ry_bot - 1)], fill=pants_light)
    draw.rectangle([rx, ry_top, rx + 4, ry_bot], outline=outline)
    sy2 = ry_bot + 1
    draw.rectangle([rx, sy2, rx + 5, sy2 + 3], fill=shoe)
    draw.line([(rx, sy2 + 3), (rx + 5, sy2 + 3)], fill=sole)
    draw.rectangle([rx, sy2, rx + 5, sy2 + 3], outline=outline)


def draw_char_torso(draw: ImageDraw.ImageDraw, base_dir: str, bob_y: int, cfg: dict):
    y = 28 + bob_y
    outline = PALETTE["void_black"]
    top = cfg["top_main"]
    top_light = cfg["top_light"]
    collar = cfg["top_collar"]

    # Main Torso (14x14 px)
    draw.rectangle([9, y, 22, y + 13], fill=top)
    draw.line([(10, y + 1), (10, y + 12)], fill=top_light)
    draw.line([(11, y + 1), (11, y + 12)], fill=top_light)
    draw.rectangle([9, y, 22, y + 13], outline=outline)

    # Belt
    draw.rectangle([9, y + 13, 22, y + 15], fill=PALETTE["void_black"])
    if base_dir == "SE":
        # Amber Buckle
        draw.rectangle([15, y + 13, 17, y + 15], fill=PALETTE["amber"])
        # V-Neck / Collar
        draw.polygon([(14, y), (17, y), (16, y + 3), (15, y + 3)], fill=collar)
        draw.line([(15, y), (16, y)], fill=outline)
    else:  # NE
        draw.line([(12, y), (19, y)], fill=collar)
        draw.line([(13, y + 1), (18, y + 1)], fill=outline)


def draw_char_head(draw: ImageDraw.ImageDraw, base_dir: str, bob_y: int, cfg: dict):
    y = 14 + bob_y
    outline = PALETTE["void_black"]
    skin = cfg["skin_base"]
    skin_shadow = cfg["skin_shadow"]
    hair = cfg["hair_main"]
    hair_dark = cfg["hair_dark"]

    # Head Cranium
    draw.rectangle([10, y, 21, y + 12], fill=skin)
    draw.line([(11, y + 12), (20, y + 12)], fill=skin_shadow)
    draw.rectangle([10, y, 21, y + 12], outline=outline)

    # Ears
    draw.rectangle([9, y + 5, 9, y + 7], fill=skin, outline=outline)
    draw.rectangle([22, y + 5, 22, y + 7], fill=skin, outline=outline)

    if base_dir == "SE":
        # Forehead Hair
        if cfg["hair_style"] == "spiky":
            draw.rectangle([9, y - 2, 22, y + 3], fill=hair)
            draw.line([(10, y - 2), (21, y - 2)], fill=cfg["hair_accent"])
            draw.polygon([(9, y - 1), (11, y - 5), (13, y - 1)], fill=hair)
            draw.polygon([(13, y - 1), (16, y - 6), (18, y - 1)], fill=hair)
            draw.polygon([(18, y - 1), (21, y - 5), (22, y - 1)], fill=hair)
        elif cfg["hair_style"] == "bun":
            draw.rectangle([9, y - 2, 22, y + 4], fill=hair)
            draw.rectangle([9, y + 4, 11, y + 7], fill=hair)
            draw.line([(10, y - 1), (21, y - 1)], fill=cfg["hair_accent"])
            draw.ellipse([14, y - 6, 18, y - 1], fill=hair, outline=outline)
            draw.point((16, y - 4), fill=PALETTE["sunset_gold"])
        elif cfg["hair_style"] == "curly":
            draw.rectangle([9, y - 3, 22, y + 4], fill=hair)
            draw.ellipse([8, y - 2, 12, y + 2], fill=hair)
            draw.ellipse([13, y - 4, 18, y], fill=hair)
            draw.ellipse([19, y - 2, 23, y + 2], fill=hair)
            draw.point((11, y - 1), fill=cfg["hair_accent"])
            draw.point((16, y - 2), fill=cfg["hair_accent"])
        else:  # slick (Marco)
            draw.rectangle([9, y - 3, 22, y + 3], fill=hair)
            draw.rectangle([9, y + 3, 11, y + 6], fill=hair)
            draw.line([(10, y - 2), (21, y - 2)], fill=cfg["hair_accent"])

        draw.line([(9, y - 2), (22, y - 2)], fill=outline)

        # Eyes (shifted right for SE 3/4 isometric perspective)
        draw.rectangle([14, y + 5, 15, y + 7], fill=PALETTE["white"])
        draw.rectangle([18, y + 5, 19, y + 7], fill=PALETTE["white"])
        draw.point((15, y + 6), fill=PALETTE["void_black"])
        draw.point((19, y + 6), fill=PALETTE["void_black"])
        draw.line([(14, y + 4), (16, y + 4)], fill=cfg["hair_dark"])
        draw.line([(18, y + 4), (20, y + 4)], fill=cfg["hair_dark"])

        # Beard or Mouth
        if cfg["beard"]:
            draw.rectangle([12, y + 10, 21, y + 12], fill=cfg["beard_col"])
            draw.line([(14, y + 9), (20, y + 9)], fill=cfg["beard_col"])
            draw.line([(12, y + 12), (21, y + 12)], fill=outline)
        else:
            draw.point((17, y + 8), fill=skin_shadow)
            draw.line([(16, y + 10), (18, y + 10)], fill=skin_shadow)
    else:  # NE (Back of head)
        draw.rectangle([9, y - 2, 22, y + 10], fill=hair)
        draw.rectangle([9, y - 2, 22, y + 10], outline=outline)

        if cfg["hair_style"] == "bun":
            draw.ellipse([13, y - 2, 19, y + 4], fill=hair_dark, outline=outline)
            draw.point((16, y + 1), fill=PALETTE["amber"])
        elif cfg["hair_style"] == "spiky":
            draw.polygon([(10, y - 2), (13, y - 5), (15, y - 2)], fill=hair)
            draw.polygon([(16, y - 2), (19, y - 5), (21, y - 2)], fill=hair)
        elif cfg["hair_style"] == "curly":
            draw.ellipse([10, y + 2, 14, y + 6], fill=hair_dark)
            draw.ellipse([15, y + 1, 19, y + 5], fill=hair_dark)
            draw.ellipse([12, y + 5, 17, y + 9], fill=hair_dark)

        draw.rectangle([12, y + 10, 19, y + 12], fill=skin_shadow)


def draw_char_accessories(draw: ImageDraw.ImageDraw, base_dir: str, bob_y: int, cfg: dict):
    y_head = 14 + bob_y
    y_torso = 28 + bob_y

    if base_dir == "SE":
        # Spectacles
        if cfg["glasses"]:
            g = cfg["glasses_col"]
            draw.rectangle([13, y_head + 5, 16, y_head + 7], outline=g)
            draw.rectangle([17, y_head + 5, 20, y_head + 7], outline=g)
            draw.point((16, y_head + 6), fill=g)
            draw.point((12, y_head + 6), fill=g)

        # Chest Badges & Accessories
        if cfg["badge_type"] == "intern_badge":
            draw.line([(15, y_torso), (16, y_torso + 4)], fill=PALETTE["azure"])
            draw.line([(18, y_torso), (17, y_torso + 4)], fill=PALETTE["azure"])
            draw.rectangle([15, y_torso + 4, 18, y_torso + 8], fill=PALETTE["white"], outline=PALETTE["void_black"])
            draw.point((16, y_torso + 5), fill=PALETTE["cyan"])
        elif cfg["badge_type"] == "key":
            draw.ellipse([19, y_torso + 12, 21, y_torso + 14], fill=PALETTE["amber"])
            draw.line([(20, y_torso + 14), (20, y_torso + 17)], fill=PALETTE["amber"])
            draw.point((21, y_torso + 16), fill=PALETTE["amber"])
        elif cfg["badge_type"] == "console_cable":
            draw.arc([19, y_torso + 11, 23, y_torso + 15], 0, 360, fill=PALETTE["cyan"])
            draw.line([(21, y_torso + 14), (21, y_torso + 17)], fill=PALETTE["cyan"])
        elif cfg["badge_type"] == "tool_pouch":
            draw.rectangle([19, y_torso + 12, 22, y_torso + 16], fill=PALETTE["amber"], outline=PALETTE["void_black"])
            draw.point((20, y_torso + 13), fill=PALETTE["matrix_green"])

        # Headset / Pocket Badges
        if cfg["prop"] == "headset":
            draw.arc([9, y_head + 2, 22, y_head + 9], 180, 360, fill=PALETTE["stone"])
            draw.rectangle([8, y_head + 5, 9, y_head + 8], fill=PALETTE["stone"])
            draw.line([(9, y_head + 8), (14, y_head + 10)], fill=PALETTE["stone"])
            draw.point((14, y_head + 10), fill=PALETTE["matrix_green"])
        elif cfg["prop"] == "ccna_badge":
            draw.rectangle([12, y_torso + 4, 14, y_torso + 6], fill=PALETTE["cyan"], outline=PALETTE["void_black"])
    else:  # NE
        if cfg["prop"] == "notebook":
            draw.rectangle([21, y_torso + 6, 24, y_torso + 12], fill=PALETTE["matrix_green"], outline=PALETTE["void_black"])
            draw.line([(22, y_torso + 7), (24, y_torso + 7)], fill=PALETTE["white"])
        elif cfg["badge_type"] == "console_cable":
            draw.arc([19, y_torso + 11, 23, y_torso + 15], 0, 360, fill=PALETTE["cyan"])


def draw_character_frame(char_type: str, direction: str, anim_frame: int) -> Image.Image:
    base_dir = "SE" if direction in ["SE", "SW"] else "NE"
    is_mirrored = (direction in ["SW", "NW"])
    cfg = get_character_config(char_type)

    img = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    bob_y = 0
    l_leg_dx, l_leg_dy = 0, 0
    r_leg_dx, r_leg_dy = 0, 0
    l_arm_dy, r_arm_dy = 0, 0

    if anim_frame == 1:
        bob_y = 1
        l_leg_dx, l_leg_dy = -1, -2
        r_leg_dx, r_leg_dy = 1, 1
        l_arm_dy = 2
        r_arm_dy = -2
    elif anim_frame == 2:
        bob_y = -1
        l_leg_dx, l_leg_dy = 0, 0
        r_leg_dx, r_leg_dy = 0, -1
        l_arm_dy = 0
        r_arm_dy = 0
    elif anim_frame == 3:
        bob_y = 1
        l_leg_dx, l_leg_dy = 1, 1
        r_leg_dx, r_leg_dy = -1, -2
        l_arm_dy = -2
        r_arm_dy = 2
    elif anim_frame == 4:
        bob_y = -1
        l_leg_dx, l_leg_dy = 0, -1
        r_leg_dx, r_leg_dy = 0, 0
        l_arm_dy = 0
        r_arm_dy = 0

    # Back Arm
    draw_char_arm(draw, 6, 29 + bob_y + l_arm_dy, cfg, is_front=False)
    # Legs & Shoes
    draw_char_legs(draw, base_dir, bob_y, l_leg_dx, l_leg_dy, r_leg_dx, r_leg_dy, cfg)
    # Torso
    draw_char_torso(draw, base_dir, bob_y, cfg)
    # Front Arm
    draw_char_arm(draw, 22, 29 + bob_y + r_arm_dy, cfg, is_front=True)
    # Head & Face
    draw_char_head(draw, base_dir, bob_y, cfg)
    # Accessories
    draw_char_accessories(draw, base_dir, bob_y, cfg)

    if is_mirrored:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)

    return img


def create_character_sheet(char_type: str) -> Image.Image:
    sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))
    for row_idx, direction in enumerate(["SE", "SW", "NE", "NW"]):
        for col_idx in range(CHAR_COLS):
            frame = draw_character_frame(char_type, direction, col_idx)
            x_pos = col_idx * FRAME_W
            y_pos = row_idx * FRAME_H
            sheet.paste(frame, (x_pos, y_pos), frame)
    return sheet


# ============================================================================
# 3. EXPRESSION PORTRAITS GENERATOR (explorer_m1_2 spec)
# ============================================================================

def draw_cyber_frame(draw: ImageDraw.ImageDraw, size: int = 64):
    c_frame = PALETTE["cyan"]
    c_corner = PALETTE["gold"]
    draw.rectangle([0, 0, size - 1, size - 1], outline=c_frame)
    draw.line([(0, 0), (7, 0)], fill=c_corner)
    draw.line([(0, 0), (0, 7)], fill=c_corner)
    draw.line([(size - 8, 0), (size - 1, 0)], fill=c_corner)
    draw.line([(size - 1, 0), (size - 1, 7)], fill=c_corner)
    draw.line([(0, size - 8), (0, size - 1)], fill=c_corner)
    draw.line([(0, size - 1), (7, size - 1)], fill=c_corner)
    draw.line([(size - 8, size - 1), (size - 1, size - 1)], fill=c_corner)
    draw.line([(size - 1, size - 8), (size - 1, size - 1)], fill=c_corner)
    draw.rectangle([28, 0, 35, 1], fill=c_corner)


def render_protagonist_portrait(expression="neutral", cyber_frame=False, size=64) -> Image.Image:
    img = Image.new("RGBA", (size, size), PALETTE["transparent"])
    draw = ImageDraw.Draw(img)

    # Torso / Bust
    draw.polygon([(8, 63), (16, 47), (47, 47), (55, 63)], fill=PALETTE["navy"])
    draw.polygon([(8, 63), (16, 47), (25, 49), (20, 63)], fill=PALETTE["cyan"])
    draw.polygon([(55, 63), (47, 47), (38, 49), (43, 63)], fill=PALETTE["cyan"])
    draw.polygon([(25, 49), (32, 57), (38, 49), (32, 46)], fill=PALETTE["white"])
    draw.line([(28, 52), (28, 61)], fill=PALETTE["light_stone"])
    draw.line([(35, 52), (35, 61)], fill=PALETTE["light_stone"])

    # Intern Badge Clip
    draw.rectangle([17, 53, 23, 61], fill=PALETTE["white"], outline=PALETTE["slate_dark"])
    draw.rectangle([18, 54, 22, 55], fill=PALETTE["cyan"])
    draw.point([(19, 57), (21, 57)], fill=PALETTE["slate_dark"])

    # Neck
    draw.rectangle([28, 41, 35, 48], fill=PALETTE["gold"])
    draw.rectangle([28, 45, 35, 48], fill=PALETTE["oak_light"])

    # Head & Ears
    draw.rectangle([18, 27, 20, 34], fill=PALETTE["gold"])
    draw.rectangle([43, 27, 45, 34], fill=PALETTE["gold"])
    draw.point([(19, 29), (44, 29)], fill=PALETTE["oak_light"])
    draw.rectangle([21, 21, 42, 39], fill=PALETTE["gold"])
    draw.polygon([(21, 39), (26, 44), (37, 44), (42, 39)], fill=PALETTE["gold"])
    draw.rectangle([29, 43, 34, 44], fill=PALETTE["oak_light"])

    # Nose
    draw.rectangle([31, 30, 32, 33], fill=PALETTE["oak_light"])

    # Expression details
    if expression == "neutral":
        draw.line([(24, 21), (28, 21)], fill=PALETTE["slate_dark"], width=1)
        draw.line([(35, 21), (39, 21)], fill=PALETTE["slate_dark"], width=1)
        draw.rectangle([24, 24, 28, 27], fill=PALETTE["white"])
        draw.rectangle([35, 24, 39, 27], fill=PALETTE["white"])
        draw.rectangle([26, 25, 28, 27], fill=PALETTE["slate_dark"])
        draw.rectangle([37, 25, 39, 27], fill=PALETTE["slate_dark"])
        draw.point([(26, 25), (37, 25)], fill=PALETTE["white"])
        draw.line([(29, 37), (34, 37)], fill=PALETTE["brick_dark"])
        draw.point([(35, 36)], fill=PALETTE["brick_dark"])
    elif expression == "tense":
        draw.line([(23, 20), (28, 23)], fill=PALETTE["void_black"], width=2)
        draw.line([(35, 23), (40, 20)], fill=PALETTE["void_black"], width=2)
        draw.rectangle([23, 23, 29, 28], fill=PALETTE["white"])
        draw.rectangle([34, 23, 40, 28], fill=PALETTE["white"])
        draw.rectangle([26, 25, 28, 27], fill=PALETTE["void_black"])
        draw.rectangle([36, 25, 38, 27], fill=PALETTE["void_black"])
        draw.rectangle([28, 36, 35, 39], fill=PALETTE["white"], outline=PALETTE["void_black"])
        draw.line([(29, 38), (34, 38)], fill=PALETTE["slate_dark"])
        draw.polygon([(44, 21), (45, 24), (43, 24)], fill=PALETTE["cyan"])
        draw.point([(44, 23)], fill=PALETTE["white"])
    elif expression == "satisfied":
        draw.line([(24, 19), (28, 20)], fill=PALETTE["slate_dark"])
        draw.line([(35, 20), (39, 19)], fill=PALETTE["slate_dark"])
        draw.line([(24, 25), (26, 23), (28, 25)], fill=PALETTE["void_black"], width=1)
        draw.line([(35, 25), (37, 23), (39, 25)], fill=PALETTE["void_black"], width=1)
        draw.polygon([(28, 35), (35, 35), (34, 39), (29, 39)], fill=PALETTE["white"], outline=PALETTE["brick_dark"])
        draw.rectangle([22, 28, 24, 29], fill=PALETTE["warning_amber"])
        draw.rectangle([39, 28, 41, 29], fill=PALETTE["warning_amber"])
        draw.point([(47, 18), (48, 17), (48, 19), (49, 18)], fill=PALETTE["gold"])

    # Hair
    draw.polygon([(19, 23), (19, 13), (32, 9), (44, 13), (44, 23), (41, 14), (28, 11), (21, 16)], fill=PALETTE["brick_dark"])
    draw.polygon([(20, 15), (25, 24), (28, 15)], fill=PALETTE["oak_light"])
    draw.polygon([(26, 14), (32, 22), (36, 14)], fill=PALETTE["oak_light"])
    draw.polygon([(34, 14), (41, 22), (43, 15)], fill=PALETTE["brick_dark"])
    draw.rectangle([20, 21, 22, 29], fill=PALETTE["brick_dark"])
    draw.rectangle([41, 21, 43, 29], fill=PALETTE["brick_dark"])
    draw.line([(26, 11), (37, 11)], fill=PALETTE["gold"])

    if cyber_frame:
        draw_cyber_frame(draw, size)
    return img


def render_rosaria_portrait(expression="neutral", cyber_frame=False, size=64) -> Image.Image:
    img = Image.new("RGBA", (size, size), PALETTE["transparent"])
    draw = ImageDraw.Draw(img)

    # Hair Silhouette
    draw.ellipse([13, 7, 50, 44], fill=PALETTE["void_black"])
    draw.ellipse([11, 12, 21, 24], fill=PALETTE["brick_dark"])
    draw.ellipse([9, 20, 19, 32], fill=PALETTE["brick_dark"])
    draw.ellipse([10, 29, 20, 42], fill=PALETTE["brick_dark"])
    draw.ellipse([12, 38, 22, 48], fill=PALETTE["void_black"])
    draw.ellipse([42, 12, 52, 24], fill=PALETTE["brick_dark"])
    draw.ellipse([44, 20, 54, 32], fill=PALETTE["brick_dark"])
    draw.ellipse([43, 29, 53, 42], fill=PALETTE["brick_dark"])
    draw.ellipse([41, 38, 51, 48], fill=PALETTE["void_black"])
    draw.ellipse([16, 5, 29, 17], fill=PALETTE["brick_light"])
    draw.ellipse([25, 4, 38, 16], fill=PALETTE["oak_light"])
    draw.ellipse([34, 5, 47, 17], fill=PALETTE["brick_light"])

    # Torso
    draw.polygon([(8, 63), (16, 47), (47, 47), (55, 63)], fill=PALETTE["brick_dark"])
    draw.polygon([(26, 48), (32, 59), (37, 48), (32, 45)], fill=PALETTE["white"])
    draw.line([(28, 49), (32, 54), (35, 49)], fill=PALETTE["gold"])
    draw.point([(32, 54)], fill=PALETTE["warning_amber"])

    # Neck
    draw.rectangle([28, 41, 35, 48], fill=PALETTE["gold"])
    draw.rectangle([28, 45, 35, 48], fill=PALETTE["oak_light"])

    # Face Base
    draw.rectangle([22, 21, 41, 38], fill=PALETTE["gold"])
    draw.polygon([(22, 38), (27, 44), (36, 44), (41, 38)], fill=PALETTE["gold"])
    draw.rectangle([29, 43, 34, 44], fill=PALETTE["oak_light"])

    # Ears & Earring
    draw.rectangle([20, 28, 22, 34], fill=PALETTE["gold"])
    draw.ellipse([18, 32, 22, 37], outline=PALETTE["gold"])

    # Forehead curls
    draw.ellipse([21, 13, 28, 20], fill=PALETTE["brick_light"])
    draw.ellipse([27, 12, 36, 19], fill=PALETTE["oak_light"])
    draw.ellipse([34, 13, 42, 20], fill=PALETTE["brick_light"])

    # Nose
    draw.rectangle([31, 30, 32, 33], fill=PALETTE["oak_light"])

    # Glasses
    c_glasses = PALETTE["cyan"]
    draw.rectangle([23, 23, 29, 28], outline=c_glasses)
    draw.rectangle([24, 24, 28, 27], fill=PALETTE["white"])
    draw.rectangle([34, 23, 40, 28], outline=c_glasses)
    draw.rectangle([35, 24, 39, 27], fill=PALETTE["white"])
    draw.line([(29, 24), (34, 24)], fill=c_glasses)

    # Expression details
    if expression == "neutral":
        draw.rectangle([25, 25, 27, 27], fill=PALETTE["slate_dark"])
        draw.rectangle([36, 25, 38, 27], fill=PALETTE["slate_dark"])
        draw.point([(25, 25), (36, 25)], fill=PALETTE["white"])
        draw.line([(29, 37), (34, 37)], fill=PALETTE["brick_light"])
        draw.point([(34, 36)], fill=PALETTE["brick_light"])
    elif expression == "tense":
        draw.line([(23, 21), (28, 23)], fill=PALETTE["void_black"], width=2)
        draw.line([(35, 23), (40, 21)], fill=PALETTE["void_black"], width=2)
        draw.rectangle([25, 25, 27, 26], fill=PALETTE["void_black"])
        draw.rectangle([36, 25, 38, 26], fill=PALETTE["void_black"])
        draw.line([(29, 38), (34, 37)], fill=PALETTE["void_black"])
        draw.point([(42, 25), (43, 26)], fill=PALETTE["warning_amber"])
    elif expression == "satisfied":
        draw.line([(24, 26), (26, 24), (28, 26)], fill=PALETTE["slate_dark"], width=1)
        draw.line([(35, 26), (37, 24), (39, 26)], fill=PALETTE["slate_dark"], width=1)
        draw.polygon([(28, 35), (35, 35), (34, 39), (29, 39)], fill=PALETTE["white"], outline=PALETTE["brick_light"])
        draw.point([(23, 23), (24, 23), (24, 24)], fill=PALETTE["white"])

    if cyber_frame:
        draw_cyber_frame(draw, size)
    return img


def render_ciro_portrait(expression="neutral", cyber_frame=False, size=64) -> Image.Image:
    img = Image.new("RGBA", (size, size), PALETTE["transparent"])
    draw = ImageDraw.Draw(img)

    # Torso
    draw.polygon([(8, 63), (16, 47), (47, 47), (55, 63)], fill=PALETTE["napoli"])
    draw.polygon([(25, 47), (32, 55), (38, 47)], fill=PALETTE["white"])
    draw.rectangle([31, 55, 32, 60], fill=PALETTE["deep_blue"])
    draw.point([(32, 56), (32, 58)], fill=PALETTE["white"])

    # Neck
    draw.rectangle([28, 41, 35, 48], fill=PALETTE["gold"])
    draw.rectangle([28, 45, 35, 48], fill=PALETTE["oak_light"])

    # Head Base & Ears
    draw.rectangle([19, 27, 21, 34], fill=PALETTE["gold"])
    draw.rectangle([42, 27, 44, 34], fill=PALETTE["gold"])
    draw.rectangle([22, 21, 41, 39], fill=PALETTE["gold"])
    draw.polygon([(22, 39), (27, 44), (36, 44), (41, 39)], fill=PALETTE["gold"])
    draw.rectangle([29, 43, 34, 44], fill=PALETTE["oak_light"])

    # Hair
    draw.polygon([(20, 21), (21, 13), (32, 10), (42, 13), (43, 21), (39, 15), (23, 15)], fill=PALETTE["void_black"])
    draw.rectangle([21, 13, 42, 16], fill=PALETTE["slate_dark"])

    # Headset
    draw.arc([16, 7, 46, 33], start=180, end=340, fill=PALETTE["light_stone"], width=2)
    draw.rectangle([42, 24, 46, 31], fill=PALETTE["slate_dark"], outline=PALETTE["void_black"])
    led_color = PALETTE["threat_red"] if expression == "tense" else PALETTE["matrix_green"]
    draw.rectangle([44, 26, 45, 27], fill=led_color)
    draw.line([(44, 31), (43, 36), (36, 37)], fill=PALETTE["light_stone"], width=1)
    draw.rectangle([33, 36, 35, 38], fill=PALETTE["slate_dark"])

    # Nose
    draw.rectangle([31, 30, 32, 33], fill=PALETTE["oak_light"])

    # Expression details
    if expression == "neutral":
        draw.line([(24, 22), (28, 22)], fill=PALETTE["void_black"])
        draw.line([(35, 20), (39, 19)], fill=PALETTE["void_black"])
        draw.rectangle([24, 24, 28, 27], fill=PALETTE["white"])
        draw.rectangle([35, 23, 39, 26], fill=PALETTE["white"])
        draw.rectangle([25, 25, 27, 27], fill=PALETTE["slate_dark"])
        draw.rectangle([36, 24, 38, 26], fill=PALETTE["slate_dark"])
        draw.line([(28, 37), (32, 37)], fill=PALETTE["brick_dark"])
        draw.point([(33, 36)], fill=PALETTE["brick_dark"])
    elif expression == "tense":
        draw.line([(23, 20), (28, 23)], fill=PALETTE["void_black"], width=2)
        draw.line([(35, 23), (40, 20)], fill=PALETTE["void_black"], width=2)
        draw.rectangle([23, 23, 29, 27], fill=PALETTE["white"])
        draw.rectangle([34, 23, 40, 27], fill=PALETTE["white"])
        draw.rectangle([25, 24, 27, 26], fill=PALETTE["void_black"])
        draw.rectangle([36, 24, 38, 26], fill=PALETTE["void_black"])
        draw.polygon([(28, 36), (32, 36), (31, 40), (28, 39)], fill=PALETTE["void_black"])
        draw.point([(29, 37)], fill=PALETTE["white"])
        draw.polygon([(20, 22), (21, 25), (19, 25)], fill=PALETTE["cyan"])
    elif expression == "satisfied":
        draw.line([(24, 20), (28, 21)], fill=PALETTE["void_black"])
        draw.line([(35, 21), (39, 20)], fill=PALETTE["void_black"])
        draw.line([(24, 25), (26, 23), (28, 25)], fill=PALETTE["void_black"], width=1)
        draw.line([(35, 25), (37, 23), (39, 25)], fill=PALETTE["void_black"], width=1)
        draw.polygon([(27, 35), (33, 35), (32, 39), (28, 39)], fill=PALETTE["white"], outline=PALETTE["brick_dark"])
        draw.rectangle([22, 28, 24, 29], fill=PALETTE["warning_amber"])

    if cyber_frame:
        draw_cyber_frame(draw, size)
    return img


def render_marco_portrait(expression="neutral", cyber_frame=False, size=64) -> Image.Image:
    img = Image.new("RGBA", (size, size), PALETTE["transparent"])
    draw = ImageDraw.Draw(img)

    # Torso
    draw.polygon([(8, 63), (16, 47), (47, 47), (55, 63)], fill=PALETTE["navy"])
    draw.polygon([(26, 47), (32, 54), (37, 47)], fill=PALETTE["white"])

    # Lanyard
    draw.line([(22, 47), (29, 55)], fill=PALETTE["napoli"], width=2)
    draw.line([(41, 47), (34, 55)], fill=PALETTE["napoli"], width=2)
    draw.point([(25, 50), (38, 50)], fill=PALETTE["cyan"])
    draw.rectangle([30, 55, 33, 57], fill=PALETTE["light_stone"])
    draw.rectangle([28, 57, 35, 63], fill=PALETTE["white"], outline=PALETTE["slate_dark"])
    draw.rectangle([29, 58, 34, 59], fill=PALETTE["cyan"])

    # Neck
    draw.rectangle([28, 41, 35, 48], fill=PALETTE["gold"])

    # Face Base
    draw.rectangle([22, 21, 41, 39], fill=PALETTE["gold"])
    draw.rectangle([19, 25, 21, 32], fill=PALETTE["gold"])
    draw.rectangle([42, 25, 44, 32], fill=PALETTE["gold"])

    # Hair
    draw.polygon([(20, 21), (22, 12), (32, 9), (41, 12), (43, 21), (39, 15), (23, 15)], fill=PALETTE["void_black"])
    draw.line([(26, 11), (37, 11)], fill=PALETTE["light_stone"])

    # Glasses
    c_glasses = PALETTE["slate_dark"]
    draw.rectangle([23, 22, 29, 26], outline=c_glasses)
    draw.rectangle([24, 23, 28, 25], fill=PALETTE["white"])
    draw.rectangle([34, 22, 40, 26], outline=c_glasses)
    draw.rectangle([35, 23, 39, 25], fill=PALETTE["white"])
    draw.line([(29, 23), (34, 23)], fill=c_glasses)

    # Beard
    c_beard = PALETTE["void_black"]
    draw.rectangle([21, 24, 23, 35], fill=c_beard)
    draw.rectangle([40, 24, 42, 35], fill=c_beard)
    draw.polygon([(21, 35), (25, 43), (38, 43), (42, 35)], fill=c_beard)
    draw.rectangle([27, 32, 36, 34], fill=c_beard)

    # Nose
    draw.rectangle([31, 28, 32, 31], fill=PALETTE["oak_light"])

    # Expression details
    if expression == "neutral":
        draw.line([(23, 20), (29, 20)], fill=PALETTE["slate_dark"], width=1)
        draw.line([(34, 20), (40, 20)], fill=PALETTE["slate_dark"], width=1)
        draw.rectangle([25, 23, 27, 25], fill=PALETTE["void_black"])
        draw.rectangle([36, 23, 38, 25], fill=PALETTE["void_black"])
        draw.point([(25, 23), (36, 23)], fill=PALETTE["white"])
        draw.line([(29, 36), (34, 36)], fill=PALETTE["brick_dark"])
    elif expression == "tense":
        draw.line([(23, 19), (29, 22)], fill=PALETTE["void_black"], width=2)
        draw.line([(34, 22), (40, 19)], fill=PALETTE["void_black"], width=2)
        draw.rectangle([23, 22, 29, 26], fill=PALETTE["white"])
        draw.rectangle([34, 22, 40, 26], fill=PALETTE["white"])
        draw.rectangle([25, 23, 27, 25], fill=PALETTE["void_black"])
        draw.rectangle([36, 23, 38, 25], fill=PALETTE["void_black"])
        draw.rectangle([29, 35, 34, 37], fill=PALETTE["white"], outline=PALETTE["void_black"])
        draw.point([(43, 20), (44, 21)], fill=PALETTE["warning_amber"])
    elif expression == "satisfied":
        draw.line([(24, 24), (26, 22), (28, 24)], fill=PALETTE["void_black"], width=1)
        draw.line([(35, 24), (37, 22), (39, 24)], fill=PALETTE["void_black"], width=1)
        draw.polygon([(28, 35), (35, 35), (34, 38), (29, 38)], fill=PALETTE["white"])
        draw.point([(24, 22), (25, 22)], fill=PALETTE["white"])

    if cyber_frame:
        draw_cyber_frame(draw, size)
    return img


def render_secbot_portrait(expression="neutral", cyber_frame=False, size=64) -> Image.Image:
    img = Image.new("RGBA", (size, size), PALETTE["transparent"])
    draw = ImageDraw.Draw(img)

    # Chassis
    draw.polygon([(16, 12), (47, 12), (54, 24), (54, 48), (47, 56), (16, 56), (9, 48), (9, 24)], fill=PALETTE["light_stone"])
    draw.rectangle([14, 16, 49, 52], fill=PALETTE["slate_dark"])
    draw.rectangle([16, 18, 47, 50], fill=PALETTE["void_black"])

    # Antenna
    draw.line([(31, 4), (31, 12)], fill=PALETTE["light_stone"], width=2)
    antenna_light = PALETTE["threat_red"] if expression == "tense" else PALETTE["cyan"]
    draw.rectangle([30, 2, 33, 5], fill=antenna_light)

    # Visor
    if expression == "neutral":
        g = PALETTE["matrix_green"]
        draw.line([(20, 32), (26, 32)], fill=g, width=2)
        draw.line([(37, 32), (43, 32)], fill=g, width=2)
        draw.line([(28, 40), (35, 40)], fill=g, width=2)
    elif expression == "tense":
        r = PALETTE["threat_red"]
        draw.line([(23, 28), (23, 34)], fill=r, width=2)
        draw.point([(23, 36)], fill=r)
        draw.line([(40, 28), (40, 34)], fill=r, width=2)
        draw.point([(40, 36)], fill=r)
        draw.line([(27, 41), (30, 39), (33, 42), (36, 40)], fill=r, width=2)
    elif expression == "satisfied":
        c = PALETTE["cyan"]
        draw.line([(20, 33), (23, 29), (26, 33)], fill=c, width=2)
        draw.line([(37, 33), (40, 29), (43, 33)], fill=c, width=2)
        draw.arc([28, 36, 36, 44], start=0, end=180, fill=c, width=2)

    if cyber_frame:
        draw_cyber_frame(draw, size)
    return img


PORTRAIT_GENERATORS = {
    "protagonist": render_protagonist_portrait,
    "rosaria": render_rosaria_portrait,
    "ciro": render_ciro_portrait,
    "marco": render_marco_portrait,
    "secbot": render_secbot_portrait,
}


# ============================================================================
# 4. ENVIRONMENT TILES & WALLS GENERATOR (explorer_m1_3 spec)
# ============================================================================

def get_iso_tile_coords(w=64, h=32):
    bounds = []
    for y in range(h):
        if y < h // 2:
            x0 = 31 - 2 * y
            x1 = 32 + 2 * y
        else:
            dy = (h - 1) - y
            x0 = 31 - 2 * dy
            x1 = 32 + 2 * dy
        bounds.append((x0, x1))
    return bounds


def draw_dither_shadow(draw, pixels, bbox, c_shadow=PALETTE["void"]):
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) / 2.0
    cy = (y0 + y1) / 2.0
    rx = (x1 - x0) / 2.0
    ry = (y1 - y0) / 2.0
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                if (x + y) % 2 == 0:
                    pixels[x, y] = c_shadow


def draw_tile_parquet() -> Image.Image:
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    pixels = img.load()
    bounds = get_iso_tile_coords(64, 32)
    c_base, c_dark, c_edge, c_gold = PALETTE["oak_light"], PALETTE["oak_dark"], PALETTE["terracotta_dark"], PALETTE["gold"]
    for y in range(32):
        x0, x1 = bounds[y]
        for x in range(x0, x1 + 1):
            if x in (x0, x0 + 1, x1 - 1, x1) or y in (0, 31):
                pixels[x, y] = c_edge
                continue
            stripe = (x + 2 * y) // 8
            sub_grain = (x - 2 * y) % 6
            color = (c_gold if sub_grain == 0 else c_base) if stripe % 2 == 0 else (c_edge if sub_grain == 3 else c_dark)
            if ((x - 2 * y) % 16 == 0 and stripe % 2 == 0) or ((x + 2 * y) % 16 == 0 and stripe % 2 == 1):
                color = c_edge
            pixels[x, y] = color
    return img


def draw_tile_corridor() -> Image.Image:
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    pixels = img.load()
    bounds = get_iso_tile_coords(64, 32)
    c_base, c_joint, c_light, c_accent = PALETTE["stone"], PALETTE["slate"], PALETTE["white"], PALETTE["navy"]
    for y in range(32):
        x0, x1 = bounds[y]
        for x in range(x0, x1 + 1):
            if x in (x0, x1) or y in (0, 31) or abs(x - 31.5) < 1.0 or abs(y - 15.5) < 1.0:
                pixels[x, y] = c_joint
            elif (x + y) % 7 == 0:
                pixels[x, y] = c_accent
            elif (x * 3 + y * 5) % 11 == 0:
                pixels[x, y] = c_light
            else:
                pixels[x, y] = c_base
    return img


def draw_tile_server_grill() -> Image.Image:
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    pixels = img.load()
    bounds = get_iso_tile_coords(64, 32)
    c_metal, c_rim, c_void, c_cyan, c_blue = PALETTE["slate"], PALETTE["stone"], PALETTE["void"], PALETTE["cyan"], PALETTE["azzurro"]
    for y in range(32):
        x0, x1 = bounds[y]
        for x in range(x0, x1 + 1):
            if x in (x0, x0 + 1, x1 - 1, x1) or y in (0, 1, 30, 31):
                pixels[x, y] = c_metal
                continue
            is_corner = (y < 6 and abs(x - 31.5) < 6) or (y > 25 and abs(x - 31.5) < 6) or (abs(y - 15.5) < 4 and (x < 8 or x > 55))
            if is_corner:
                pixels[x, y] = c_rim if (x + y) % 2 == 0 else c_metal
                continue
            dist = abs(x - 31.5) / 28.0 + abs(y - 15.5) / 14.0
            if y % 3 == 0:
                pixels[x, y] = c_metal
            elif (x + y) % 4 == 0:
                pixels[x, y] = c_cyan if dist < 0.6 else c_blue
            elif (x + y) % 4 == 1:
                pixels[x, y] = c_blue if dist < 0.8 else c_void
            else:
                pixels[x, y] = c_void
    return img


def draw_tile_server_solid() -> Image.Image:
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    pixels = img.load()
    bounds = get_iso_tile_coords(64, 32)
    c_frame, c_panel, c_screw, c_accent = PALETTE["slate"], PALETTE["navy"], PALETTE["stone"], PALETTE["azzurro"]
    for y in range(32):
        x0, x1 = bounds[y]
        for x in range(x0, x1 + 1):
            if x in (x0, x0 + 1, x1 - 1, x1) or y in (0, 31):
                pixels[x, y] = c_frame
            elif x in (x0 + 2, x1 - 2) or y in (1, 30):
                pixels[x, y] = c_accent
            elif (y in (3, 4, 27, 28) and abs(x - 31.5) in (4, 5, 6)) or (abs(y - 15.5) in (2, 3) and x in (8, 9, 54, 55)):
                pixels[x, y] = c_screw
            else:
                pixels[x, y] = c_panel
    return img


def draw_wall_left(w=64, h=80) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels = img.load()
    c_light, c_dark, c_mortar, c_base, c_cap, c_top = (
        PALETTE["terracotta_light"],
        PALETTE["terracotta_dark"],
        PALETTE["slate"],
        PALETTE["oak_dark"],
        PALETTE["stone"],
        PALETTE["white"],
    )
    for x in range(32):
        bot_y, top_y = 48 + x // 2, 16 + x // 2
        for y in range(top_y, bot_y + 1):
            if y >= bot_y - 3:
                pixels[x, y] = c_base
                continue
            if y <= top_y + 2:
                pixels[x, y] = c_cap
                continue
            rel_y = y - top_y
            if rel_y % 5 == 0:
                pixels[x, y] = c_mortar
                continue
            brick_x = (x + ((rel_y // 5) % 2) * 6) % 12
            pixels[x, y] = c_mortar if brick_x == 0 else (c_dark if (x + y) % 9 == 0 else c_light)
    for x in range(32):
        top_y = 16 + x // 2
        for t in range(1, 10):
            tx, ty = x + t, top_y - t // 2
            if 0 <= tx < w and 0 <= ty < h and pixels[tx, ty][3] == 0:
                pixels[tx, ty] = c_top if t == 1 else c_cap
    return img


def draw_wall_right(w=64, h=80) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels = img.load()
    c_dark, c_mortar, c_base, c_cap, c_shadow = (
        PALETTE["terracotta_dark"],
        PALETTE["slate"],
        PALETTE["oak_dark"],
        PALETTE["stone"],
        PALETTE["void"],
    )
    for x in range(32, 64):
        dx = x - 32
        bot_y, top_y = 64 - dx // 2, 32 - dx // 2
        for y in range(top_y, bot_y + 1):
            if y >= bot_y - 3:
                pixels[x, y] = c_base
                continue
            if y <= top_y + 2:
                pixels[x, y] = c_cap
                continue
            rel_y = y - top_y
            if rel_y % 5 == 0:
                pixels[x, y] = c_mortar
                continue
            brick_x = (dx + ((rel_y // 5) % 2) * 6) % 12
            pixels[x, y] = c_mortar if brick_x == 0 else (c_shadow if (x + y) % 5 == 0 else c_dark)
    for x in range(32, 64):
        dx = x - 32
        top_y = 32 - dx // 2
        for t in range(1, 10):
            tx, ty = x - t, top_y - t // 2
            if 0 <= tx < w and 0 <= ty < h and pixels[tx, ty][3] == 0:
                pixels[tx, ty] = c_cap
    return img


def draw_door_frame(w=64, h=80) -> Image.Image:
    img = draw_wall_left(w, h)
    pixels = img.load()
    c_frame, c_wood, c_led_green, c_led_blue = PALETTE["slate"], PALETTE["oak_light"], PALETTE["green"], PALETTE["cyan"]
    for x in range(8, 25):
        for y in range(16 + x // 2 + 10, 48 + x // 2 + 1):
            pixels[x, y] = (0, 0, 0, 0)
    for y in range(16 + 8 // 2 + 8, 48 + 8 // 2 + 1):
        pixels[7, y] = c_frame
        pixels[8, y] = c_wood
    for y in range(16 + 24 // 2 + 8, 48 + 24 // 2 + 1):
        pixels[24, y] = c_wood
        pixels[25, y] = c_frame
    for x in range(7, 26):
        ly = 16 + x // 2 + 8
        pixels[x, ly] = c_frame
        pixels[x, ly + 1] = c_wood
    pixels[26, 36] = c_frame
    pixels[27, 36] = c_frame
    pixels[26, 37] = c_led_green
    pixels[27, 37] = c_led_blue
    return img


def assemble_tileset_iso(tiles: dict) -> Image.Image:
    sheet = Image.new("RGBA", (256, 112), (0, 0, 0, 0))
    sheet.paste(tiles["tile_parquet"], (0, 0))
    sheet.paste(tiles["tile_corridor"], (64, 0))
    sheet.paste(tiles["tile_server_grill"], (128, 0))
    sheet.paste(tiles["tile_server_solid"], (192, 0))
    sheet.paste(tiles["wall_left"], (0, 32))
    sheet.paste(tiles["wall_right"], (64, 32))
    sheet.paste(tiles["door_frame"], (128, 32))
    return sheet


# ============================================================================
# 5. FURNITURE & EQUIPMENT SPRITES GENERATOR (explorer_m1_3 spec)
# ============================================================================

def draw_workstation_desk(w=64, h=64) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)
    draw_dither_shadow(draw, pixels, [8, 46, 56, 60])
    draw.rectangle([14, 34, 16, 52], fill=PALETTE["slate"])
    draw.rectangle([48, 34, 50, 52], fill=PALETTE["slate"])
    draw.rectangle([22, 26, 24, 42], fill=PALETTE["void"])
    draw.rectangle([40, 26, 42, 42], fill=PALETTE["void"])

    draw.polygon([(32, 20), (56, 30), (32, 40), (8, 30)], fill=PALETTE["oak_light"])
    draw.polygon([(8, 30), (32, 40), (32, 43), (8, 33)], fill=PALETTE["oak_dark"])
    draw.polygon([(32, 40), (56, 30), (56, 33), (32, 43)], fill=PALETTE["terracotta_dark"])

    # Chair
    draw.ellipse([26, 30, 38, 36], fill=PALETTE["navy"])
    draw.rectangle([29, 14, 35, 28], fill=PALETTE["navy"])
    draw.line([(29, 14), (35, 14)], fill=PALETTE["cyan"], width=1)
    draw.rectangle([30, 26, 34, 28], fill=PALETTE["void"])
    draw.rectangle([31, 22, 33, 26], fill=PALETTE["stone"])

    # Left CLI monitor
    draw.rectangle([15, 14, 31, 25], fill=PALETTE["void"])
    draw.rectangle([16, 15, 30, 24], fill=PALETTE["slate"])
    pixels[17, 16] = PALETTE["green"]
    pixels[18, 16] = PALETTE["green"]
    pixels[20, 16] = PALETTE["green"]
    pixels[17, 18] = PALETTE["green"]
    pixels[19, 18] = PALETTE["green"]
    pixels[21, 18] = PALETTE["green"]
    pixels[17, 20] = PALETTE["green"]
    pixels[17, 22] = PALETTE["white"]

    # Right Topology monitor
    draw.rectangle([33, 14, 49, 25], fill=PALETTE["void"])
    draw.rectangle([34, 15, 48, 24], fill=PALETTE["slate"])
    pixels[36, 17] = PALETTE["cyan"]
    pixels[45, 17] = PALETTE["cyan"]
    pixels[40, 22] = PALETTE["amber"]
    pixels[38, 19] = PALETTE["cyan"]
    pixels[43, 20] = PALETTE["cyan"]

    draw.rectangle([25, 32, 35, 36], fill=PALETTE["stone"])
    pixels[40, 34] = PALETTE["white"]
    pixels[40, 35] = PALETTE["slate"]
    return img


def draw_network_rack_sw1(w=64, h=80, frame=0) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)
    draw_dither_shadow(draw, pixels, [10, 64, 54, 76])
    draw.polygon([(32, 12), (54, 22), (32, 32), (10, 22)], fill=PALETTE["slate"])
    draw.polygon([(10, 22), (32, 32), (32, 68), (10, 58)], fill=PALETTE["void"])
    draw.polygon([(32, 32), (54, 22), (54, 58), (32, 68)], fill=PALETTE["navy"])
    draw.line([(12, 24), (12, 59)], fill=PALETTE["stone"], width=1)
    draw.line([(30, 31), (30, 67)], fill=PALETTE["stone"], width=1)

    draw.polygon([(13, 27), (29, 34), (29, 41), (13, 34)], fill=PALETTE["slate"])
    for i in range(4):
        cx, cy = 14 + i * 4, 30 + i * 2
        col = PALETTE["azzurro"] if i % 2 == 0 else PALETTE["white"]
        pixels[cx, cy] = col
        pixels[cx + 1, cy + 1] = col
        pixels[cx, cy + 2] = PALETTE["amber"]

    draw.polygon([(13, 37), (29, 44), (29, 52), (13, 45)], fill=PALETTE["deep_blue"])
    pixels[14, 40] = PALETTE["cyan"]
    pixels[15, 40] = PALETTE["cyan"]
    for p in range(6):
        px, py = 16 + p * 2, 41 + p
        pixels[px, py] = PALETTE["green"] if (p + frame) % 2 == 0 else PALETTE["amber"]
        pixels[px, py + 1] = PALETTE["void"]
        pixels[px, py + 2] = PALETTE["green"] if (p * 2 + frame) % 3 == 0 else PALETTE["slate"]
        pixels[px, py + 3] = PALETTE["void"]
    pixels[28, 48] = PALETTE["cyan"]
    pixels[28, 49] = PALETTE["cyan"]

    draw.polygon([(13, 49), (29, 56), (29, 64), (13, 57)], fill=PALETTE["slate"])
    for r in range(5):
        pixels[15 + r * 3, 53 + r] = PALETTE["stone"]
    return img


def draw_server_rack_r1(w=64, h=96, frame=0) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)
    draw_dither_shadow(draw, pixels, [8, 78, 56, 92])
    draw.polygon([(32, 6), (54, 16), (32, 26), (10, 16)], fill=PALETTE["navy"])
    draw.polygon([(10, 16), (32, 26), (32, 82), (10, 72)], fill=PALETTE["void"])
    draw.polygon([(32, 26), (54, 16), (54, 72), (32, 82)], fill=PALETTE["slate"])
    for s in range(6):
        draw.line([(36, 30 + s * 7), (48, 24 + s * 7)], fill=PALETTE["void"], width=1)
    draw.line([(12, 18), (12, 73)], fill=PALETTE["stone"], width=1)
    draw.line([(30, 25), (30, 81)], fill=PALETTE["stone"], width=1)

    # Cisco ISR 4000
    draw.polygon([(13, 20), (29, 27), (29, 36), (13, 29)], fill=PALETTE["deep_blue"])
    pixels[15, 24] = PALETTE["green"]
    pixels[17, 25] = PALETTE["cyan"] if frame % 2 == 0 else PALETTE["slate"]
    pixels[19, 26] = PALETTE["amber"] if frame % 4 == 0 else PALETTE["void"]
    for p in range(4):
        pixels[22 + p * 2, 29 + p] = PALETTE["stone"]
        pixels[22 + p * 2, 30 + p] = PALETTE["green"]

    # Crash cart drawer & console cable
    draw.polygon([(13, 33), (29, 40), (29, 46), (13, 39)], fill=PALETTE["stone"])
    draw.line([(14, 38), (28, 44)], fill=PALETTE["slate"], width=1)
    pixels[25, 43] = PALETTE["cyan"]
    pixels[26, 44] = PALETTE["cyan"]
    pixels[26, 46] = PALETTE["cyan"]
    pixels[27, 47] = PALETTE["cyan"]

    # SAN storage array
    draw.polygon([(13, 44), (29, 51), (29, 68), (13, 61)], fill=PALETTE["slate"])
    for d in range(5):
        dy, dx = 48 + d * 3, 14 + d
        draw.line([(dx, dy), (dx + 12, dy + 5)], fill=PALETTE["void"], width=1)
        pixels[dx + 1, dy] = PALETTE["cyan"] if (d + frame) % 2 == 0 else PALETTE["green"]

    # Base intake
    draw.polygon([(13, 66), (29, 73), (29, 80), (13, 73)], fill=PALETTE["void"])
    for g in range(3):
        pixels[16 + g * 4, 71 + g * 2] = PALETTE["cyan"]
        pixels[17 + g * 4, 72 + g * 2] = PALETTE["azzurro"]
    return img


def draw_bar_napoletano(w=80, h=64, frame=0) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)
    draw_dither_shadow(draw, pixels, [8, 44, 72, 60])
    draw.polygon([(40, 22), (68, 34), (68, 50), (40, 38)], fill=PALETTE["terracotta_dark"])
    draw.polygon([(12, 34), (40, 38), (40, 54), (12, 50)], fill=PALETTE["oak_dark"])
    draw.polygon([(40, 20), (70, 32), (40, 44), (10, 32)], fill=PALETTE["stone"])
    draw.polygon([(10, 32), (40, 44), (40, 46), (10, 34)], fill=PALETTE["white"])
    draw.polygon([(40, 44), (70, 32), (70, 34), (40, 46)], fill=PALETTE["slate"])

    # Faema E61
    draw.polygon([(52, 12), (66, 18), (54, 24), (40, 18)], fill=PALETTE["white"])
    draw.polygon([(40, 18), (54, 24), (54, 32), (40, 26)], fill=PALETTE["stone"])
    draw.polygon([(54, 24), (66, 18), (66, 26), (54, 32)], fill=PALETTE["slate"])
    draw.rectangle([44, 10, 62, 18], fill=PALETTE["white"])
    pixels[45, 23] = PALETTE["gold"]
    pixels[46, 24] = PALETTE["void"]
    pixels[42, 21] = PALETTE["white"]
    pixels[43, 21] = PALETTE["red"]

    # Steaming espresso cup
    draw.rectangle([25, 33, 29, 36], fill=PALETTE["white"])
    pixels[24, 34] = PALETTE["white"]
    pixels[26, 33] = PALETTE["oak_dark"]
    pixels[27, 33] = PALETTE["gold"]
    draw.line([(23, 37), (31, 37)], fill=PALETTE["stone"])
    s_offset = (frame % 3) - 1
    pixels[27 + s_offset, 31] = PALETTE["white"]
    pixels[26 - s_offset, 29] = PALETTE["stone"]
    pixels[28 + s_offset, 27] = PALETTE["stone"]
    pixels[27, 25] = PALETTE["white"]
    return img


def draw_monstera_plant(w=48, h=56) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)
    draw_dither_shadow(draw, pixels, [12, 44, 36, 54])
    draw.ellipse([16, 36, 32, 42], fill=PALETTE["terracotta_light"])
    draw.ellipse([18, 37, 30, 41], fill=PALETTE["void"])
    draw.polygon([(16, 39), (32, 39), (29, 49), (19, 49)], fill=PALETTE["terracotta_dark"])
    draw.line([(24, 38), (24, 20)], fill=PALETTE["slate"], width=2)
    draw.polygon([(20, 10), (28, 10), (32, 16), (24, 24), (16, 16)], fill=PALETTE["green"])
    pixels[20, 14] = (0, 0, 0, 0)
    pixels[28, 14] = (0, 0, 0, 0)
    pixels[24, 12] = PALETTE["cyan"]
    draw.polygon([(8, 14), (18, 12), (20, 20), (12, 24)], fill=PALETTE["green"])
    pixels[13, 16] = (0, 0, 0, 0)
    draw.polygon([(30, 12), (40, 14), (38, 24), (28, 20)], fill=PALETTE["green"])
    pixels[35, 17] = (0, 0, 0, 0)
    return img


def draw_pizza_box(w=32, h=32) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)
    draw.polygon([(16, 14), (28, 20), (16, 26), (4, 20)], fill=PALETTE["gold"])
    draw.polygon([(4, 20), (16, 26), (16, 28), (4, 22)], fill=PALETTE["oak_light"])
    draw.polygon([(16, 26), (28, 20), (28, 22), (16, 28)], fill=PALETTE["oak_light"])
    draw.polygon([(16, 4), (28, 10), (28, 18), (16, 12)], fill=PALETTE["gold"])
    draw.polygon([(4, 10), (16, 4), (16, 12), (4, 18)], fill=PALETTE["oak_light"])
    pixels[16, 8] = PALETTE["red"]
    pixels[17, 8] = PALETTE["red"]
    draw.ellipse([8, 16, 24, 24], fill=PALETTE["oak_dark"])
    draw.ellipse([10, 17, 22, 23], fill=PALETTE["terracotta_light"])
    pixels[13, 19] = PALETTE["white"]
    pixels[18, 20] = PALETTE["white"]
    pixels[16, 20] = PALETTE["green"]
    return img


def assemble_furniture_iso(furniture: dict) -> Image.Image:
    sheet = Image.new("RGBA", (320, 192), (0, 0, 0, 0))
    sheet.paste(furniture["desk"], (0, 0))
    sheet.paste(furniture["rack_sw1_f0"], (64, 0))
    sheet.paste(furniture["server_r1_f0"], (128, 0))
    sheet.paste(furniture["bar_f0"], (192, 0))
    sheet.paste(furniture["monstera"], (272, 0))
    sheet.paste(furniture["pizza_box"], (0, 68))
    sheet.paste(furniture["rack_sw1_f1"], (64, 88))
    sheet.paste(furniture["server_r1_f1"], (128, 96))
    sheet.paste(furniture["bar_f1"], (192, 68))
    return sheet


# ============================================================================
# 6. PANORAMIC VESUVIUS WINDOW VISTAS (320x180 px) & ISOMETRIC WALL WINDOWS (96x80 px)
# ============================================================================

def draw_vesuvius_silhouette(pixels, horizon_y=110, c_mountain=PALETTE["slate"], c_highlight=None):
    vesuvius_points = [
        (125, horizon_y), (150, 92), (165, 75), (175, 74), (188, 82),
        (200, 68), (210, 62), (218, 63), (232, 78), (255, 96), (275, horizon_y)
    ]
    for x in range(125, 276):
        top_y = horizon_y
        for i in range(len(vesuvius_points) - 1):
            xa, ya = vesuvius_points[i]
            xb, yb = vesuvius_points[i + 1]
            if xa <= x <= xb:
                top_y = int(ya + ((x - xa) / max(1, xb - xa)) * (yb - ya))
                break
        for y in range(top_y, horizon_y):
            pixels[x, y] = c_mountain
        if c_highlight and x < 210:
            pixels[x, top_y] = c_highlight
            if top_y + 1 < horizon_y and x % 3 == 0:
                pixels[x, top_y + 1] = c_highlight


def draw_coastline_castel(pixels, horizon_y=110, c_coast=PALETTE["slate"]):
    for x in range(0, 45):
        for y in range(int(95 + (x / 45.0) * (horizon_y - 95)), horizon_y + 4):
            pixels[x, y] = c_coast
    for x in range(45, 68):
        for y in range(102, 114):
            pixels[x, y] = c_coast
    for x in range(47, 67, 4):
        pixels[x, 101] = c_coast
        pixels[x + 1, 101] = c_coast


def draw_window_arch_frame(img: Image.Image):
    pixels, (w, h) = img.load(), img.size
    for y in range(h):
        for t in range(4):
            pixels[t, y] = PALETTE["void"]
            pixels[w - 1 - t, y] = PALETTE["void"]
    for x in range(w):
        for t in range(4):
            pixels[x, t] = PALETTE["void"]
    for y in range(172, h):
        for x in range(w):
            pixels[x, y] = PALETTE["slate"] if y == 172 else PALETTE["stone"]
    for m in (w // 3, (2 * w) // 3):
        for y in range(4, 172):
            pixels[m - 1, y] = PALETTE["void"]
            pixels[m, y] = PALETTE["slate"]
            pixels[m + 1, y] = PALETTE["void"]
    for x in range(4, w - 4):
        pixels[x, 47] = PALETTE["void"]
        pixels[x, 48] = PALETTE["slate"]
        pixels[x, 49] = PALETTE["void"]


def draw_vesuvius_morning(w=320, h=180, with_frame=True) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)
    horizon_y = 110
    for y in range(horizon_y):
        c = PALETTE["deep_blue"] if y < 35 else (PALETTE["azzurro"] if y < 70 else (PALETTE["cyan"] if y < 98 else PALETTE["white"]))
        for x in range(w):
            pixels[x, y] = c
    draw.ellipse([64, 26, 78, 40], fill=PALETTE["gold"])
    draw.ellipse([67, 29, 75, 37], fill=PALETTE["white"])
    draw.ellipse([110, 42, 145, 52], fill=PALETTE["white"])
    draw.ellipse([230, 28, 275, 40], fill=PALETTE["white"])
    draw_vesuvius_silhouette(pixels, horizon_y, PALETTE["navy"], PALETTE["azzurro"])
    for s in range(5):
        draw.ellipse([215 + s * 8, 58 - s * 4, 221 + s * 9, 62 - s * 4], fill=PALETTE["white"])
    draw_coastline_castel(pixels, horizon_y, PALETTE["slate"])
    for y in range(horizon_y, h):
        c = PALETTE["deep_blue"] if (y % 4 in (0, 1)) else PALETTE["azzurro"]
        for x in range(w):
            pixels[x, y] = c
    for row in range(horizon_y + 4, h - 8, 5):
        for x in range(10, w - 10, 18):
            wx = (x + row * 7) % (w - 20)
            pixels[wx, row] = PALETTE["cyan"]
            pixels[wx + 1, row] = PALETTE["white"]
            pixels[wx + 2, row] = PALETTE["cyan"]
    draw.polygon([(95, 118), (95, 126), (101, 126)], fill=PALETTE["white"])
    draw.polygon([(92, 126), (98, 126), (96, 128)], fill=PALETTE["oak_dark"])
    if with_frame:
        draw_window_arch_frame(img)
    return img


def draw_vesuvius_sunset(w=320, h=180, with_frame=True) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)
    horizon_y = 110
    for y in range(horizon_y):
        c = PALETTE["slate"] if y < 25 else (PALETTE["terracotta_dark"] if y < 50 else (PALETTE["terracotta_light"] if y < 75 else (PALETTE["amber"] if y < 98 else PALETTE["gold"])))
        for x in range(w):
            pixels[x, y] = c
    draw.ellipse([70, 80, 94, 104], fill=PALETTE["amber"])
    draw.ellipse([74, 84, 90, 100], fill=PALETTE["gold"])
    draw.ellipse([77, 87, 87, 97], fill=PALETTE["white"])
    draw.line([(30, 48), (110, 48)], fill=PALETTE["amber"], width=2)
    draw.line([(180, 42), (280, 42)], fill=PALETTE["amber"], width=2)
    draw_vesuvius_silhouette(pixels, horizon_y, PALETTE["slate"], PALETTE["amber"])
    for s in range(5):
        draw.ellipse([215 + s * 7, 58 - s * 3, 220 + s * 8, 61 - s * 3], fill=PALETTE["gold"])
    draw_coastline_castel(pixels, horizon_y, PALETTE["void"])
    pixels[52, 106] = PALETTE["amber"]
    pixels[58, 106] = PALETTE["amber"]
    for y in range(horizon_y, h):
        for x in range(w):
            pixels[x, y] = PALETTE["navy"]
    for y in range(horizon_y, h):
        span = int(4 + (y - horizon_y) * 0.45)
        for rx in range(82 - span, 82 + span + 1):
            if 0 <= rx < w:
                if (rx + y) % 3 == 0:
                    pixels[rx, y] = PALETTE["gold"]
                elif (rx + y) % 3 == 1:
                    pixels[rx, y] = PALETTE["amber"]
    if with_frame:
        draw_window_arch_frame(img)
    return img


def draw_vesuvius_night(w=320, h=180, with_frame=True) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)
    horizon_y = 110
    for y in range(horizon_y):
        c = PALETTE["void"] if y < 70 else PALETTE["navy"]
        for x in range(w):
            pixels[x, y] = c
    stars = [
        (25, 18), (55, 32), (88, 14), (120, 24), (145, 12), (165, 28),
        (195, 16), (220, 36), (250, 15), (280, 26), (40, 48), (95, 52), (180, 44)
    ]
    for sx, sy in stars:
        pixels[sx, sy] = PALETTE["white"]
        if (sx + sy) % 3 == 0:
            pixels[sx + 1, sy] = PALETTE["cyan"]
    draw.ellipse([70, 22, 84, 36], fill=PALETTE["white"])
    draw.ellipse([74, 20, 88, 34], fill=PALETTE["void"])
    draw_vesuvius_silhouette(pixels, horizon_y, PALETTE["void"], PALETTE["navy"])
    pixels[210, 61] = PALETTE["red"]
    pixels[210, 60] = PALETTE["red"]
    draw_coastline_castel(pixels, horizon_y, PALETTE["void"])
    for y in range(horizon_y, h):
        for x in range(w):
            pixels[x, y] = PALETTE["void"]
    for y in range(horizon_y + 2, h, 3):
        span = int(2 + (y - horizon_y) * 0.2)
        for rx in range(72 - span, 72 + span + 1):
            if (rx + y) % 4 == 0:
                pixels[rx, y] = PALETTE["stone"]
    lights = [
        (48, 108, "gold"), (52, 109, "cyan"), (58, 108, "gold"), (64, 109, "green"),
        (78, 109, "gold"), (85, 110, "amber"), (92, 109, "cyan"), (105, 110, "gold"),
        (235, 110, "gold"), (245, 109, "amber"), (255, 110, "cyan")
    ]
    for lx, ly, col in lights:
        pixels[lx, ly] = PALETTE[col]
        pixels[lx, ly + 2] = PALETTE[col]
    if with_frame:
        draw_window_arch_frame(img)
    return img


def draw_window_vesuvius_iso(phase="morning", w=96, h=80) -> Image.Image:
    """
    Renders an isometric wall window unit (96x80 px) embedded in the Room 1 Northwest wall,
    featuring a recessed window frame that looks out onto the live Vesuvius panorama.
    """
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pixels, draw = img.load(), ImageDraw.Draw(img)

    c_light = PALETTE["terracotta_light"]
    c_dark = PALETTE["terracotta_dark"]
    c_mortar = PALETTE["slate"]
    c_base = PALETTE["oak_dark"]
    c_cap = PALETTE["stone"]
    c_frame = PALETTE["void"]
    c_sill = PALETTE["stone"]

    def set_px(x, y, col):
        if 0 <= x < w and 0 <= y < h:
            pixels[x, y] = col

    # 1. Base Wall (Northwest wall slope: 2:1 dimetric)
    for x in range(w):
        top_y = 4 + x // 2
        bot_y = 31 + x // 2
        for y in range(top_y, bot_y + 1):
            if y >= bot_y - 3:
                set_px(x, y, c_base)
            elif y <= top_y + 2:
                set_px(x, y, c_cap)
            else:
                rel_y = y - top_y
                if rel_y % 5 == 0:
                    set_px(x, y, c_mortar)
                else:
                    brick_x = (x + ((rel_y // 5) % 2) * 6) % 12
                    set_px(x, y, c_mortar if brick_x == 0 else (c_dark if (x + y) % 7 == 0 else c_light))

    # Top Cap depth
    for x in range(w):
        top_y = 4 + x // 2
        for t in range(1, 6):
            tx, ty = x + t, top_y - t // 2
            if 0 <= tx < w and 0 <= ty < h and pixels[tx, ty][3] == 0:
                set_px(tx, ty, PALETTE["white"] if t == 1 else c_cap)

    # 2. Window Aperture Cutout & Vista Rendering
    x_start, x_end = 16, 78
    for x in range(x_start, x_end + 1):
        win_top = 9 + x // 2
        win_bot = 26 + x // 2
        for y in range(win_top, win_bot + 1):
            rel_win_y = (y - win_top) / max(1, win_bot - win_top)
            # Render scenic vista inside the opening
            if phase == "morning":
                if rel_win_y < 0.30:
                    set_px(x, y, PALETTE["deep_blue"])
                elif rel_win_y < 0.55:
                    set_px(x, y, PALETTE["azzurro"])
                elif rel_win_y < 0.70:
                    set_px(x, y, PALETTE["cyan"])
                else:
                    set_px(x, y, PALETTE["deep_blue"] if (x + y) % 3 == 0 else PALETTE["azure"])
            elif phase == "sunset":
                if rel_win_y < 0.25:
                    set_px(x, y, PALETTE["slate"])
                elif rel_win_y < 0.45:
                    set_px(x, y, PALETTE["terracotta_dark"])
                elif rel_win_y < 0.65:
                    set_px(x, y, PALETTE["amber"])
                elif rel_win_y < 0.75:
                    set_px(x, y, PALETTE["gold"])
                else:
                    set_px(x, y, PALETTE["gold"] if (35 <= x <= 50 and (x + y) % 2 == 0) else PALETTE["navy"])
            else:  # night
                if rel_win_y < 0.75:
                    set_px(x, y, PALETTE["void"])
                else:
                    set_px(x, y, PALETTE["navy"] if (x + y) % 4 == 0 else PALETTE["void"])

    # Miniaturized Vesuvius silhouette inside window
    for x in range(40, 68):
        win_top = 9 + x // 2
        win_bot = 26 + x // 2
        mid_y = win_top + int((win_bot - win_top) * 0.72)
        if 42 <= x <= 48:
            peak_h = int(5 * (1.0 - abs(x - 45) / 4.0))
        elif 50 <= x <= 62:
            peak_h = int(7 * (1.0 - abs(x - 56) / 7.0))
        else:
            peak_h = 2
        for y in range(mid_y - peak_h, mid_y):
            if phase == "morning":
                set_px(x, y, PALETTE["navy"])
            elif phase == "sunset":
                set_px(x, y, PALETTE["slate"])
            else:
                set_px(x, y, PALETTE["void"])

    # Celestial highlights in window
    if phase == "morning":
        # Morning sun at top left of window
        set_px(24, 9 + 24 // 2 + 2, PALETTE["gold"])
        set_px(25, 9 + 25 // 2 + 2, PALETTE["white"])
        set_px(26, 9 + 26 // 2 + 2, PALETTE["gold"])
        # Crater steam
        set_px(57, 9 + 57 // 2 + 2, PALETTE["white"])
        set_px(58, 9 + 58 // 2 + 1, PALETTE["white"])
    elif phase == "sunset":
        # Sun setting near horizon
        set_px(36, 9 + 36 // 2 + 7, PALETTE["gold"])
        set_px(37, 9 + 37 // 2 + 7, PALETTE["white"])
        set_px(38, 9 + 38 // 2 + 7, PALETTE["amber"])
        # Amber ridge highlight
        set_px(54, 9 + 54 // 2 + 4, PALETTE["amber"])
        set_px(55, 9 + 55 // 2 + 3, PALETTE["amber"])
    else:  # night
        # Crescent Moon
        set_px(26, 9 + 26 // 2 + 3, PALETTE["white"])
        set_px(27, 9 + 27 // 2 + 3, PALETTE["white"])
        set_px(28, 9 + 28 // 2 + 4, PALETTE["white"])
        # Red aircraft warning beacon on Vesuvius peak
        set_px(56, 9 + 56 // 2 + 3, PALETTE["red"])
        # City harbor lights
        for lx, ly_off in [(32, 12), (36, 13), (60, 12), (64, 13), (70, 12)]:
            set_px(lx, 9 + lx // 2 + ly_off, PALETTE["gold"] if lx % 2 == 0 else PALETTE["cyan"])

    # 3. Cast-Iron Window Frame & Mullions
    # Outer frame
    for x in range(x_start - 2, x_end + 3):
        win_top = 9 + x // 2
        win_bot = 26 + x // 2
        # Upper lintel
        set_px(x, win_top - 1, c_frame)
        set_px(x, win_top - 2, c_frame)
        # Lower sill
        set_px(x, win_bot + 1, c_sill)
        set_px(x, win_bot + 2, c_frame)

    # Left & Right jambs
    for y in range(9 + (x_start - 2) // 2 - 2, 26 + (x_start - 2) // 2 + 3):
        set_px(x_start - 1, y, c_frame)
        set_px(x_start - 2, y, c_frame)
    for y in range(9 + (x_end + 2) // 2 - 2, 26 + (x_end + 2) // 2 + 3):
        set_px(x_end + 1, y, c_frame)
        set_px(x_end + 2, y, c_frame)

    # Vertical Mullions (divide into 3 equal bays)
    mullion_1 = x_start + (x_end - x_start) // 3
    mullion_2 = x_start + (2 * (x_end - x_start)) // 3
    for m in (mullion_1, mullion_2):
        win_top = 9 + m // 2
        win_bot = 26 + m // 2
        for y in range(win_top, win_bot + 1):
            set_px(m, y, c_frame)

    # Horizontal Transom bar (at 45% height)
    for x in range(x_start, x_end + 1):
        win_top = 9 + x // 2
        win_bot = 26 + x // 2
        transom_y = win_top + int((win_bot - win_top) * 0.45)
        set_px(x, transom_y, c_frame)

    # Subtle diagonal glass reflection gleams
    for d in range(10):
        gx = 24 + d * 2
        gy = 9 + gx // 2 + 3 + d
        if x_start < gx < x_end and (0 <= gx < w and 0 <= gy < h) and pixels[gx, gy] != c_frame:
            set_px(gx, gy, PALETTE["white"] if d % 3 == 0 else PALETTE["cyan"])

    return img


# ============================================================================
# 7. MASTER ASSET BUILDER & MANIFEST GENERATOR
# ============================================================================

def generate_all_fuori_rete_assets(base_dir: str = PROJECT_ROOT):
    """
    Executes the full pipeline:
    - Generates 4 character spritesheets
    - Generates 15 portraits (64x64 and 128x128)
    - Generates 7 environment tiles/walls & 1 combined tileset
    - Generates 9 furniture sprites & 1 combined furniture atlas
    - Generates 3 Vesuvius panoramas & 3 isometric wall windows
    - Enforces 16-color retro palette quantization
    - Writes public/assets/manifest.json
    """
    assets_dir = os.path.join(base_dir, "public", "assets")
    chars_dir = os.path.join(assets_dir, "characters")
    portraits_dir = os.path.join(assets_dir, "portraits")
    env_dir = os.path.join(assets_dir, "environment")

    for d in [chars_dir, portraits_dir, env_dir]:
        os.makedirs(d, exist_ok=True)

    manifest_entries = []
    generated_files = []

    print("\n--- 1. Generating Character Spritesheets ---")
    characters = ["protagonist", "rosaria", "ciro", "marco"]
    for char in characters:
        sheet = create_character_sheet(char)
        filepath = os.path.join(chars_dir, f"{char}_spritesheet.png")
        save_and_quantize(sheet, filepath)
        rel_url = f"/assets/characters/{char}_spritesheet.png"
        manifest_entries.append({
            "key": char,
            "category": "characters",
            "url": rel_url,
            "width": sheet.width,
            "height": sheet.height,
            "frameWidth": FRAME_W,
            "frameHeight": FRAME_H,
            "frames": CHAR_COLS * CHAR_ROWS,
        })
        generated_files.append(filepath)
        print(f"Generated {filepath} ({sheet.width}x{sheet.height} px, {CHAR_COLS * CHAR_ROWS} frames)")

    print("\n--- 2. Generating Character Expression Portraits ---")
    expressions = ["neutral", "tense", "satisfied"]
    for char_id, gen_fn in PORTRAIT_GENERATORS.items():
        for expr in expressions:
            base_img = gen_fn(expression=expr, cyber_frame=False, size=64)
            upscaled_img = base_img.resize((128, 128), Image.Resampling.NEAREST)

            # 1. Standard name (128x128 for crisp display)
            path_std = os.path.join(portraits_dir, f"{char_id}_{expr}.png")
            save_and_quantize(upscaled_img, path_std)
            generated_files.append(path_std)

            # 2. Explicit 64x64 base resolution asset
            path_64 = os.path.join(portraits_dir, f"{char_id}_{expr}_64.png")
            save_and_quantize(base_img, path_64)
            generated_files.append(path_64)

            # 3. Explicit 128x128 2x scaled asset
            path_128 = os.path.join(portraits_dir, f"{char_id}_{expr}_128.png")
            save_and_quantize(upscaled_img, path_128)
            generated_files.append(path_128)

            rel_url = f"/assets/portraits/{char_id}_{expr}.png"
            manifest_entries.append({
                "key": f"{char_id}_{expr}",
                "character": char_id,
                "expression": expr,
                "category": "portraits",
                "url": rel_url,
                "width": 128,
                "height": 128,
                "baseWidth": 64,
                "baseHeight": 64,
            })
            print(f"Generated portrait: {path_std} (128x128 & 64x64)")

    print("\n--- 3. Generating Environment Tiles & Walls ---")
    tile_parquet = draw_tile_parquet()
    tile_corridor = draw_tile_corridor()
    tile_server_grill = draw_tile_server_grill()
    tile_server_solid = draw_tile_server_solid()
    wall_left = draw_wall_left()
    wall_right = draw_wall_right()
    door_frame = draw_door_frame()

    env_tiles = {
        "tile_parquet": tile_parquet,
        "tile_corridor": tile_corridor,
        "tile_server_grill": tile_server_grill,
        "tile_server_solid": tile_server_solid,
        "wall_left": wall_left,
        "wall_right": wall_right,
        "door_frame": door_frame,
    }

    for key, img in env_tiles.items():
        filepath = os.path.join(env_dir, f"{key}.png")
        save_and_quantize(img, filepath)
        rel_url = f"/assets/environment/{key}.png"
        manifest_entries.append({
            "key": key,
            "category": "environment",
            "url": rel_url,
            "width": img.width,
            "height": img.height,
        })
        generated_files.append(filepath)
        print(f"Generated tile: {filepath} ({img.width}x{img.height} px)")

    # Combined tileset atlas
    tileset_atlas = assemble_tileset_iso(env_tiles)
    tileset_path = os.path.join(env_dir, "tileset_iso.png")
    save_and_quantize(tileset_atlas, tileset_path)
    generated_files.append(tileset_path)
    manifest_entries.append({
        "key": "tileset_iso",
        "category": "environment",
        "url": "/assets/environment/tileset_iso.png",
        "width": tileset_atlas.width,
        "height": tileset_atlas.height,
    })
    print(f"Generated atlas: {tileset_path} ({tileset_atlas.width}x{tileset_atlas.height} px)")

    print("\n--- 4. Generating Furniture Sprites & Multi-Frame Sheets ---")
    furniture_desk = draw_workstation_desk()
    furniture_rack_sw1_f0 = draw_network_rack_sw1(frame=0)
    furniture_rack_sw1_f1 = draw_network_rack_sw1(frame=1)
    furniture_server_r1_f0 = draw_server_rack_r1(frame=0)
    furniture_server_r1_f1 = draw_server_rack_r1(frame=1)
    furniture_bar_coffee_f0 = draw_bar_napoletano(frame=0)
    furniture_bar_coffee_f1 = draw_bar_napoletano(frame=1)
    furniture_monstera = draw_monstera_plant()
    furniture_pizza_box = draw_pizza_box()

    furniture_items = {
        "furniture_desk": furniture_desk,
        "furniture_rack_sw1_f0": furniture_rack_sw1_f0,
        "furniture_rack_sw1_f1": furniture_rack_sw1_f1,
        "furniture_server_r1_f0": furniture_server_r1_f0,
        "furniture_server_r1_f1": furniture_server_r1_f1,
        "furniture_bar_coffee_f0": furniture_bar_coffee_f0,
        "furniture_bar_coffee_f1": furniture_bar_coffee_f1,
        "furniture_monstera": furniture_monstera,
        "furniture_pizza_box": furniture_pizza_box,
    }

    for key, img in furniture_items.items():
        filepath = os.path.join(env_dir, f"{key}.png")
        save_and_quantize(img, filepath)
        rel_url = f"/assets/environment/{key}.png"
        manifest_entries.append({
            "key": key,
            "category": "environment",
            "url": rel_url,
            "width": img.width,
            "height": img.height,
        })
        generated_files.append(filepath)
        print(f"Generated furniture item: {filepath} ({img.width}x{img.height} px)")

    # Multi-frame animated spritesheets for Phaser BootScene anims
    # Rack SW1 sheet (128x80)
    sheet_sw1 = Image.new("RGBA", (128, 80), (0, 0, 0, 0))
    sheet_sw1.paste(furniture_rack_sw1_f0, (0, 0))
    sheet_sw1.paste(furniture_rack_sw1_f1, (64, 0))
    path_sw1_sheet = os.path.join(env_dir, "furniture_rack_sw1_sheet.png")
    save_and_quantize(sheet_sw1, path_sw1_sheet)
    generated_files.append(path_sw1_sheet)
    manifest_entries.append({
        "key": "furniture_rack_sw1_sheet",
        "category": "environment",
        "url": "/assets/environment/furniture_rack_sw1_sheet.png",
        "width": 128,
        "height": 80,
        "frameWidth": 64,
        "frameHeight": 80,
    })

    # Server R1 sheet (128x96)
    sheet_r1 = Image.new("RGBA", (128, 96), (0, 0, 0, 0))
    sheet_r1.paste(furniture_server_r1_f0, (0, 0))
    sheet_r1.paste(furniture_server_r1_f1, (64, 0))
    path_r1_sheet = os.path.join(env_dir, "furniture_server_r1_sheet.png")
    save_and_quantize(sheet_r1, path_r1_sheet)
    generated_files.append(path_r1_sheet)
    manifest_entries.append({
        "key": "furniture_server_r1_sheet",
        "category": "environment",
        "url": "/assets/environment/furniture_server_r1_sheet.png",
        "width": 128,
        "height": 96,
        "frameWidth": 64,
        "frameHeight": 96,
    })

    # Bar Coffee sheet (160x64)
    sheet_bar = Image.new("RGBA", (160, 64), (0, 0, 0, 0))
    sheet_bar.paste(furniture_bar_coffee_f0, (0, 0))
    sheet_bar.paste(furniture_bar_coffee_f1, (80, 0))
    path_bar_sheet = os.path.join(env_dir, "furniture_bar_coffee_sheet.png")
    save_and_quantize(sheet_bar, path_bar_sheet)
    generated_files.append(path_bar_sheet)
    manifest_entries.append({
        "key": "furniture_bar_coffee_sheet",
        "category": "environment",
        "url": "/assets/environment/furniture_bar_coffee_sheet.png",
        "width": 160,
        "height": 64,
        "frameWidth": 80,
        "frameHeight": 64,
    })

    # Combined furniture atlas
    furniture_atlas = assemble_furniture_iso({
        "desk": furniture_desk,
        "rack_sw1_f0": furniture_rack_sw1_f0,
        "rack_sw1_f1": furniture_rack_sw1_f1,
        "server_r1_f0": furniture_server_r1_f0,
        "server_r1_f1": furniture_server_r1_f1,
        "bar_f0": furniture_bar_coffee_f0,
        "bar_f1": furniture_bar_coffee_f1,
        "monstera": furniture_monstera,
        "pizza_box": furniture_pizza_box,
    })
    furniture_atlas_path = os.path.join(env_dir, "furniture_iso.png")
    save_and_quantize(furniture_atlas, furniture_atlas_path)
    generated_files.append(furniture_atlas_path)
    manifest_entries.append({
        "key": "furniture_iso",
        "category": "environment",
        "url": "/assets/environment/furniture_iso.png",
        "width": furniture_atlas.width,
        "height": furniture_atlas.height,
    })
    print(f"Generated furniture atlas: {furniture_atlas_path} ({furniture_atlas.width}x{furniture_atlas.height} px)")

    print("\n--- 5. Generating Panoramic Vesuvius Window Vistas & Isometric Windows ---")
    phases = ["morning", "sunset", "night"]
    vistas = {
        "vesuvius_morning": draw_vesuvius_morning(320, 180, with_frame=True),
        "vesuvius_sunset": draw_vesuvius_sunset(320, 180, with_frame=True),
        "vesuvius_night": draw_vesuvius_night(320, 180, with_frame=True),
    }

    for key, img in vistas.items():
        filepath = os.path.join(env_dir, f"{key}.png")
        save_and_quantize(img, filepath)
        rel_url = f"/assets/environment/{key}.png"
        manifest_entries.append({
            "key": key,
            "category": "environment",
            "url": rel_url,
            "width": img.width,
            "height": img.height,
        })
        generated_files.append(filepath)
        print(f"Generated vista: {filepath} ({img.width}x{img.height} px)")

    # 96x80 Isometric Wall Windows
    for phase in phases:
        iso_win = draw_window_vesuvius_iso(phase=phase, w=96, h=80)
        filepath = os.path.join(env_dir, f"window_vesuvius_iso_{phase}.png")
        save_and_quantize(iso_win, filepath)
        rel_url = f"/assets/environment/window_vesuvius_iso_{phase}.png"
        manifest_entries.append({
            "key": f"window_vesuvius_iso_{phase}",
            "phase": phase,
            "category": "environment",
            "url": rel_url,
            "width": iso_win.width,
            "height": iso_win.height,
        })
        generated_files.append(filepath)
        print(f"Generated iso window: {filepath} ({iso_win.width}x{iso_win.height} px)")

    print("\n--- 6. Verifying 100% 16-Color Palette Quantization Compliance ---")
    palette_set = set(PALETTE_COLORS)
    total_checked_pixels = 0
    non_compliant = 0

    for fpath in generated_files:
        check_img = Image.open(fpath).convert("RGBA")
        c_pixels = check_img.load()
        w, h = check_img.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = c_pixels[x, y]
                if a >= 32:
                    total_checked_pixels += 1
                    if (r, g, b) not in palette_set:
                        non_compliant += 1
                        print(f"ERROR: Non-compliant pixel in {fpath}: {(r, g, b)}")

    print(f"Checked {total_checked_pixels} pixels across {len(generated_files)} assets: {non_compliant} non-compliant.")
    assert non_compliant == 0, f"Palette violation: {non_compliant} non-compliant pixels detected!"
    print("SUCCESS: 100% Palette compliance verified across all assets!")

    print("\n--- 7. Building Asset Manifest (public/assets/manifest.json) ---")
    manifest = {
        "version": "1.0.0",
        "name": "Fuori Rete: Crisis at Cisco Naples — Local Asset Manifest",
        "palette": [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in PALETTE_COLORS],
        "characters": {
            "protagonist": "/assets/characters/protagonist_spritesheet.png",
            "rosaria": "/assets/characters/rosaria_spritesheet.png",
            "ciro": "/assets/characters/ciro_spritesheet.png",
            "marco": "/assets/characters/marco_spritesheet.png",
        },
        "portraits": {
            "protagonist": {
                "neutral": "/assets/portraits/protagonist_neutral.png",
                "tense": "/assets/portraits/protagonist_tense.png",
                "satisfied": "/assets/portraits/protagonist_satisfied.png",
            },
            "rosaria": {
                "neutral": "/assets/portraits/rosaria_neutral.png",
                "tense": "/assets/portraits/rosaria_tense.png",
                "satisfied": "/assets/portraits/rosaria_satisfied.png",
            },
            "ciro": {
                "neutral": "/assets/portraits/ciro_neutral.png",
                "tense": "/assets/portraits/ciro_tense.png",
                "satisfied": "/assets/portraits/ciro_satisfied.png",
            },
            "marco": {
                "neutral": "/assets/portraits/marco_neutral.png",
                "tense": "/assets/portraits/marco_tense.png",
                "satisfied": "/assets/portraits/marco_satisfied.png",
            },
            "secbot": {
                "neutral": "/assets/portraits/secbot_neutral.png",
                "tense": "/assets/portraits/secbot_tense.png",
                "satisfied": "/assets/portraits/secbot_satisfied.png",
            },
        },
        "environment": {
            "vesuvius_morning": "/assets/environment/vesuvius_morning.png",
            "vesuvius_sunset": "/assets/environment/vesuvius_sunset.png",
            "vesuvius_night": "/assets/environment/vesuvius_night.png",
            "tileset_iso": "/assets/environment/tileset_iso.png",
            "furniture_iso": "/assets/environment/furniture_iso.png",
            "tile_parquet": "/assets/environment/tile_parquet.png",
            "tile_corridor": "/assets/environment/tile_corridor.png",
            "tile_server_grill": "/assets/environment/tile_server_grill.png",
            "tile_server_solid": "/assets/environment/tile_server_solid.png",
            "wall_left": "/assets/environment/wall_left.png",
            "wall_right": "/assets/environment/wall_right.png",
            "door_frame": "/assets/environment/door_frame.png",
            "furniture_desk": "/assets/environment/furniture_desk.png",
            "furniture_rack_sw1_f0": "/assets/environment/furniture_rack_sw1_f0.png",
            "furniture_rack_sw1_f1": "/assets/environment/furniture_rack_sw1_f1.png",
            "furniture_rack_sw1_sheet": "/assets/environment/furniture_rack_sw1_sheet.png",
            "furniture_server_r1_f0": "/assets/environment/furniture_server_r1_f0.png",
            "furniture_server_r1_f1": "/assets/environment/furniture_server_r1_f1.png",
            "furniture_server_r1_sheet": "/assets/environment/furniture_server_r1_sheet.png",
            "furniture_bar_coffee_f0": "/assets/environment/furniture_bar_coffee_f0.png",
            "furniture_bar_coffee_f1": "/assets/environment/furniture_bar_coffee_f1.png",
            "furniture_bar_coffee_sheet": "/assets/environment/furniture_bar_coffee_sheet.png",
            "furniture_monstera": "/assets/environment/furniture_monstera.png",
            "furniture_pizza_box": "/assets/environment/furniture_pizza_box.png",
            "window_vesuvius_iso_morning": "/assets/environment/window_vesuvius_iso_morning.png",
            "window_vesuvius_iso_sunset": "/assets/environment/window_vesuvius_iso_sunset.png",
            "window_vesuvius_iso_night": "/assets/environment/window_vesuvius_iso_night.png",
        },
        "dimensions": {entry["url"]: {"width": entry["width"], "height": entry["height"]} for entry in manifest_entries},
        "assets": manifest_entries,
    }

    manifest_path = os.path.join(assets_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Generated manifest: {manifest_path} with {len(manifest_entries)} asset entries.")

    print("\n=== All M1 Assets Successfully Generated and Verified! ===")


if __name__ == "__main__":
    generate_all_fuori_rete_assets(PROJECT_ROOT)
