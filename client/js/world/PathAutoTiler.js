// PathAutoTiler for PixelLab Sand→Path Wang 2-Corner Tilesets
//
// KEY INSIGHT: Wang 2-corner tiles work on CORNERS, not cells.
// The corner grid is offset from the tile grid — each tile has 4 corners:
//   NW = corner(col, row)
//   NE = corner(col+1, row)  
//   SW = corner(col, row+1)
//   SE = corner(col+1, row+1)
//
// A corner is "upper" (path) if ANY of the 4 tiles touching it is a path tile.
// Standard Wang index: NE=1, SE=2, SW=4, NW=8
// Then we map that index to the actual position in the PixelLab PNG.

class PathAutoTiler {
    constructor() {
        // Standard Wang index → PNG position in PixelLab tileset
        // Generated from pixellab_sand_path_metadata.json corner data
        this.wangToPng = [
            6,   // wang 0  → all sand (lower everywhere)
            2,   // wang 1  → NE only
            7,   // wang 2  → SE only
            11,  // wang 3  → NE+SE
            10,  // wang 4  → SW only
            4,   // wang 5  → NE+SW (diagonal)
            9,   // wang 6  → SE+SW
            15,  // wang 7  → NE+SE+SW
            5,   // wang 8  → NW only
            3,   // wang 9  → NE+NW
            14,  // wang 10 → SE+NW (diagonal)
            0,   // wang 11 → NE+SE+NW
            1,   // wang 12 → SW+NW
            13,  // wang 13 → NE+SW+NW
            8,   // wang 14 → SE+SW+NW
            12,  // wang 15 → all path (upper everywhere)
        ];
    }

    /**
     * Build a path tile layer from a set of path tile positions.
     * Uses proper Wang 2-corner logic: corners are set based on
     * which adjacent tiles are paths.
     * 
     * @param {Set<string>} pathPositions - Set of "col,row" strings where paths exist
     * @param {number} tilesWide - Map width in tiles
     * @param {number} tilesHigh - Map height in tiles
     * @param {string} tilesetKey - Tileset key to use (default 'path')
     * @param {Set<string>} allPathPositions - Optional combined set of ALL path types for corner computation.
     *   When provided, corners treat any position in this set as "upper" terrain,
     *   but only positions in pathPositions get rendered. This prevents sand gaps
     *   where different path types meet (e.g. dirt next to cobblestone).
     * @returns {Array<Array<object|null>>} 2D array of {id, tileset} or null
     */
    buildPathLayer(pathPositions, tilesWide, tilesHigh, tilesetKey = 'path', allPathPositions = null) {
        // Step 1: Build corner grid
        // Corner grid is (tilesWide+1) x (tilesHigh+1)
        // A corner at (cx, cy) is "upper" (path) if any of its 4 adjacent tiles is a path
        const cornersWide = tilesWide + 1;
        const cornersHigh = tilesHigh + 1;
        
        // Use allPathPositions for corner computation if provided (prevents sand gaps between path types)
        const cornerSet = allPathPositions || pathPositions;
        const isPath = (col, row) => cornerSet.has(`${col},${row}`);
        
        // cornerIsUpper[cy][cx] = true if corner is "path" terrain
        const cornerIsUpper = [];
        for (let cy = 0; cy < cornersHigh; cy++) {
            cornerIsUpper[cy] = [];
            for (let cx = 0; cx < cornersWide; cx++) {
                // Corner (cx, cy) is shared by tiles:
                //   (cx-1, cy-1) = NW tile
                //   (cx,   cy-1) = NE tile  
                //   (cx-1, cy)   = SW tile
                //   (cx,   cy)   = SE tile
                cornerIsUpper[cy][cx] = 
                    isPath(cx - 1, cy - 1) || 
                    isPath(cx,     cy - 1) || 
                    isPath(cx - 1, cy)     || 
                    isPath(cx,     cy);
            }
        }
        
        // Step 2: Build a set of tiles that need path rendering
        // Only actual path tiles and their immediate neighbors (1 tile border)
        const relevantTiles = new Set();
        for (const pos of pathPositions) {
            const [c, r] = pos.split(',').map(Number);
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < tilesHigh && nc >= 0 && nc < tilesWide) {
                        relevantTiles.add(`${nc},${nr}`);
                    }
                }
            }
        }
        
        // Step 3: For each relevant tile, compute Wang index from its 4 corners
        const pathLayer = [];
        for (let row = 0; row < tilesHigh; row++) {
            pathLayer[row] = [];
            for (let col = 0; col < tilesWide; col++) {
                // Skip tiles that aren't near any path
                if (!relevantTiles.has(`${col},${row}`)) {
                    pathLayer[row][col] = null;
                    continue;
                }
                
                // Tile (col, row) has corners:
                //   NW = corner(col,   row)
                //   NE = corner(col+1, row)
                //   SW = corner(col,   row+1)
                //   SE = corner(col+1, row+1)
                const nw = cornerIsUpper[row][col];
                const ne = cornerIsUpper[row][col + 1];
                const sw = cornerIsUpper[row + 1][col];
                const se = cornerIsUpper[row + 1][col + 1];
                
                // Standard Wang 2-corner index: NE=1, SE=2, SW=4, NW=8
                let wangIndex = 0;
                if (ne) wangIndex += 1;
                if (se) wangIndex += 2;
                if (sw) wangIndex += 4;
                if (nw) wangIndex += 8;
                
                // Skip all-sand tiles (wang index 0)
                if (wangIndex === 0) {
                    pathLayer[row][col] = null;
                    continue;
                }
                
                // Map wang index to PNG tile position
                const pngPosition = this.wangToPng[wangIndex];
                pathLayer[row][col] = { id: pngPosition, tileset: tilesetKey };
            }
        }
        
        return pathLayer;
    }
}
