# Wang Tileset Implementation Notes

## Critical Lessons Learned

### PixelLab Tileset Behavior
- **PixelLab JSON metadata is BACKWARDS from visual appearance**
- JSON says "lower = sandy beach, upper = ocean water"
- But VISUALLY: tile 0-15 show the OPPOSITE
- **Always verify tiles visually with numbered debug tiles before trusting JSON**

### Confirmed Tile Mappings (Visual)
Based on extensive testing with numbered diagnostic tiles:

```
Tile 6  = All sand (no water neighbors)
Tile 12 = All water (use for all water tiles)

North edge  = Tile 3  (water to north, sand to south)
South edge  = Tile 9  (water to south, sand to north)
West edge   = Tile 1  (water to west, sand to east)
East edge   = Tile 11 (water to east, sand to west)

Top-left corner     = Tile 13 (water N+W, sand E+S)
Top-right corner    = Tile 0  (water N+E, sand W+S)
Bottom-left corner  = Tile 8  (water S+W, sand N+E)
Bottom-right corner = Tile 15 (water S+E, sand N+W)

Inner corners = Tiles 2, 7, 13, 14
Diagonals     = Tiles 4, 10
```

### Terrain Map Convention
```javascript
terrainMap[row][col] = 0  // Sand
terrainMap[row][col] = 1  // Water
```

### AutoTiling Algorithm (CRITICAL)

1. **Only autotile SAND tiles** - Water tiles always get tile 12:
```javascript
if (currentIsWater) {
    tileLayer[row][col] = 12;
    continue;
}
```

2. **Use OR logic for corner determination** (not AND):
```javascript
const nw = (n || w) ? 'lower' : 'upper';
const ne = (n || e) ? 'lower' : 'upper';
const sw = (s || w) ? 'lower' : 'upper';
const se = (s || e) ? 'lower' : 'upper';
```

3. **Corner states**:
   - `'lower'` = water present in that direction
   - `'upper'` = sand present in that direction

4. **Pattern format**: `NW,NE,SW,SE` (clockwise from top-left)

### Manual Tile Mapping (Final Working Version)
```javascript
this.cornerToTile = {
    'upper,upper,upper,upper': 6,   // All sand
    'lower,lower,lower,lower': 12,  // All water
    'lower,lower,upper,upper': 3,   // North edge
    'upper,upper,lower,lower': 9,   // South edge
    'lower,upper,lower,upper': 1,   // West edge
    'upper,lower,upper,lower': 11,  // East edge
    'lower,lower,lower,upper': 13,  // Top-left corner (NW outer)
    'lower,lower,upper,lower': 0,   // Top-right corner (NE outer)
    'lower,upper,lower,lower': 8,   // Bottom-left corner (SW outer)
    'upper,lower,lower,lower': 15,  // Bottom-right corner (SE outer)
    'lower,upper,upper,upper': 7,   // Inner corner
    'upper,lower,upper,upper': 2,   // Inner corner
    'upper,upper,lower,upper': 13,  // Inner corner
    'upper,upper,upper,lower': 14,  // Inner corner
    'upper,lower,lower,upper': 4,   // Diagonal
    'lower,upper,upper,lower': 10   // Diagonal
};
```

## Debugging Strategy for Future Tilesets

1. **Create numbered diagnostic tiles** using `number_real_tileset.js`
2. **Load numbered tileset** in Game.js temporarily
3. **Walk around and screenshot** all edge/corner positions
4. **Manually identify** which numbered tile appears where
5. **Create manual mapping** based on visual confirmation (ignore JSON)
6. **Switch back** to regular tileset once confirmed

## For Future Towns/Cities

### Creating New Terrain Types
When adding grass/dirt, forest/plains, etc.:

1. Generate numbered diagnostic tileset first
2. Create small test area with all edge/corner cases
3. Visually confirm tile numbers
4. Build manual cornerToTile mapping
5. Test thoroughly before expanding

### Terrain Map Design
```javascript
// Example: Island town (water edges, grass center)
for (let row = 0; row < tilesHigh; row++) {
    for (let col = 0; col < tilesWide; col++) {
        if (isEdge(row, col)) {
            terrainMap[row][col] = 1; // Water
        } else {
            terrainMap[row][col] = 0; // Grass
        }
    }
}
```

### Multi-Tileset Approach
For complex maps with multiple terrain transitions:
- Each terrain pair needs its own AutoTiler instance
- Render in layers: base terrain → transitions → decorations
- Use separate terrain maps for each transition type

## Common Pitfalls to Avoid

❌ **Don't trust PixelLab JSON metadata** - Always verify visually
❌ **Don't use AND logic for corners** - Use OR logic (edges influence adjacent corners)
❌ **Don't autotile water tiles** - Only autotile the "solid" terrain (sand/grass/etc)
❌ **Don't skip numbered diagnostic tiles** - Essential for debugging
❌ **Don't assume patterns** - Every tileset may have different tile arrangements

## Files to Reference
- `/client/js/world/AutoTiler.js` - Working autotiling implementation
- `/number_real_tileset.js` - Script to create diagnostic numbered tiles
- `/client/js/world/WorldMap.js` - Terrain map generation
