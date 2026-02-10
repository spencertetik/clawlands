# Interior Design Guide — Clawlands

## Core Principles (learned from research + Spencer feedback)

### 1. Scale & Proportion
- **TILE_SIZE = 16px**. Everything aligns to this grid.
- **Player character = ~16x24px** (1 tile wide, 1.5 tiles tall)
- **Furniture must be proportional to the player.** A table shouldn't be bigger than the character.
- **Max furniture size: 2x2 tiles (32x32px)** for the largest items (bed, bookshelf)
- **Most furniture: 1x1 tile (16x16) or 1x2 tiles (16x32)**
- Anything bigger than 2x2 tiles looks absurdly oversized in these rooms

### 2. Room Sizes & Usable Space
| Building | Total (tiles) | Usable* (tiles) | Usable Pixels |
|----------|--------------|-----------------|---------------|
| House    | 10×7         | ~8×5            | 128×80        |
| Shop     | 12×8         | ~10×6           | 160×96        |
| Inn      | 14×9         | ~12×7           | 192×112       |

*Usable = minus walls (1 tile each side) and door area

### 3. Layout Rules
- **Leave walkable paths** — player needs at least 1 tile width to navigate
- **Functional zones** — group related items:
  - Bedroom zone: bed + nightstand
  - Dining zone: table + 1-2 chairs
  - Storage zone: barrel/crate, bookshelf against wall
  - Accent: 1 plant, 1 rug
- **Wall-hug large items** — bookshelves, beds, counters go against walls
- **Center piece is small** — rug or small table in the middle, NOT big furniture
- **Door area clear** — 2-3 tiles in front of door must be empty for entry

### 4. Quantity Guidelines
| Room Size | Max Items | Rule |
|-----------|-----------|------|
| House (10×7) | 5-7 items | 1 bed, 1 table, 1 chair, 1 shelf, 1-2 accents |
| Shop (12×8) | 6-8 items | counter row, 2-3 shelves, 1-2 accents |
| Inn (14×9) | 8-12 items | 2-3 beds, 1-2 tables, counter area, 2-3 accents |

### 5. What NOT to Do
- ❌ Don't use sprites bigger than 32x32 for furniture
- ❌ Don't fill every corner — empty space is design
- ❌ Don't stack items on top of each other
- ❌ Don't place items where player can't walk around them
- ❌ Don't put huge items (barrels, bookshelves) in the center of the room

### 6. Reference Games
- **Zelda: Link's Awakening** — houses have 3-5 furniture items max, lots of open floor
- **Stardew Valley** — furniture fits neatly into tile grid, clear walking paths
- **Final Fantasy (SNES)** — minimal furniture, functional layouts
- **Slynyrd pixel blog** — 16x16 tile-based furniture designed within the grid

### 7. Our Furniture Sprite Sizes (current)
Many of our sprites exceed the 2-tile limit. Need to either:
- Scale down oversized sprites
- Redesign with smaller pixel art
- Use the sprite at 1x but clamp render size

### Key Insight
"Designing visually pleasing tiles can be deceptively difficult... creating a meaningful 
layout of specific furniture items is a non-trivial task by itself, I can't just scatter 
beds and chairs randomly." — Game dev research

The interiors should feel like someone LIVES there, not like a warehouse.
