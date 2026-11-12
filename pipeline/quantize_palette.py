#!/usr/bin/env python3
"""
Cisco Cyber Office - Palette Quantizer & Pixel Snapper
Ensures all imported raster assets strictly conform to the retro color palette.
"""

import sys
import os
from PIL import Image

# Official Cisco Cyber Office 16-color Palette
PALETTE_COLORS = [
    (0, 188, 235),    # Cisco Cyan
    (2, 132, 199),    # Azzurro Napoli
    (3, 105, 161),    # Cisco Deep Blue
    (13, 39, 77),     # Cisco Navy
    (15, 23, 42),     # Slate Dark
    (2, 6, 23),       # Void Black
    (255, 255, 255),  # Pure White
    (203, 213, 225),  # Light Stone
    (16, 185, 129),   # Matrix Green
    (245, 158, 11),   # Warning Amber
    (239, 68, 68),    # Threat Red
    (180, 83, 9),     # Oak Parquet Light
    (146, 64, 14),    # Oak Parquet Dark
    (124, 45, 18),    # Terracotta Brick Dark
    (154, 52, 18),    # Terracotta Brick Light
    (254, 240, 138),  # Vesuvius Sunset Gold
]

def quantize_image(input_path: str, output_path: str, scale_factor: int = 1):
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found")
        sys.exit(1)

    img = Image.open(input_path).convert("RGBA")
    
    # Optional downscaling to enforce crisp pixel grid
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

            # Find nearest palette color (Euclidean distance)
            best_color = PALETTE_COLORS[0]
            best_dist = float("inf")
            for pr, pg, pb in PALETTE_COLORS:
                dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
                if dist < best_dist:
                    best_dist = dist
                    best_color = (pr, pg, pb)

            pixels[x, y] = (best_color[0], best_color[1], best_color[2], 255)

    img.save(output_path, "PNG")
    print(f"Quantized asset saved to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 quantize_palette.py <input.png> <output.png> [pixel_scale]")
        sys.exit(1)

    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    quantize_image(sys.argv[1], sys.argv[2], scale)
