// AutoTiler for PixelLab Wang 2-Corner Tilesets (Sand/Water)
//
// Proper Wang 2-corner logic: corners are the data, tiles are derived.
// The corner grid is offset from the tile grid — each tile has 4 corners:
//   NW = corner(col, row)
//   NE = corner(col+1, row)
//   SW = corner(col, row+1)
//   SE = corner(col+1, row+1)
//
// A corner is "sand" (upper) if ANY of the 4 tiles sharing that corner is sand.
// Standard Wang index: NE=1, SE=2, SW=4, NW=8 (where 1 = sand/upper)
// Then mapped to PixelLab PNG position.

class AutoTiler {
    constructor() {
        // Standard Wang index → PNG position in PixelLab tileset
        // This mapping is consistent across ALL PixelLab tilesets
        this.wangToPng = [
            6,   // wang 0  → all water (lower everywhere)
            2,   // wang 1  → NE sand only
            7,   // wang 2  → SE sand only
            11,  // wang 3  → NE+SE sand
            10,  // wang 4  → SW sand only
            4,   // wang 5  → NE+SW sand (diagonal)
            9,   // wang 6  → SE+SW sand
            15,  // wang 7  → NE+SE+SW sand
            5,   // wang 8  → NW sand only
            3,   // wang 9  → NE+NW sand
            14,  // wang 10 → SE+NW sand (diagonal)
            0,   // wang 11 → NE+SE+NW sand
            1,   // wang 12 → SW+NW sand
            13,  // wang 13 → NE+SW+NW sand
            8,   // wang 14 → SE+SW+NW sand
            12,  // wang 15 → all sand (upper everywhere)
        ];
    }

    /**
     * Auto-tile a terrain layer using proper Wang 2-corner logic.
     * @param {Array<Array<number>>} terrainMap - 2D array (0=sand/land, 1=water)
     * @param {number} tilesWide - Map width in tiles
     * @param {number} tilesHigh - Map height in tiles
     * @returns {Array<Array<number>>} Tile ID map (PNG positions)
     */
    autoTileLayer(terrainMap, tilesWide, tilesHigh) {
        // Step 1: Build corner grid
        // Corner grid is (tilesWide+1) x (tilesHigh+1)
        // A corner is "sand" (upper) if ANY of its 4 adjacent tiles is sand (not water)
        const cornersWide = tilesWide + 1;
        const cornersHigh = tilesHigh + 1;

        const isSand = (col, row) => {
            if (row < 0 || row >= tilesHigh || col < 0 || col >= tilesWide) {
                return false; // Out of bounds = water
            }
            return terrainMap[row][col] !== 1; // anything not water is sand
        };

        // Build corner array
        const cornerIsSand = [];
        for (let cy = 0; cy < cornersHigh; cy++) {
            cornerIsSand[cy] = [];
            for (let cx = 0; cx < cornersWide; cx++) {
                // Corner (cx, cy) is shared by tiles:
                //   (cx-1, cy-1) = NW tile
                //   (cx,   cy-1) = NE tile
                //   (cx-1, cy)   = SW tile
                //   (cx,   cy)   = SE tile
                cornerIsSand[cy][cx] =
                    isSand(cx - 1, cy - 1) ||
                    isSand(cx,     cy - 1) ||
                    isSand(cx - 1, cy)     ||
                    isSand(cx,     cy);
            }
        }

        // Step 2: For each tile, compute Wang index from its 4 corners
        const tileLayer = [];
        for (let row = 0; row < tilesHigh; row++) {
            tileLayer[row] = [];
            for (let col = 0; col < tilesWide; col++) {
                // Tile (col, row) has corners:
                //   NW = corner(col,   row)
                //   NE = corner(col+1, row)
                //   SW = corner(col,   row+1)
                //   SE = corner(col+1, row+1)
                const nw = cornerIsSand[row][col];
                const ne = cornerIsSand[row][col + 1];
                const sw = cornerIsSand[row + 1][col];
                const se = cornerIsSand[row + 1][col + 1];

                // Standard Wang 2-corner index: NE=1, SE=2, SW=4, NW=8
                let wangIndex = 0;
                if (ne) wangIndex += 1;
                if (se) wangIndex += 2;
                if (sw) wangIndex += 4;
                if (nw) wangIndex += 8;

                // Map to PNG tile position
                tileLayer[row][col] = this.wangToPng[wangIndex];
            }
        }

        return tileLayer;
    }

    /**
     * Debug self-check (stub for compatibility)
     */
    selfCheck(terrainMap, tilesWide, tilesHigh) {
        return {
            missingPatterns: [],
            tileCounts: {},
            waterTiles: 0,
            sandTiles: 0
        };
    }
}
