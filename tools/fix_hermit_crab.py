#!/usr/bin/env python3
"""Fix hermit crab missing east walk by flipping west walk horizontally."""

from PIL import Image
from pathlib import Path

CHAR_DIR = Path(__file__).parent.parent / "client/assets/sprites/characters/hermit_crab"

def flip_and_save():
    # Flip the walk strip
    west_walk = CHAR_DIR / "west_walk.png"
    east_walk = CHAR_DIR / "east_walk.png"
    
    if west_walk.exists() and not east_walk.exists():
        img = Image.open(west_walk)
        flipped = img.transpose(Image.FLIP_LEFT_RIGHT)
        flipped.save(east_walk)
        print(f"✅ Created east_walk.png from flipped west_walk.png")
    
    # Flip the static sprite
    west = CHAR_DIR / "west.png"
    east = CHAR_DIR / "east.png"
    
    if west.exists() and not east.exists():
        img = Image.open(west)
        flipped = img.transpose(Image.FLIP_LEFT_RIGHT)
        flipped.save(east)
        print(f"✅ Created east.png from flipped west.png")
    
    # Flip individual frames
    frames_dir = CHAR_DIR / "frames"
    for i in range(3):
        west_frame = frames_dir / f"west_walk_{i}.png"
        east_frame = frames_dir / f"east_walk_{i}.png"
        
        if west_frame.exists() and not east_frame.exists():
            img = Image.open(west_frame)
            flipped = img.transpose(Image.FLIP_LEFT_RIGHT)
            flipped.save(east_frame)
            print(f"✅ Created east_walk_{i}.png from flipped west_walk_{i}.png")

if __name__ == "__main__":
    print("🐚 Fixing hermit crab east sprites...")
    flip_and_save()
    print("Done!")
