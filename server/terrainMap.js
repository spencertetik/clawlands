/**
 * terrainMap.js — Generates the same collision data as the client
 * 
 * Now uses EditorMapData.js to load the actual terrain and decoration data
 * that the client uses, ensuring perfect collision alignment between
 * server-side bots and client players.
 */

let WORLD_WIDTH = 200;
let WORLD_HEIGHT = 200;
const TILE_SIZE = 16;

// Try to load client modules and editor data
let EDITOR_MAP_DATA = null;
let DecorationLoader = null;
let Building = null;

try {
    EDITOR_MAP_DATA = require('../client/js/data/EditorMapData.js');
    DecorationLoader = require('../client/js/core/DecorationLoader.js');
    Building = require('../client/js/world/Building.js');
} catch (e) {
    console.warn('⚠️ Could not load client modules:', e.message);
    console.warn('⚠️ Falling back to procedural terrain generation');
}

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
 * Generate terrain and collision data matching the client's world.
 * Returns { terrainMap, collisionMap, decorations, islands, width, height }
 * 
 * If EditorMapData is available, uses that data exactly.
 * Otherwise falls back to procedural generation.
 */
function generateTerrain() {
    if (EDITOR_MAP_DATA && EDITOR_MAP_DATA.terrainMap) {
        console.log('🗺️ Loading terrain from EditorMapData.js');
        return generateFromEditorData();
    } else {
        console.log('🌊 Generating procedural terrain (editor data not available)');
        return generateProceduralTerrain();
    }
}

/**
 * Generate terrain from editor map data (matches client exactly)
 */
function generateFromEditorData() {
    const data = EDITOR_MAP_DATA;
    
    // Update world dimensions from editor data
    WORLD_WIDTH = data.terrainWidth || 200;
    WORLD_HEIGHT = data.terrainHeight || 200;
    
    // Convert flat terrain array to 2D if needed
    let terrainMap;
    if (Array.isArray(data.terrainMap) && !Array.isArray(data.terrainMap[0])) {
        terrainMap = [];
        for (let r = 0; r < WORLD_HEIGHT; r++) {
            terrainMap.push(data.terrainMap.slice(r * WORLD_WIDTH, r * WORLD_WIDTH + WORLD_WIDTH));
        }
    } else {
        terrainMap = data.terrainMap;
    }
    
    // Create collision map starting with terrain (1 = water/solid, 0 = land/walkable)
    const collisionMap = terrainMap.map(row => [...row]);
    
    // Process decorations for collision
    const decorations = data.decorations || [];
    
    // Mark bridge tiles as walkable (override water collision)
    // Don't mark decoration collisions on the collision map - handle them separately
    // in the collision detection to match client behavior exactly
    markBridgesWalkable(collisionMap, decorations);
    
    // Compute islands from terrain data
    const islands = computeIslandsFromTerrain(terrainMap);
    
    console.log(`✅ Loaded editor terrain: ${WORLD_WIDTH}×${WORLD_HEIGHT}, ${decorations.length} decorations, ${islands.length} islands`);
    
    return {
        terrainMap,
        collisionMap,
        decorations,
        islands,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        tileSize: TILE_SIZE,
        worldMap: {
            terrainMap,
            collisionLayer: collisionMap,
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT
        }
    };
}

/**
 * Generate procedural terrain (fallback when editor data unavailable)
 */
function generateProceduralTerrain() {
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

    // For procedural, collision map is same as terrain map
    const collisionMap = terrainMap.map(row => [...row]);

    return {
        terrainMap,
        collisionMap,
        decorations: [],
        islands,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        tileSize: TILE_SIZE,
        worldMap: {
            terrainMap,
            collisionLayer: collisionMap,
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT
        }
    };
}

/**
 * Mark decoration collisions on the collision map (DISABLED)
 * 
 * This approach was incorrect - it modified the base collision map with decoration data,
 * but the client keeps terrain and decoration collision separate.
 * Decorations are handled in ServerCollisionSystem.checkDecorationCollision instead.
 */
function markDecorationCollisions(collisionMap, decorations, decorationLoader) {
    // DISABLED - decorations handled separately in collision system
    console.log('🚧 Decoration collision handled separately in collision system');
}

/**
 * Mark bridge tiles as walkable (matches client fixBridgeCollision)
 */
function markBridgesWalkable(collisionMap, decorations) {
    let bridgesFixed = 0;
    
    for (const decor of decorations) {
        // Check if this decoration is a bridge
        const isBridge = decor.type === 'bridge_wood_v' || 
                       decor.type === 'bridge_wood_h' || 
                       (decor.bridge === true) ||
                       (decor.type && decor.type.includes('bridge'));
        
        if (isBridge) {
            const width = decor.width || TILE_SIZE;
            const height = decor.height || TILE_SIZE;
            const startCol = Math.floor(decor.x / TILE_SIZE);
            const endCol = Math.floor((decor.x + width - 1) / TILE_SIZE);
            const startRow = Math.floor(decor.y / TILE_SIZE);
            const endRow = Math.floor((decor.y + height - 1) / TILE_SIZE);
            
            // Force all bridge tiles to be walkable
            for (let row = startRow; row <= endRow; row++) {
                if (row >= 0 && row < collisionMap.length) {
                    for (let col = startCol; col <= endCol; col++) {
                        if (col >= 0 && col < collisionMap[row].length) {
                            collisionMap[row][col] = 0; // Walkable
                            bridgesFixed++;
                        }
                    }
                }
            }
        }
    }
    
    if (bridgesFixed > 0) {
        console.log(`🌉 Fixed ${bridgesFixed} bridge tiles as walkable`);
    }
}

/**
 * Compute islands from terrain data by finding land clusters
 */
function computeIslandsFromTerrain(terrainMap) {
    const visited = new Set();
    const islands = [];
    
    for (let row = 0; row < terrainMap.length; row++) {
        for (let col = 0; col < terrainMap[row].length; col++) {
            if (terrainMap[row][col] === 0 && !visited.has(`${col},${row}`)) {
                // Found unvisited land, flood fill to find island
                const island = floodFillIsland(terrainMap, col, row, visited);
                if (island.size >= 5) { // Only count significant islands
                    islands.push(island);
                }
            }
        }
    }
    
    // Sort by size (largest first) to match client ordering
    islands.sort((a, b) => b.size - a.size);
    
    // Assign IDs
    islands.forEach((island, index) => {
        island.id = index;
    });
    
    return islands;
}

/**
 * Flood fill to find an island's bounds and center
 */
function floodFillIsland(terrainMap, startCol, startRow, visited) {
    const stack = [{col: startCol, row: startRow}];
    const tiles = [];
    let minCol = startCol, maxCol = startCol;
    let minRow = startRow, maxRow = startRow;
    
    while (stack.length > 0) {
        const {col, row} = stack.pop();
        const key = `${col},${row}`;
        
        if (visited.has(key)) continue;
        if (row < 0 || row >= terrainMap.length) continue;
        if (col < 0 || col >= terrainMap[row].length) continue;
        if (terrainMap[row][col] !== 0) continue; // Not land
        
        visited.add(key);
        tiles.push({col, row});
        
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
        
        // Add neighbors
        for (const [dc, dr] of [[0,1], [0,-1], [1,0], [-1,0]]) {
            stack.push({col: col + dc, row: row + dr});
        }
    }
    
    const centerCol = Math.floor((minCol + maxCol) / 2);
    const centerRow = Math.floor((minRow + maxRow) / 2);
    const size = Math.max(maxCol - minCol, maxRow - minRow);
    
    return {
        x: centerCol,
        y: centerRow,
        size: size,
        tiles: tiles.length,
        bounds: { minCol, maxCol, minRow, maxRow }
    };
}

/**
 * Check if a pixel position is walkable.
 * x, y are in PIXEL coordinates (not tile).
 * Uses collision map (0 = walkable, 1 = blocked).
 */
function isWalkable(collisionData, px, py) {
    // Handle both old format (terrainMap only) and new format (with collisionMap)
    const collisionMap = collisionData.collisionMap || collisionData;
    const width = collisionData.width || WORLD_WIDTH;
    const height = collisionData.height || WORLD_HEIGHT;
    
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    if (row < 0 || row >= height || col < 0 || col >= width) return false;
    return collisionMap[row] && collisionMap[row][col] === 0;
}

/**
 * Check if a character collision box is fully walkable.
 * Uses collision map and checks all corners of the box.
 */
function isBoxWalkable(collisionData, px, py, w = 16, h = 24) {
    return isWalkable(collisionData, px, py) &&
           isWalkable(collisionData, px + w - 1, py) &&
           isWalkable(collisionData, px, py + h - 1) &&
           isWalkable(collisionData, px + w - 1, py + h - 1);
}

/**
 * Replicate the client's building placement algorithm (Game.js findBuildingLocationAvoidingOthers)
 * Uses identical deterministic spiral search — no RNG.
 */
function findBuildingLocation(terrainMap, island, width, height, placedPositions) {
    const attempts = 100;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const angle = (attempt / attempts) * Math.PI * 2;
        const radius = (attempt % 10) / 10 * island.size * 0.7;
        const col = island.x + Math.floor(Math.cos(angle) * radius);
        const row = island.y + Math.floor(Math.sin(angle) * radius);

        let valid = true;
        for (let dy = 0; dy < height && valid; dy++) {
            for (let dx = 0; dx < width && valid; dx++) {
                const c = col + dx, r = row + dy;
                if (c < 0 || c >= WORLD_WIDTH || r < 0 || r >= WORLD_HEIGHT) { valid = false; break; }
                if (terrainMap[r]?.[c] === 1) { valid = false; break; }
            }
        }
        if (valid) {
            for (const p of placedPositions) {
                const pad = 3;
                if (!(col + width + pad < p.col || col > p.col + p.width + pad ||
                      row + height + pad < p.row || row > p.row + p.height + pad)) {
                    valid = false; break;
                }
            }
        }
        if (valid) return { col, row };
    }
    return null;
}

/**
 * Generate buildings matching the client exactly.
 * Uses editor data when available, falls back to procedural generation.
 * Returns array of Building instances or building objects.
 */
function generateBuildings(worldData) {
    if (EDITOR_MAP_DATA && EDITOR_MAP_DATA.buildings) {
        console.log('🏠 Loading buildings from EditorMapData.js');
        return generateBuildingsFromEditor(EDITOR_MAP_DATA.buildings);
    } else {
        console.log('🏗️ Generating procedural buildings');
        return generateProceduralBuildings(worldData.terrainMap || worldData.collisionMap, worldData.islands);
    }
}

/**
 * Generate buildings from editor data (matches client exactly)
 */
function generateBuildingsFromEditor(buildingData) {
    const buildings = [];
    
    for (const entry of buildingData) {
        if (!entry || typeof entry.type !== 'string') continue;
        
        const x = typeof entry.x === 'number' ? entry.x : 0;
        const y = typeof entry.y === 'number' ? entry.y : 0;
        
        // Try to create Building instance if class is available
        let building;
        if (Building && typeof Building === 'function') {
            try {
                building = new Building(x, y, entry.type, null);
                if (entry.name) building.name = entry.name;
                if (typeof entry.width === 'number') building.width = entry.width;
                if (typeof entry.height === 'number') building.height = entry.height;
            } catch (e) {
                console.warn(`⚠️ Could not create Building instance: ${e.message}`);
                building = null;
            }
        }
        
        // Fallback to plain object if Building class not available
        if (!building) {
            const spriteSizes = {
                inn: { w: 96, h: 72 },
                shop: { w: 72, h: 55 },
                lighthouse: { w: 48, h: 96 },
                house: { w: 48, h: 48 },
                temple: { w: 64, h: 80 },
                market: { w: 96, h: 64 }
            };
            
            const defaultSize = spriteSizes[entry.type] || { w: 48, h: 48 };
            building = {
                x: x,
                y: y,
                width: entry.width || defaultSize.w,
                height: entry.height || defaultSize.h,
                type: entry.type,
                name: entry.name || `${entry.type}`,
                // Add collision method for compatibility
                checkCollision: function(pointX, pointY) {
                    return simpleBuildingCollisionCheck(this, pointX, pointY);
                }
            };
        }
        
        buildings.push(building);
    }
    
    console.log(`✅ Loaded ${buildings.length} buildings from editor data`);
    return buildings;
}

/**
 * Simple building collision check for fallback objects
 */
function simpleBuildingCollisionCheck(building, pointX, pointY) {
    // Check if point is within building bounds
    if (pointX < building.x || pointX >= building.x + building.width ||
        pointY < building.y || pointY >= building.y + building.height) {
        return false; // Outside building
    }

    // Calculate door zone (simplified)
    const doorWidth = getBuildingDoorWidth(building.type);
    const doorHeight = 20;
    const doorOffsetX = getBuildingDoorOffsetX(building.type, building.width, doorWidth);
    const doorOffsetY = getBuildingDoorOffsetY(building.type);
    
    const doorX = building.x + doorOffsetX;
    const doorY = building.y + building.height - doorHeight - doorOffsetY;

    // Check if point is within the door (no collision there)
    if (pointX >= doorX && pointX < doorX + doorWidth &&
        pointY >= doorY && pointY < doorY + doorHeight) {
        return false; // In doorway, no collision
    }

    return true; // Inside building but not in door = collision
}

/**
 * Helper functions for door calculations
 */
function getBuildingDoorWidth(type) {
    const widths = { 'inn': 16, 'shop': 12, 'house': 10, 'lighthouse': 10, 'dock': 16, 'temple': 14, 'market': 16 };
    return widths[type] || 12;
}

function getBuildingDoorOffsetX(type, buildingWidth, doorWidth) {
    const offsets = { 'inn': 40, 'shop': 42, 'house': 19, 'lighthouse': 19, 'dock': 16, 'temple': 24, 'market': 40 };
    return offsets[type] || Math.floor((buildingWidth - doorWidth) / 2);
}

function getBuildingDoorOffsetY(type) {
    const offsets = { 'inn': 0, 'shop': 0, 'house': 1, 'lighthouse': 5, 'dock': 0, 'temple': 0, 'market': 0 };
    return offsets[type] || 0;
}

/**
 * Generate procedural buildings (fallback)
 */
function generateProceduralBuildings(terrainMap, islands) {
    // Fixed sprite sizes (must match client assets)
    const spriteSizes = {
        inn: { w: 96, h: 72 },
        shop: { w: 72, h: 55 },
        lighthouse: { w: 48, h: 96 },
        house: { w: 48, h: 48 }
    };

    // Main island buildings (same order as client Game.js)
    const mainBuildings = [
        { type: 'inn', name: 'The Drift-In Inn' },
        { type: 'shop', name: 'Continuity Goods' },
        { type: 'lighthouse', name: "Current's Edge Light" },
        { type: 'house', name: 'Anchor House' },
        { type: 'house', name: 'Molting Den' },
        { type: 'house', name: 'Shell & Stay' }
    ];

    // Secondary island buildings
    const secondaryBuildings = [
        { type: 'house', name: 'Beach Hut' },
        { type: 'house', name: 'Shell Cottage' },
        { type: 'shop', name: 'Tide Shop' },
        { type: 'house', name: 'Driftwood Cabin' }
    ];

    const sortedIslands = [...islands].sort((a, b) => b.size - a.size);
    const buildings = [];
    const placedPositions = [];

    if (sortedIslands.length === 0) {
        console.warn('⚠️ No islands found for building placement');
        return buildings;
    }

    const mainIsland = sortedIslands[0];

    // Place main island buildings
    for (const config of mainBuildings) {
        const sz = spriteSizes[config.type];
        const tw = Math.ceil(sz.w / TILE_SIZE);
        const th = Math.ceil(sz.h / TILE_SIZE);
        const pos = findBuildingLocation(terrainMap, mainIsland, tw, th + 2, placedPositions);
        if (pos) {
            placedPositions.push({ col: pos.col, row: pos.row, width: tw, height: th + 2 });
            
            const building = {
                x: pos.col * TILE_SIZE,
                y: pos.row * TILE_SIZE,
                width: sz.w,
                height: sz.h,
                tileCol: pos.col,
                tileRow: pos.row,
                tilesW: tw,
                tilesH: th,
                type: config.type,
                name: config.name,
                checkCollision: function(pointX, pointY) {
                    return simpleBuildingCollisionCheck(this, pointX, pointY);
                }
            };
            
            buildings.push(building);
        }
    }

    // Place secondary island buildings
    for (let i = 1; i < sortedIslands.length; i++) {
        const island = sortedIslands[i];
        if (island.size < 8) continue;
        const numBuildings = island.size > 12 ? 2 : 1;
        const islandPlaced = [];

        for (let b = 0; b < numBuildings; b++) {
            const config = secondaryBuildings[(i + b) % secondaryBuildings.length];
            const sz = spriteSizes[config.type];
            const tw = Math.ceil(sz.w / TILE_SIZE);
            const th = Math.ceil(sz.h / TILE_SIZE);
            const pos = findBuildingLocation(terrainMap, island, tw, th + 2, islandPlaced);
            if (pos) {
                islandPlaced.push({ col: pos.col, row: pos.row, width: tw, height: th + 2 });
                
                const building = {
                    x: pos.col * TILE_SIZE,
                    y: pos.row * TILE_SIZE,
                    width: sz.w,
                    height: sz.h,
                    tileCol: pos.col,
                    tileRow: pos.row,
                    tilesW: tw,
                    tilesH: th,
                    type: config.type,
                    name: config.name,
                    checkCollision: function(pointX, pointY) {
                        return simpleBuildingCollisionCheck(this, pointX, pointY);
                    }
                };
                
                buildings.push(building);
            }
        }
    }

    return buildings;
}

module.exports = { 
    generateTerrain, 
    generateBuildings, 
    isWalkable, 
    isBoxWalkable, 
    TILE_SIZE, 
    get WORLD_WIDTH() { return WORLD_WIDTH; },
    get WORLD_HEIGHT() { return WORLD_HEIGHT; }
};
