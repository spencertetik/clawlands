#!/usr/bin/env python3
"""
Process accessory sprites for Claw World.
Converts 1024x1024 accessory images to game-ready 16x16 overlays.
"""

from pathlib import Path
from PIL import Image
import numpy as np

SOURCE_DIR = Path(__file__).parent.parent / "output/imagegen/accessories"
OUTPUT_DIR = Path(__file__).parent.parent / "client/assets/sprites/accessories"

# Target dimensions - accessories sit on top of 16x24 character
TARGET_SIZE = 16

# Accessory mappings (source filename -> output id)
ACCESSORIES = {
    "hat_baseball.png": "baseball_cap",
    "hat_beanie.png": "beanie", 
    "hat_bucket.png": "bucket_hat",
    "glasses_sunglasses.png": "sunglasses",
    "glasses_square.png": "square_glasses",
    "scarf_red.png": "scarf",
    "bandana_pirate.png": "pirate_bandana"
}


def find_content_bounds(img):
    """Find the bounding box of non-transparent pixels."""
    arr = np.array(img)
    if arr.shape[2] == 4:
        alpha = arr[:, :, 3]
        rows = np.any(alpha > 0, axis=1)
        cols = np.any(alpha > 0, axis=0)
        if not np.any(rows) or not np.any(cols):
            return None
        ymin, ymax = np.where(rows)[0][[0, -1]]
        xmin, xmax = np.where(cols)[0][[0, -1]]
        return (xmin, ymin, xmax + 1, ymax + 1)
    return (0, 0, img.width, img.height)


def process_accessory(src_path, output_id):
    """Process a single accessory image."""
    img = Image.open(src_path).convert('RGBA')
    
    # Find content bounds
    bounds = find_content_bounds(img)
    if bounds:
        img = img.crop(bounds)
    
    # Calculate resize to fit in TARGET_SIZE while preserving aspect ratio
    aspect = img.width / img.height
    if aspect > 1:
        new_width = TARGET_SIZE
        new_height = int(TARGET_SIZE / aspect)
    else:
        new_height = TARGET_SIZE
        new_width = int(TARGET_SIZE * aspect)
    
    # Resize with nearest neighbor for pixel art
    resized = img.resize((new_width, new_height), Image.Resampling.NEAREST)
    
    # Create output with transparent background, centered
    output = Image.new('RGBA', (TARGET_SIZE, TARGET_SIZE), (0, 0, 0, 0))
    x = (TARGET_SIZE - new_width) // 2
    y = (TARGET_SIZE - new_height) // 2
    output.paste(resized, (x, y))
    
    # Save
    output_path = OUTPUT_DIR / f"{output_id}.png"
    output.save(output_path)
    print(f"  ✅ {output_id}.png ({new_width}x{new_height})")


def main():
    print("🎩 Processing Claw World accessories...")
    print(f"Source: {SOURCE_DIR}")
    print(f"Output: {OUTPUT_DIR}")
    print()
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    for src_name, output_id in ACCESSORIES.items():
        src_path = SOURCE_DIR / src_name
        if src_path.exists():
            process_accessory(src_path, output_id)
        else:
            print(f"  ⚠️  Missing: {src_name}")
    
    print()
    print("✅ Done!")


if __name__ == "__main__":
    main()
