// AutoTiler for PixelLab Wang tilesets
// Maps corner terrain to exact tile IDs from tileset JSON
class AutoTiler {
    constructor() {
        // Manual mapping confirmed in WANG_TILESET_NOTES.md (visual verification)
        // Corner states: 'lower' = water present, 'upper' = sand present
        this.cornerToTile = {
            'upper,upper,upper,upper': 6,   // All sand
            'lower,lower,lower,lower': 12,  // All water
            'lower,lower,upper,upper': 3,   // North edge
            'upper,upper,lower,lower': 9,   // South edge
            'lower,upper,lower,upper': 1,   // West edge: water to west
            'upper,lower,upper,lower': 11,  // East edge: water to east
            'lower,lower,lower,upper': 13,  // Top left corner (NW outer): N+W water, E+S sand
            'lower,lower,upper,lower': 0,   // Top right corner (NE outer): N+E water, W+S sand
            'lower,upper,lower,lower': 8,   // Bottom left corner (SW outer): S+W water, N+E sand
            'upper,lower,lower,lower': 15,  // Bottom right corner (SE outer): S+E water, N+W sand
            'lower,upper,upper,upper': 7,   // Inner corner
            'upper,lower,upper,upper': 2,   // Inner corner
            'upper,upper,lower,upper': 13,  // Inner corner
            'upper,upper,upper,lower': 14,  // Inner corner
            'upper,lower,lower,upper': 4,   // Diagonal
            'lower,upper,upper,lower': 10   // Diagonal
        };
    }

    /**
     * Auto-tile an entire layer
     * @param {Array<Array<number>>} terrainMap - 2D array (0=sand, 1=water)
     * @param {number} tilesWide - Width
     * @param {number} tilesHigh - Height
     * @returns {Array<Array<number>>} Tile ID map
     */
    autoTileLayer(terrainMap, tilesWide, tilesHigh) {
        const tileLayer = [];

        // Helper to check if a position is water
        const isWater = (col, row) => {
            if (row < 0 || row >= tilesHigh || col < 0 || col >= tilesWide) {
                return false; // Out of bounds = sand (not water)
            }
            return terrainMap[row][col] === 1;
        };

        // Process each tile position
        for (let row = 0; row < tilesHigh; row++) {
            tileLayer[row] = [];
            for (let col = 0; col < tilesWide; col++) {
                const currentIsWater = isWater(col, row);

                // If this tile is water, just use tile 12
                if (currentIsWater) {
                    tileLayer[row][col] = 12;
                    continue;
                }

                // This is a SAND tile - check neighbors to determine which tile to use
                const n = isWater(col, row - 1);
                const e = isWater(col + 1, row);
                const s = isWater(col, row + 1);
                const w = isWater(col - 1, row);

                // Wang tile logic per notes: use OR for edges
                const nw = (n || w) ? 'lower' : 'upper';
                const ne = (n || e) ? 'lower' : 'upper';
                const sw = (s || w) ? 'lower' : 'upper';
                const se = (s || e) ? 'lower' : 'upper';

                const key = `${nw},${ne},${sw},${se}`;
                const tileId = this.cornerToTile[key];

                if (tileId === undefined) {
                    console.warn(`No tile found for corners: ${key} at (${col},${row})`);
                    tileLayer[row][col] = 6; // Default to all sand (tile 6)
                } else {
                    tileLayer[row][col] = tileId;
                    // Debug: Log edge tiles
                    if (tileId !== 6 && tileId !== 12) {
                        console.log(`Edge/corner at (${col},${row}): n=${n} e=${e} s=${s} w=${w} pattern=${key} → tile ${tileId}`);
                    }
                }
            }
        }

        return tileLayer;
    }

    /**
     * Run a terrain self-check and return diagnostics
     * @param {Array<Array<number>>} terrainMap
     * @param {number} tilesWide
     * @param {number} tilesHigh
     * @returns {{missingPatterns: string[], tileCounts: Object, waterTiles: number, sandTiles: number}}
     */
    selfCheck(terrainMap, tilesWide, tilesHigh) {
        const missingPatterns = new Set();
        const tileCounts = {};
        let waterTiles = 0;
        let sandTiles = 0;

        const isWater = (col, row) => {
            if (row < 0 || row >= tilesHigh || col < 0 || col >= tilesWide) {
                return false;
            }
            return terrainMap[row][col] === 1;
        };

        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                const currentIsWater = isWater(col, row);
                if (currentIsWater) {
                    waterTiles++;
                    tileCounts[12] = (tileCounts[12] || 0) + 1;
                    continue;
                }

                sandTiles++;

                const n = isWater(col, row - 1);
                const e = isWater(col + 1, row);
                const s = isWater(col, row + 1);
                const w = isWater(col - 1, row);

                const nw = (n || w) ? 'lower' : 'upper';
                const ne = (n || e) ? 'lower' : 'upper';
                const sw = (s || w) ? 'lower' : 'upper';
                const se = (s || e) ? 'lower' : 'upper';

                const key = `${nw},${ne},${sw},${se}`;
                const tileId = this.cornerToTile[key];

                if (tileId === undefined) {
                    missingPatterns.add(key);
                    tileCounts[6] = (tileCounts[6] || 0) + 1;
                } else {
                    tileCounts[tileId] = (tileCounts[tileId] || 0) + 1;
                }
            }
        }

        return {
            missingPatterns: Array.from(missingPatterns),
            tileCounts,
            waterTiles,
            sandTiles
        };
    }
}
