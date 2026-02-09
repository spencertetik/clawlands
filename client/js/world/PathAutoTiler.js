// PathAutoTiler for PixelLab Sand→Path Wang tilesets
// Maps corner terrain to tile positions in the sand_path tileset PNG
// "upper" = path present, "lower" = sand (no path)
class PathAutoTiler {
    constructor() {
        // Corner pattern → tile position in 4x4 PNG grid
        // Order: NW, NE, SW, SE
        this.cornerToTile = {
            'upper,upper,lower,upper': 0,   // wang_13
            'upper,lower,upper,lower': 1,   // wang_10
            'lower,upper,lower,lower': 2,   // wang_4
            'upper,upper,lower,lower': 3,   // wang_12
            'lower,upper,upper,lower': 4,   // wang_6
            'upper,lower,lower,lower': 5,   // wang_8
            'lower,lower,lower,lower': 6,   // wang_0 (all sand - skip rendering)
            'lower,lower,lower,upper': 7,   // wang_1
            'upper,lower,upper,upper': 8,   // wang_11
            'lower,lower,upper,upper': 9,   // wang_3
            'lower,lower,upper,lower': 10,  // wang_2
            'lower,upper,lower,upper': 11,  // wang_5
            'upper,upper,upper,upper': 12,  // wang_15 (all path)
            'upper,upper,upper,lower': 13,  // wang_14
            'upper,lower,lower,upper': 14,  // wang_9
            'lower,upper,upper,upper': 15,  // wang_7
        };
    }

    /**
     * Build a path tile layer from a set of path positions
     * @param {Set<string>} pathPositions - Set of "col,row" strings where paths exist
     * @param {number} tilesWide - Map width in tiles
     * @param {number} tilesHigh - Map height in tiles
     * @returns {Array<Array<object|null>>} 2D array of {id, tileset:'path'} or null
     */
    buildPathLayer(pathPositions, tilesWide, tilesHigh) {
        const pathLayer = [];

        const isPath = (col, row) => {
            return pathPositions.has(`${col},${row}`);
        };

        for (let row = 0; row < tilesHigh; row++) {
            pathLayer[row] = [];
            for (let col = 0; col < tilesWide; col++) {
                // Only process tiles that are paths or adjacent to paths
                const currentIsPath = isPath(col, row);
                
                // Check if any neighbor is a path
                const hasPathNeighbor = isPath(col-1, row) || isPath(col+1, row) || 
                                        isPath(col, row-1) || isPath(col, row+1);
                
                if (!currentIsPath && !hasPathNeighbor) {
                    pathLayer[row][col] = null;
                    continue;
                }

                // Determine corner states using cardinal neighbor check
                const n = isPath(col, row - 1);
                const e = isPath(col + 1, row);
                const s = isPath(col, row + 1);
                const w = isPath(col - 1, row);

                // For current path tiles: corners are "upper" (path) unless edge neighbor is sand
                // For sand tiles adjacent to path: corners are "lower" (sand) unless edge neighbor is path
                let nw, ne, sw, se;

                if (currentIsPath) {
                    // This IS a path tile — check which edges touch sand
                    // Corner is "lower" only if BOTH adjacent edges are sand
                    nw = (n || w) ? 'upper' : 'lower';
                    ne = (n || e) ? 'upper' : 'lower';
                    sw = (s || w) ? 'upper' : 'lower';
                    se = (s || e) ? 'upper' : 'lower';

                    // All-path interior tile
                    if (n && e && s && w) {
                        nw = ne = sw = se = 'upper';
                    }
                } else {
                    // This is a SAND tile adjacent to path — show transition edge
                    nw = (n && w) ? 'upper' : (n || w) ? 'lower' : 'lower';
                    ne = (n && e) ? 'upper' : (n || e) ? 'lower' : 'lower';
                    sw = (s && w) ? 'upper' : (s || w) ? 'lower' : 'lower';
                    se = (s && e) ? 'upper' : (s || e) ? 'lower' : 'lower';
                    
                    // If all corners are lower, this is pure sand — skip
                    if (nw === 'lower' && ne === 'lower' && sw === 'lower' && se === 'lower') {
                        pathLayer[row][col] = null;
                        continue;
                    }
                }

                const key = `${nw},${ne},${sw},${se}`;
                const tileId = this.cornerToTile[key];

                if (tileId === undefined || tileId === 6) {
                    // 6 = all sand, skip
                    pathLayer[row][col] = null;
                } else {
                    pathLayer[row][col] = { id: tileId, tileset: 'path' };
                }
            }
        }

        return pathLayer;
    }
}
