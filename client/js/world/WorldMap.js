// World map class for managing tile data
class WorldMap {
    constructor(width, height, tileSize = CONSTANTS.TILE_SIZE) {
        this.width = width;
        this.height = height;
        this.tileSize = tileSize;

        // Create empty layers
        this.groundLayer = this.createEmptyLayer();
        this.decorationLayer = this.createEmptyLayer();
        this.collisionLayer = this.createEmptyLayer();
    }

    // Create an empty 2D array
    createEmptyLayer() {
        const layer = [];
        for (let row = 0; row < this.height; row++) {
            layer[row] = [];
            for (let col = 0; col < this.width; col++) {
                layer[row][col] = null;
            }
        }
        return layer;
    }

    // Set a tile value
    setTile(layer, col, row, value) {
        if (this.isValidPosition(col, row)) {
            layer[row][col] = value;
        }
    }

    // Get a tile value
    getTile(layer, col, row) {
        if (this.isValidPosition(col, row)) {
            return layer[row][col];
        }
        return null;
    }

    // Check if position is valid
    isValidPosition(col, row) {
        return col >= 0 && col < this.width && row >= 0 && row < this.height;
    }

    // Fill a rectangular area with a tile
    fillRect(layer, startCol, startRow, width, height, tileId) {
        for (let row = startRow; row < startRow + height; row++) {
            for (let col = startCol; col < startCol + width; col++) {
                this.setTile(layer, col, row, tileId);
            }
        }
    }

    // Create a test world with varied terrain
    createTestWorld() {
        const tilesWide = this.width;
        const tilesHigh = this.height;

        // Reset layers
        this.groundLayer = this.createEmptyLayer();
        this.decorationLayer = this.createEmptyLayer();
        this.collisionLayer = this.createEmptyLayer();
        this.meta = { type: 'outdoor', name: 'Beach' };

        // Step 1: Create terrain map (0 = sand, 1 = water)
        const terrainMap = [];
        for (let row = 0; row < tilesHigh; row++) {
            terrainMap[row] = [];
            for (let col = 0; col < tilesWide; col++) {
                // Water at edges, sand in center
                if (row < 3 || row >= tilesHigh - 3 || col < 2 || col >= tilesWide - 2) {
                    terrainMap[row][col] = 1; // Water at edges
                } else {
                    terrainMap[row][col] = 0; // Sand in center
                }
            }
        }

        this.terrainMap = terrainMap;

        // Step 2: Use AutoTiler to generate proper tile indices
        const autoTiler = new AutoTiler();
        const tiledLayer = autoTiler.autoTileLayer(terrainMap, tilesWide, tilesHigh);

        // Terrain self-check (debug)
        const diagnostics = autoTiler.selfCheck(terrainMap, tilesWide, tilesHigh);
        if (diagnostics.missingPatterns.length > 0) {
            console.warn('⚠️ Terrain self-check missing patterns:', diagnostics.missingPatterns);
        }
        console.log('🧪 Terrain self-check tile usage:', diagnostics.tileCounts);

        // Step 3: Apply autotiled result to ground layer
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                this.setTile(this.groundLayer, col, row, tiledLayer[row][col]);
            }
        }

        // Collision layer - water is solid
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                if (terrainMap[row][col] === 1) {
                    this.setTile(this.collisionLayer, col, row, 1); // Solid water
                }
            }
        }

        console.log('✅ World autotiled with Wang tileset');
    }

    // Create a ClawWorld archipelago with multiple islands
    createClawWorldArchipelago(options = {}) {
        const tilesWide = this.width;
        const tilesHigh = this.height;

        // Reset layers
        this.groundLayer = this.createEmptyLayer();
        this.decorationLayer = this.createEmptyLayer();
        this.collisionLayer = this.createEmptyLayer();
        this.meta = { type: 'outdoor', name: 'ClawWorld Archipelago' };

        const config = {
            seed: options.seed ?? 42,
            islandCount: options.islandCount ?? Math.max(3, Math.floor(Math.min(tilesWide, tilesHigh) / 25)),
            minIslandSize: options.minIslandSize ?? 8,
            maxIslandSize: options.maxIslandSize ?? 15,
            bridgeChance: options.bridgeChance ?? 0.8
        };

        console.log(`🏝️ Generating ClawWorld archipelago with ${config.islandCount} islands...`);

        // Step 1: Create base ocean
        const terrainMap = [];
        for (let row = 0; row < tilesHigh; row++) {
            terrainMap[row] = [];
            for (let col = 0; col < tilesWide; col++) {
                terrainMap[row][col] = 1; // 1 = water
            }
        }

        // Step 2: Generate islands in grid pattern
        const islands = this.generateIslandGrid(tilesWide, tilesHigh, config);
        
        // Step 3: Place islands
        for (let island of islands) {
            this.placeIsland(terrainMap, island);
        }

        // Step 4: Create bridges between islands
        this.createBridgeNetwork(terrainMap, islands, config.bridgeChance);

        // Step 5: Use AutoTiler for seamless transitions
        this.terrainMap = terrainMap;
        const autoTiler = new AutoTiler();
        const tiledLayer = autoTiler.autoTileLayer(terrainMap, tilesWide, tilesHigh);

        // Apply to ground layer
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                this.setTile(this.groundLayer, col, row, tiledLayer[row][col]);
            }
        }

        // Step 6: Add collision for water
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                if (terrainMap[row][col] === 1) {
                    this.setTile(this.collisionLayer, col, row, 1);
                }
            }
        }

        // Step 7: Store island data for building placement
        this.islands = islands;

        console.log(`🌊 Generated ${islands.length} islands with autotiled coastlines`);
        return islands;
    }

    generateIslandGrid(worldWidth, worldHeight, config) {
        const islands = [];
        const rng = this.createRng(config.seed);
        
        // Calculate grid spacing
        const gridSize = Math.ceil(Math.sqrt(config.islandCount));
        const spacingX = Math.floor(worldWidth / (gridSize + 1));
        const spacingY = Math.floor(worldHeight / (gridSize + 1));

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                if (islands.length >= config.islandCount) break;

                // Skip some positions for natural variation
                if (rng() < 0.15) continue;

                const baseX = spacingX * (col + 1);
                const baseY = spacingY * (row + 1);

                // Add variation but keep organized
                const x = baseX + Math.floor((rng() - 0.5) * spacingX * 0.3);
                const y = baseY + Math.floor((rng() - 0.5) * spacingY * 0.3);

                // Vary island size - center islands larger
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
                    size: size,
                    row: row,
                    col: col,
                    id: islands.length
                });
            }
            if (islands.length >= config.islandCount) break;
        }

        return islands;
    }

    placeIsland(terrainMap, island) {
        const { x: centerX, y: centerY, size } = island;
        
        for (let dy = -size; dy <= size; dy++) {
            for (let dx = -size; dx <= size; dx++) {
                const x = centerX + dx;
                const y = centerY + dy;
                const distance = Math.sqrt(dx ** 2 + dy ** 2);

                if (x >= 0 && x < terrainMap[0].length && y >= 0 && y < terrainMap.length) {
                    // Create organic island shape
                    const noise = Math.sin(dx * 0.3) * Math.cos(dy * 0.3) * 0.5;
                    const effectiveDistance = distance + noise;

                    if (effectiveDistance <= size) {
                        terrainMap[y][x] = 0; // 0 = sand/land
                    }
                }
            }
        }
    }

    createBridgeNetwork(terrainMap, islands, bridgeChance) {
        if (islands.length < 2) return;

        // Use minimum spanning tree to connect all islands
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
                    const island1 = islands[connectedId];
                    const island2 = islands[unconnectedId];
                    const distance = Math.sqrt((island1.x - island2.x) ** 2 + (island1.y - island2.y) ** 2);

                    if (distance < shortestDistance) {
                        shortestDistance = distance;
                        bestConnection = { connected: connectedId, unconnected: unconnectedId };
                    }
                }
            }

            if (bestConnection) {
                // Always create bridges to ensure all islands are connected
                const island1 = islands[bestConnection.connected];
                const island2 = islands[bestConnection.unconnected];
                this.createBridge(terrainMap, island1, island2);
                console.log(`🌉 Bridge: Island ${bestConnection.connected} → Island ${bestConnection.unconnected}`);
            }

            connected.add(bestConnection.unconnected);
            unconnected.delete(bestConnection.unconnected);
        }
    }

    createBridge(terrainMap, island1, island2) {
        // Create simple straight bridge for now
        const dx = island2.x - island1.x;
        const dy = island2.y - island1.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = Math.floor(island1.x + dx * t);
            const y = Math.floor(island1.y + dy * t);

            if (x >= 0 && x < terrainMap[0].length && y >= 0 && y < terrainMap.length) {
                terrainMap[y][x] = 0; // Bridge = land
                
                // Make bridge wider (3 tiles)
                for (let offset of [-1, 0, 1]) {
                    const bridgeX = x + offset;
                    const bridgeY = y;
                    if (bridgeX >= 0 && bridgeX < terrainMap[0].length && 
                        bridgeY >= 0 && bridgeY < terrainMap.length) {
                        terrainMap[bridgeY][bridgeX] = 0;
                    }
                }
            }
        }
    }

    // Create a beach-style world with sand, water, and scattered decorations
    createBeachWorld(options = {}) {
        const tilesWide = this.width;
        const tilesHigh = this.height;

        // Reset layers
        this.groundLayer = this.createEmptyLayer();
        this.decorationLayer = this.createEmptyLayer();
        this.collisionLayer = this.createEmptyLayer();
        this.meta = { type: 'outdoor', name: 'Beach' };

        const config = {
            seed: options.seed ?? 1337,
            waterBorder: options.waterBorder ?? 4,
            coastJitter: options.coastJitter ?? 2,
            tidePoolCount: options.tidePoolCount ?? Math.max(4, Math.floor((tilesWide * tilesHigh) / 1500)),
            tidePoolRadius: options.tidePoolRadius ?? [1, 3],
            sandbarCount: options.sandbarCount ?? Math.max(3, Math.floor((tilesWide * tilesHigh) / 2000)),
            sandbarRadius: options.sandbarRadius ?? [1, 2],
            decorNearWaterChance: options.decorNearWaterChance ?? 0.18,
            decorInlandChance: options.decorInlandChance ?? 0.07
        };

        const rng = this.createRng(config.seed);

        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;

        // Helper to create a smooth-ish edge using a random walk
        const buildEdge = (length, base, jitter) => {
            const edge = [];
            let current = base;
            for (let i = 0; i < length; i++) {
                current += randInt(-1, 1);
                current = clamp(current, base - jitter, base + jitter);
                edge.push(current);
            }
            return edge;
        };

        const topEdge = buildEdge(tilesWide, config.waterBorder, config.coastJitter);
        const bottomEdge = buildEdge(tilesWide, config.waterBorder, config.coastJitter);
        const leftEdge = buildEdge(tilesHigh, config.waterBorder, config.coastJitter);
        const rightEdge = buildEdge(tilesHigh, config.waterBorder, config.coastJitter);

        // Step 1: Create terrain map (0 = sand, 1 = water)
        const terrainMap = [];
        for (let row = 0; row < tilesHigh; row++) {
            terrainMap[row] = [];
            for (let col = 0; col < tilesWide; col++) {
                const isWater =
                    row < topEdge[col] ||
                    row >= tilesHigh - bottomEdge[col] ||
                    col < leftEdge[row] ||
                    col >= tilesWide - rightEdge[row];

                terrainMap[row][col] = isWater ? 1 : 0;
            }
        }

        const setCircle = (centerCol, centerRow, radius, value) => {
            for (let row = centerRow - radius; row <= centerRow + radius; row++) {
                if (row < 0 || row >= tilesHigh) continue;
                for (let col = centerCol - radius; col <= centerCol + radius; col++) {
                    if (col < 0 || col >= tilesWide) continue;
                    const dx = col - centerCol;
                    const dy = row - centerRow;
                    if ((dx * dx) + (dy * dy) <= radius * radius) {
                        terrainMap[row][col] = value;
                    }
                }
            }
        };

        // Step 2: Add tide pools near the coast
        for (let i = 0; i < config.tidePoolCount; i++) {
            const radius = randInt(config.tidePoolRadius[0], config.tidePoolRadius[1]);
            const col = randInt(config.waterBorder + 2, tilesWide - config.waterBorder - 3);
            const row = randInt(config.waterBorder + 2, tilesHigh - config.waterBorder - 3);
            if (terrainMap[row][col] === 0) {
                setCircle(col, row, radius, 1);
            }
        }

        // Step 3: Add small sandbars near edges (break up water)
        for (let i = 0; i < config.sandbarCount; i++) {
            const radius = randInt(config.sandbarRadius[0], config.sandbarRadius[1]);
            const col = randInt(1, tilesWide - 2);
            const row = randInt(1, tilesHigh - 2);
            if (terrainMap[row][col] === 1) {
                setCircle(col, row, radius, 0);
            }
        }

        this.terrainMap = terrainMap;

        // Step 4: Use AutoTiler to generate proper tile indices
        const autoTiler = new AutoTiler();
        const tiledLayer = autoTiler.autoTileLayer(terrainMap, tilesWide, tilesHigh);

        // Step 5: Apply autotiled result to ground layer
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                this.setTile(this.groundLayer, col, row, tiledLayer[row][col]);
            }
        }

        // Step 6: Collision layer - water is solid
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                if (terrainMap[row][col] === 1) {
                    this.setTile(this.collisionLayer, col, row, 1); // Solid water
                }
            }
        }

        // Step 7: Scatter decorative tiles on sand
        this.scatterBeachDecorations(terrainMap, rng, config);

        console.log('✅ Beach world generated with decorations');
    }

    // Scatter shells/rocks/etc on sand tiles
    scatterBeachDecorations(terrainMap, rng, config) {
        const tilesWide = this.width;
        const tilesHigh = this.height;

        const nearWaterDecorTiles = [1, 2, 3, 4, 8, 10];
        const inlandDecorTiles = [4, 5, 6, 7, 9, 11];

        const hasWaterNeighbor = (col, row) => {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const r = row + dy;
                    const c = col + dx;
                    if (r < 0 || r >= tilesHigh || c < 0 || c >= tilesWide) continue;
                    if (terrainMap[r][c] === 1) return true;
                }
            }
            return false;
        };

        const hasDecorNeighbor = (col, row) => {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const r = row + dy;
                    const c = col + dx;
                    if (r < 0 || r >= tilesHigh || c < 0 || c >= tilesWide) continue;
                    if (this.decorationLayer[r][c]) return true;
                }
            }
            return false;
        };

        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                if (terrainMap[row][col] !== 0) continue; // Only sand
                if (hasDecorNeighbor(col, row)) continue;

                const nearWater = hasWaterNeighbor(col, row);
                const chance = nearWater ? config.decorNearWaterChance : config.decorInlandChance;

                if (rng() < chance) {
                    const pool = nearWater ? nearWaterDecorTiles : inlandDecorTiles;
                    const tileId = pool[Math.floor(rng() * pool.length)];
                    this.setTile(this.decorationLayer, col, row, { tileset: 'decor', id: tileId });
                }
            }
        }
    }

    // Clear decoration tiles in a rectangular area (for buildings/paths)
    clearDecorationRect(startCol, startRow, width, height) {
        for (let row = startRow; row < startRow + height; row++) {
            for (let col = startCol; col < startCol + width; col++) {
                if (this.isValidPosition(col, row)) {
                    this.decorationLayer[row][col] = null;
                }
            }
        }
    }

    // Create a simple interior room
    createInteriorRoom(options = {}) {
        const tilesWide = options.width ?? 12;
        const tilesHigh = options.height ?? 8;
        const doorCol = options.doorCol ?? Math.floor(tilesWide / 2);
        const doorRow = options.doorRow ?? (tilesHigh - 1);

        this.width = tilesWide;
        this.height = tilesHigh;

        this.groundLayer = this.createEmptyLayer();
        this.decorationLayer = this.createEmptyLayer();
        this.collisionLayer = this.createEmptyLayer();

        const floorTile = { tileset: 'interior', id: 0 };
        const wallTile = { tileset: 'interior', id: 1 };
        const doorTile = { tileset: 'interior', id: 2 };

        // Fill floor
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                this.setTile(this.groundLayer, col, row, floorTile);
            }
        }

        // Walls
        for (let row = 0; row < tilesHigh; row++) {
            for (let col = 0; col < tilesWide; col++) {
                const isEdge = row === 0 || row === tilesHigh - 1 || col === 0 || col === tilesWide - 1;
                if (isEdge) {
                    this.setTile(this.groundLayer, col, row, wallTile);
                    this.setTile(this.collisionLayer, col, row, 1);
                }
            }
        }

        // Door on bottom wall (bigger visual now)
        this.setTile(this.groundLayer, doorCol, doorRow, doorTile);
        this.setTile(this.collisionLayer, doorCol, doorRow, 0);

        // No doormat - just clean floor leading to exit

        this.meta = {
            type: 'interior',
            exitTile: { col: doorCol, row: doorRow },
            name: options.name || 'Interior'
        };

        // Note: Decoration placements are now handled by Game.createInteriorFurniture()
        // which renders them as sprite objects instead of tiles.
        // This avoids duplicate rendering and allows for proper sprite-based furniture.

        console.log(`✅ Interior created: ${this.meta.name} (${tilesWide}x${tilesHigh})`);
    }

    // Simple deterministic RNG (LCG)
    createRng(seed) {
        let state = seed >>> 0;
        return () => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 4294967296;
        };
    }

    // Load from JSON data
    loadFromData(data) {
        this.width = data.width;
        this.height = data.height;
        this.tileSize = data.tileSize || CONSTANTS.TILE_SIZE;

        if (data.layers) {
            if (data.layers.ground) {
                this.groundLayer = data.layers.ground.tiles;
            }
            if (data.layers.decoration) {
                this.decorationLayer = data.layers.decoration.tiles;
            }
            if (data.layers.collision) {
                this.collisionLayer = data.layers.collision.tiles;
            }
        }
    }

    // Export to JSON data
    exportToData() {
        return {
            width: this.width,
            height: this.height,
            tileSize: this.tileSize,
            layers: {
                ground: { tiles: this.groundLayer },
                decoration: { tiles: this.decorationLayer },
                collision: { tiles: this.collisionLayer }
            }
        };
    }
}
