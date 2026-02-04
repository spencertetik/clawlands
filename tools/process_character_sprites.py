#!/usr/bin/env python3
"""
Process character sprite sheets for Claw World.

Reads 1024x1024 3-frame sprite sheets and converts them to game-ready sprites:
- Splits into 3 individual frames
- Downscales to game size (16x24)
- Creates folder structure for each character type
"""

import os
from pathlib import Path
from PIL import Image
import numpy as np

# Configuration
SOURCE_DIR = Path(__file__).parent.parent / "output/imagegen/crustaceans"
OUTPUT_DIR = Path(__file__).parent.parent / "client/assets/sprites/characters"

# Target sprite dimensions (game uses 16x24)
TARGET_WIDTH = 24
TARGET_HEIGHT = 24

# Character types and their source file prefixes
CHARACTER_TYPES = {
    "lobster": "lobster",
    "crab": "crab", 
    "shrimp": "shrimp",
    "mantis_shrimp": "mantis_shrimp",
    "hermit_crab": "hermit_crab"
}

# Directions
DIRECTIONS = ["south", "north", "east", "west"]

# Keep top-level sprites in sync with lobster (default species fallback)
SYNC_ROOT_FROM = "lobster"

# Mirror east from west for consistent facing (Pokémon-style)
FORCE_MIRROR_EAST_FROM_WEST = True


def find_content_bounds(img, alpha_threshold=64):
    """Find the bounding box of visible pixels, ignoring faint alpha noise."""
    arr = np.array(img)
    if arr.shape[2] == 4:  # Has alpha channel
        alpha = arr[:, :, 3]
        rows = np.any(alpha >= alpha_threshold, axis=1)
        cols = np.any(alpha >= alpha_threshold, axis=0)
        if not np.any(rows) or not np.any(cols):
            return None
        ymin, ymax = np.where(rows)[0][[0, -1]]
        xmin, xmax = np.where(cols)[0][[0, -1]]
        return (xmin, ymin, xmax + 1, ymax + 1)
    return (0, 0, img.width, img.height)


def split_into_frames(img, num_frames=3):
    """Split a sprite sheet into individual frames using equal-width slices."""
    if img.width < num_frames:
        print("  Warning: Image too small to split")
        return []

    frame_width = img.width // num_frames
    frames = []
    for i in range(num_frames):
        x0 = i * frame_width
        x1 = x0 + frame_width
        frames.append(img.crop((x0, 0, x1, img.height)))
    return frames


def percentile(values, q):
    """Return the q percentile (0-1) of a list of numbers."""
    if not values:
        return None
    values = sorted(values)
    if len(values) == 1:
        return values[0]
    idx = (len(values) - 1) * q
    lo = int(np.floor(idx))
    hi = int(np.ceil(idx))
    if lo == hi:
        return values[lo]
    return values[lo] * (hi - idx) + values[hi] * (idx - lo)


def resize_frame(frame, scale, target_width=TARGET_WIDTH, target_height=TARGET_HEIGHT):
    """Resize a frame using a global scale factor and bottom-anchor."""
    if frame.height == 0 or frame.width == 0:
        return Image.new('RGBA', (target_width, target_height), (0, 0, 0, 0))

    new_width = max(1, int(round(frame.width * scale)))
    new_height = max(1, int(round(frame.height * scale)))
    resized = frame.resize((new_width, new_height), Image.Resampling.NEAREST)

    # Crop horizontally if too wide
    if resized.width > target_width:
        left = (resized.width - target_width) // 2
        resized = resized.crop((left, 0, left + target_width, resized.height))

    output = Image.new('RGBA', (target_width, target_height), (0, 0, 0, 0))
    x = max(0, (target_width - resized.width) // 2)
    y = target_height - resized.height
    output.paste(resized, (x, y))
    return output


def process_character(char_type, prefix):
    """Process all sprites for a character type."""
    char_dir = OUTPUT_DIR / char_type
    frames_dir = char_dir / "frames"
    
    # Create directories
    char_dir.mkdir(parents=True, exist_ok=True)
    frames_dir.mkdir(exist_ok=True)
    
    print(f"\n📦 Processing {char_type}...")
    
    # First pass: load all frames and bounds to compute a global scale per species
    frames_by_dir = {}
    bounds_by_dir = {}
    content_heights = []
    content_widths = []

    for direction in DIRECTIONS:
        filename = f"{prefix}_{direction}_walk.png"
        src_path = SOURCE_DIR / filename

        if not src_path.exists():
            print(f"  ⚠️  Missing: {filename}")
            continue

        img = Image.open(src_path).convert('RGBA')
        frames = split_into_frames(img)
        if len(frames) < 3:
            print(f"    ⚠️  Expected 3 frames, got {len(frames)}")
            continue

        frame_bounds = []
        for frame in frames:
            bounds = find_content_bounds(frame)
            if bounds is None:
                bounds = (0, 0, frame.width, frame.height)
            xmin, ymin, xmax, ymax = bounds
            height = ymax - ymin
            width = xmax - xmin
            if height > 0:
                content_heights.append(height)
            if width > 0:
                content_widths.append(width)
            frame_bounds.append(bounds)

        frames_by_dir[direction] = frames
        bounds_by_dir[direction] = frame_bounds

    if not frames_by_dir or not content_heights or not content_widths:
        return

    # Use a high percentile to avoid tiny sprites caused by alpha noise outliers
    height_ref = percentile(content_heights, 0.85) or max(content_heights)
    width_ref = percentile(content_widths, 0.85) or max(content_widths)
    scale = min(TARGET_HEIGHT / height_ref, TARGET_WIDTH / width_ref)
    print(f"    📏 Scale ref (h={height_ref:.1f}, w={width_ref:.1f}) → scale {scale:.4f}")

    processed_by_dir = {}
    for direction in DIRECTIONS:
        if direction not in frames_by_dir:
            continue

        print(f"  Processing {direction}...")
        frames = frames_by_dir[direction]
        frame_bounds = bounds_by_dir[direction]

        processed_frames = []
        for i, (frame, bounds) in enumerate(zip(frames, frame_bounds)):
            xmin, ymin, xmax, ymax = bounds
            cropped = frame.crop((xmin, ymin, xmax, ymax))
            resized = resize_frame(cropped, scale)
            processed_frames.append(resized)

            frame_path = frames_dir / f"{direction}_walk_{i}.png"
            resized.save(frame_path)

        static_path = char_dir / f"{direction}.png"
        processed_frames[1].save(static_path)

        strip_width = TARGET_WIDTH * 3
        strip = Image.new('RGBA', (strip_width, TARGET_HEIGHT), (0, 0, 0, 0))
        for i, frame in enumerate(processed_frames):
            strip.paste(frame, (i * TARGET_WIDTH, 0))

        strip_path = char_dir / f"{direction}_walk.png"
        strip.save(strip_path)

        processed_by_dir[direction] = processed_frames
        print(f"    ✅ Saved {len(processed_frames)} frames + strip")

    if FORCE_MIRROR_EAST_FROM_WEST and "west" in processed_by_dir:
        mirrored = [frame.transpose(Image.FLIP_LEFT_RIGHT) for frame in processed_by_dir["west"]]

        for i, frame in enumerate(mirrored):
            frame_path = frames_dir / f"east_walk_{i}.png"
            frame.save(frame_path)

        static_path = char_dir / "east.png"
        mirrored[1].save(static_path)

        strip_width = TARGET_WIDTH * 3
        strip = Image.new('RGBA', (strip_width, TARGET_HEIGHT), (0, 0, 0, 0))
        for i, frame in enumerate(mirrored):
            strip.paste(frame, (i * TARGET_WIDTH, 0))

        strip_path = char_dir / "east_walk.png"
        strip.save(strip_path)
        print("    ✅ Mirrored east from west")


def main():
    print("🦀 Claw World Character Sprite Processor")
    print("=" * 50)
    
    # Check source directory
    if not SOURCE_DIR.exists():
        print(f"❌ Source directory not found: {SOURCE_DIR}")
        return
    
    # List available source files
    print(f"\nSource: {SOURCE_DIR}")
    print(f"Output: {OUTPUT_DIR}")
    
    src_files = list(SOURCE_DIR.glob("*.png"))
    print(f"\nFound {len(src_files)} source files")
    
    # Process each character type
    for char_type, prefix in CHARACTER_TYPES.items():
        process_character(char_type, prefix)

    # Sync root-level sprites and frames from default species
    if SYNC_ROOT_FROM in CHARACTER_TYPES:
        source_dir = OUTPUT_DIR / SYNC_ROOT_FROM
        root_frames = OUTPUT_DIR / "frames"
        source_frames = source_dir / "frames"
        root_frames.mkdir(exist_ok=True)

        for direction in DIRECTIONS:
            for suffix in ["", "_walk"]:
                src = source_dir / f"{direction}{suffix}.png"
                dst = OUTPUT_DIR / f"{direction}{suffix}.png"
                if src.exists():
                    Image.open(src).save(dst)

            for frame in range(3):
                src_frame = source_frames / f"{direction}_walk_{frame}.png"
                dst_frame = root_frames / f"{direction}_walk_{frame}.png"
                if src_frame.exists():
                    Image.open(src_frame).save(dst_frame)
        print(f"\n✅ Synced root sprites from '{SYNC_ROOT_FROM}'")
    
    print("\n" + "=" * 50)
    print("✅ Done! Character sprites ready in:")
    print(f"   {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
