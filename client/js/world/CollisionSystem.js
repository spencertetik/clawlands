// Collision system for tile-based and pixel-based collision
class CollisionSystem {
    constructor(worldMap) {
        this.worldMap = worldMap;
        this.buildings = []; // Buildings to check collision with
        this.npcs = []; // NPCs to check collision with
        this.player = null; // Player reference for NPC collision checking
        this.remotePlayers = null; // Map of remote players for collision
    }
    
    // Set NPCs for collision checking
    setNPCs(npcs) {
        this.npcs = npcs;
    }
    
    // Set player reference
    setPlayer(player) {
        this.player = player;
    }
    
    // Set remote players for collision checking
    setRemotePlayers(remotePlayers) {
        this.remotePlayers = remotePlayers;
    }

    // Check if a tile at position is solid (from world map)
    isTileSolid(tileX, tileY) {
        if (!this.worldMap || !this.worldMap.collisionLayer) {
            return false;
        }

        // Check bounds
        if (tileX < 0 || tileY < 0 ||
            tileX >= this.worldMap.width ||
            tileY >= this.worldMap.height) {
            return true; // Treat out of bounds as solid
        }

        // Check collision layer
        const tileId = this.worldMap.collisionLayer[tileY][tileX];
        return tileId !== null && tileId !== 0; // 0 or null = passable
    }

    // Add a building to collision checks
    addBuilding(building) {
        this.buildings.push(building);
    }

    // Clear all buildings
    clearBuildings() {
        this.buildings = [];
    }

    // Check collision for an entity at position
    checkCollision(x, y, width, height) {
        const tileSize = CONSTANTS.TILE_SIZE;

        // Get tile coordinates for all corners of the entity
        const left = Math.floor(x / tileSize);
        const right = Math.floor((x + width - 1) / tileSize);
        const top = Math.floor(y / tileSize);
        const bottom = Math.floor((y + height - 1) / tileSize);

        // Check all tiles the entity overlaps
        for (let ty = top; ty <= bottom; ty++) {
            for (let tx = left; tx <= right; tx++) {
                if (this.isTileSolid(tx, ty)) {
                    return true; // Collision with world tile
                }
            }
        }

        // Check collision with buildings (pixel-based)
        for (const building of this.buildings) {
            // Check multiple points along the entity's bounds
            const checkPoints = [
                { x: x + 2, y: y + height - 4 },           // Bottom-left (feet)
                { x: x + width - 2, y: y + height - 4 },   // Bottom-right (feet)
                { x: x + width / 2, y: y + height - 2 },   // Bottom-center (feet)
            ];

            for (const point of checkPoints) {
                if (building.checkCollision(point.x, point.y)) {
                    return true; // Collision with building
                }
            }
        }
        
        // Check collision with NPCs
        for (const npc of this.npcs) {
            if (npc.checkCollision(x, y, width, height)) {
                return true; // Collision with NPC
            }
        }
        
        // Check collision with remote players (smaller hitbox for more forgiving collision)
        if (this.remotePlayers) {
            for (const [id, remote] of this.remotePlayers) {
                // Use smaller collision box (8x12) centered on player for more forgiving collision
                const remoteWidth = 8;
                const remoteHeight = 12;
                const remoteX = remote.position.x + 4; // Center the smaller box
                const remoteY = remote.position.y + 6;
                
                // Check AABB collision
                if (!(x + width < remoteX ||
                      x > remoteX + remoteWidth ||
                      y + height < remoteY ||
                      y > remoteY + remoteHeight)) {
                    return true; // Collision with remote player
                }
            }
        }

        return false; // No collision
    }

    // Check collision with a list of entities
    checkEntityCollision(x, y, width, height, entities, ignoreEntity = null) {
        const testBounds = { x, y, width, height };

        for (const entity of entities) {
            if (entity === ignoreEntity) continue;

            const entityBounds = entity.getBounds();

            // Check AABB collision
            if (!(testBounds.x + testBounds.width < entityBounds.x ||
                  testBounds.x > entityBounds.x + entityBounds.width ||
                  testBounds.y + testBounds.height < entityBounds.y ||
                  testBounds.y > entityBounds.y + entityBounds.height)) {
                return true; // Collision with entity
            }
        }

        return false; // No collision
    }
}
