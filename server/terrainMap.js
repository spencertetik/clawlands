/**
 * terrainMap.js — Generates the same deterministic terrain as the client
 * 
 * Replicates WorldMap.createClawlandsArchipelago() with identical RNG,
 * island grid, island placement, and bridge network so server-side bots
 * can check collision against the real world.
 * 
 * Seed must match client: Game.js uses seed 12345 passed as option,
 * but WorldMap config defaults seed to options.seed ?? 42.
 * Game.js passes { seed: 12345 } → config.seed = 12345.
 */

const WORLD_WIDTH = 120;
const WORLD_HEIGHT = 120;
const TILE_SIZE = 16;

function createRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function generateIslandGrid(worldWidth, worldHeight, config) {
    const islands = [];
    const rng = createRng(config.seed);
    
    const gridSize = Math.ceil(Math.sqrt(config.islandCount));
    const spacingX = Math.floor(worldWidth / (gridSize + 1));
    const spacingY = Math.floor(worldHeight / (gridSize + 1));

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (islands.length >= config.islandCount) break;

            if (rng() < 0.15) continue;

            const baseX = spacingX * (col + 1);
            const baseY = spacingY * (row + 1);

            const x = baseX + Math.floor((rng() - 0.5) * spacingX * 0.3);
            const y = baseY + Math.floor((rng() - 0.5) * spacingY * 0.3);

            const centerX = Math.floor(gridSize / 2);
            const centerY = Math.floor(gridSize / 2);
            const distFromCenter = Math.sqrt((row - centerY) ** 2 + (col - centerX) ** 2);
            const maxDist = Math.sqrt(centerY ** 2 + centerX ** 2);
            
            let sizeBonus = 0;
            if (maxDist > 0) {
                sizeBonus = Math.floor((1 - (distFromCenter / maxDist)) * 4);
            }

            const size = Math.max(config.minIslandSize, 
                Math.min(config.maxIslandSize, 
                    config.minIslandSize + sizeBonus + Math.floor(rng() * 3)));

            islands.push({
                x: Math.max(size, Math.min(worldWidth - size - 1, x)),
                y: Math.max(size, Math.min(worldHeight - size - 1, y)),
                size,
                row, col,
                id: islands.length
            });
        }
        if (islands.length >= config.islandCount) break;
    }

    return islands;
}

function placeIsland(terrainMap, island) {
    const { x: centerX, y: centerY, size } = island;
    
    for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            const distance = Math.sqrt(dx ** 2 + dy ** 2);

            if (x >= 0 && x < terrainMap[0].length && y >= 0 && y < terrainMap.length) {
                const noise = Math.sin(dx * 0.3) * Math.cos(dy * 0.3) * 0.5;
                const effectiveDistance = distance + noise;

                if (effectiveDistance <= size) {
                    terrainMap[y][x] = 0; // land
                }
            }
        }
    }
}

function createBridge(terrainMap, island1, island2) {
    const dx = island2.x - island1.x;
    const dy = island2.y - island1.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.floor(island1.x + dx * t);
        const y = Math.floor(island1.y + dy * t);

        if (x >= 0 && x < terrainMap[0].length && y >= 0 && y < terrainMap.length) {
            terrainMap[y][x] = 0;
            for (let offset of [-1, 0, 1]) {
                const bx = x + offset;
                if (bx >= 0 && bx < terrainMap[0].length) {
                    terrainMap[y][bx] = 0;
                }
            }
        }
    }
}

function createBridgeNetwork(terrainMap, islands, bridgeChance) {
    if (islands.length < 2) return;

    const connected = new Set([0]);
    const unconnected = new Set();
    for (let i = 1; i < islands.length; i++) {
        unconnected.add(i);
    }

    while (unconnected.size > 0) {
        let shortestDistance = Infinity;
        let bestConnection = null;

        for (let connectedId of connected) {
            for (let unconnectedId of unconnected) {
                const i1 = islands[connectedId];
                const i2 = islands[unconnectedId];
                const dist = Math.sqrt((i1.x - i2.x) ** 2 + (i1.y - i2.y) ** 2);
                if (dist < shortestDistance) {
                    shortestDistance = dist;
                    bestConnection = { connected: connectedId, unconnected: unconnectedId };
                }
            }
        }

        if (bestConnection) {
            createBridge(terrainMap, islands[bestConnection.connected], islands[bestConnection.unconnected]);
        }

        connected.add(bestConnection.unconnected);
        unconnected.delete(bestConnection.unconnected);
    }
}

/**
 * Generate the full terrain map matching the client's world.
 * Returns { terrainMap, islands, width, height }
 * terrainMap[row][col]: 0 = land, 1 = water
 */
function generateTerrain() {
    const config = {
        seed: 12345,
        islandCount: 10,
        minIslandSize: 8,
        maxIslandSize: 15,
        bridgeChance: 0.9
    };

    const terrainMap = [];
    for (let row = 0; row < WORLD_HEIGHT; row++) {
        terrainMap[row] = [];
        for (let col = 0; col < WORLD_WIDTH; col++) {
            terrainMap[row][col] = 1; // water
        }
    }

    const islands = generateIslandGrid(WORLD_WIDTH, WORLD_HEIGHT, config);
    for (const island of islands) {
        placeIsland(terrainMap, island);
    }
    createBridgeNetwork(terrainMap, islands, config.bridgeChance);

    return { terrainMap, islands, width: WORLD_WIDTH, height: WORLD_HEIGHT, tileSize: TILE_SIZE };
}

/**
 * Check if a pixel position is walkable (on land).
 * x, y are in PIXEL coordinates (not tile).
 */
function isWalkable(terrainMap, px, py) {
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    if (row < 0 || row >= WORLD_HEIGHT || col < 0 || col >= WORLD_WIDTH) return false;
    return terrainMap[row][col] === 0;
}

/**
 * Check if a 16x24 collision box at (px, py) is fully on land.
 * Checks all four corners of the collision box.
 */
function isBoxWalkable(terrainMap, px, py, w = 16, h = 24) {
    return isWalkable(terrainMap, px, py) &&
           isWalkable(terrainMap, px + w - 1, py) &&
           isWalkable(terrainMap, px, py + h - 1) &&
           isWalkable(terrainMap, px + w - 1, py + h - 1);
}

module.exports = { generateTerrain, isWalkable, isBoxWalkable, TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT };
