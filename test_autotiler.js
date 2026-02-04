// Test the AutoTiler logic
class AutoTiler {
    constructor() {
        this.cornerToTile = {
            'lower,lower,lower,lower': 0,   // All sand
            'lower,lower,lower,upper': 1,
            'lower,lower,upper,lower': 2,
            'lower,lower,upper,upper': 3,
            'lower,upper,lower,lower': 4,
            'lower,upper,lower,upper': 5,
            'lower,upper,upper,lower': 6,
            'lower,upper,upper,upper': 7,
            'upper,lower,lower,lower': 8,
            'upper,lower,lower,upper': 9,
            'upper,lower,upper,lower': 10,
            'upper,lower,upper,upper': 11,
            'upper,upper,lower,lower': 12,
            'upper,upper,lower,upper': 13,
            'upper,upper,upper,lower': 14,
            'upper,upper,upper,upper': 15   // All water
        };
    }

    autoTileLayer(terrainMap, tilesWide, tilesHigh) {
        const tileLayer = [];
        const isWater = (col, row) => {
            if (row < 0 || row >= tilesHigh || col < 0 || col >= tilesWide) {
                return false;
            }
            return terrainMap[row][col] === 1;
        };

        for (let row = 0; row < tilesHigh; row++) {
            tileLayer[row] = [];
            for (let col = 0; col < tilesWide; col++) {
                const n = isWater(col, row - 1);
                const e = isWater(col + 1, row);
                const s = isWater(col, row + 1);
                const w = isWater(col - 1, row);
                const nw_diag = isWater(col - 1, row - 1);
                const ne_diag = isWater(col + 1, row - 1);
                const sw_diag = isWater(col - 1, row + 1);
                const se_diag = isWater(col + 1, row + 1);

                const nw = (n && w && nw_diag) ? 'upper' : 'lower';
                const ne = (n && e && ne_diag) ? 'upper' : 'lower';
                const sw = (s && w && sw_diag) ? 'upper' : 'lower';
                const se = (s && e && se_diag) ? 'upper' : 'lower';

                const key = `${nw},${ne},${sw},${se}`;
                const tileId = this.cornerToTile[key] || 0;
                tileLayer[row][col] = tileId;
            }
        }
        return tileLayer;
    }
}

// Create terrain map
const tilesWide = 30;
const tilesHigh = 30;
const terrainMap = [];
for (let row = 0; row < tilesHigh; row++) {
    terrainMap[row] = [];
    for (let col = 0; col < tilesWide; col++) {
        if (row < 3 || row >= tilesHigh - 3 || col < 2 || col >= tilesWide - 2) {
            terrainMap[row][col] = 1; // Water
        } else {
            terrainMap[row][col] = 0; // Sand
        }
    }
}

// Test center sand tile (should be tile 0)
const autoTiler = new AutoTiler();
const result = autoTiler.autoTileLayer(terrainMap, tilesWide, tilesHigh);

console.log('Sample tiles:');
console.log('Center (15,15) - terrain:', terrainMap[15][15], 'tile:', result[15][15], '(should be 0 for all sand)');
console.log('Edge (1,1) - terrain:', terrainMap[1][1], 'tile:', result[1][1], '(should be 15 for all water)');
console.log('Transition (3,3) - terrain:', terrainMap[3][3], 'tile:', result[3][3]);

// Count tile usage
const tileCounts = {};
for (let row = 0; row < tilesHigh; row++) {
    for (let col = 0; col < tilesWide; col++) {
        const tile = result[row][col];
        tileCounts[tile] = (tileCounts[tile] || 0) + 1;
    }
}
console.log('\nTile usage:');
Object.keys(tileCounts).sort((a,b) => a-b).forEach(tile => {
    console.log(`Tile ${tile}: ${tileCounts[tile]} times`);
});
