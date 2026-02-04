#!/usr/bin/env python3
"""Extract PixelLab sprites from JSON and create sprite sheets"""

import json
import base64
from PIL import Image
import io
import os

# Create directories
os.makedirs('client/assets/sprites/tiles', exist_ok=True)
os.makedirs('client/assets/sprites/characters', exist_ok=True)

print("🎨 Extracting PixelLab sprites...")

# Extract sand/water tileset
print("\n📦 Processing sand/water tileset...")
with open('tileset_sand_water.json', 'r') as f:
    tileset_data = json.load(f)

tiles = tileset_data['tileset']['tiles']
tile_size = tileset_data['tileset']['tile_size']
print(f"Found {len(tiles)} tiles, size {tile_size['width']}x{tile_size['height']}")

# Create a 4x4 tileset image
tileset_width = 4 * tile_size['width']
tileset_height = 4 * tile_size['height']
tileset_image = Image.new('RGBA', (tileset_width, tileset_height))

for i, tile in enumerate(tiles):
    # Decode base64 image
    img_data = base64.b64decode(tile['image']['base64'])
    tile_img = Image.open(io.BytesIO(img_data))

    # Place in grid (4 columns)
    col = i % 4
    row = i // 4
    x = col * tile_size['width']
    y = row * tile_size['height']

    tileset_image.paste(tile_img, (x, y))

tileset_image.save('client/assets/sprites/tiles/sand_water.png')
print("✅ Saved sand_water.png")

# Extract grass/dirt tileset
print("\n📦 Processing grass/dirt tileset...")
with open('tileset_grass_dirt.json', 'r') as f:
    tileset_data = json.load(f)

tiles = tileset_data['tileset']['tiles']
print(f"Found {len(tiles)} tiles")

tileset_image = Image.new('RGBA', (tileset_width, tileset_height))

for i, tile in enumerate(tiles):
    img_data = base64.b64decode(tile['image']['base64'])
    tile_img = Image.open(io.BytesIO(img_data))

    col = i % 4
    row = i // 4
    x = col * tile_size['width']
    y = row * tile_size['height']

    tileset_image.paste(tile_img, (x, y))

tileset_image.save('client/assets/sprites/tiles/grass_dirt.png')
print("✅ Saved grass_dirt.png")

# Combine character sprites into a single sprite sheet
print("\n📦 Creating character sprite sheet...")
char_dir = 'client/assets/sprites/characters'

# Order: down (south), up (north), left (west), right (east)
directions = ['south', 'north', 'west', 'east']
char_images = []

for direction in directions:
    img_path = f'{char_dir}/{direction}.png'
    if os.path.exists(img_path):
        char_images.append(Image.open(img_path))

if char_images:
    # Assume all are same size (32x32)
    char_width = char_images[0].width
    char_height = char_images[0].height

    # Create horizontal sprite sheet
    sprite_sheet = Image.new('RGBA', (char_width * 4, char_height))

    for i, img in enumerate(char_images):
        sprite_sheet.paste(img, (i * char_width, 0))

    sprite_sheet.save(f'{char_dir}/lobster_character.png')
    print(f"✅ Saved lobster_character.png ({char_width * 4}x{char_height})")

print("\n🎉 All sprites extracted successfully!")
