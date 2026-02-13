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
    // excludeEntity: optional entity to exclude from NPC collision checks (for self-collision avoidance)
    checkCollision(x, y, width, height, excludeEntity = null) {
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
        
        // Check collision with NPCs (skip excludeEntity for self-collision avoidance)
        for (const npc of this.npcs) {
            if (npc === excludeEntity) continue; // Skip self
            
            // If player is checking collision, skip any NPC they're already overlapping with.
            // This prevents getting permanently stuck when an NPC walks into the player
            // or when the player spawns on top of an NPC. Once free, normal collision resumes.
            if (this.player && !excludeEntity) {
                const playerBox = this.player.getCollisionBox ? this.player.getCollisionBox() : {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    width: this.player.width,
                    height: this.player.height
                };
                const npcBox = npc.getCollisionBox ? npc.getCollisionBox() : {
                    x: npc.position.x,
                    y: npc.position.y,
                    width: npc.width,
                    height: npc.height
                };
                
                const currentlyOverlapping = !(
                    playerBox.x + playerBox.width <= npcBox.x ||
                    playerBox.x >= npcBox.x + npcBox.width ||
                    playerBox.y + playerBox.height <= npcBox.y ||
                    playerBox.y >= npcBox.y + npcBox.height
                );
                
                if (currentlyOverlapping) {
                    continue; // Already overlapping — ignore this NPC entirely until free
                }
            }
            
            if (npc.checkCollision(x, y, width, height)) {
                return true; // Collision with NPC
            }
        }
        
        // Check collision with remote players (very forgiving - players can push through)
        // Use targetPosition (server truth) not interpolated position to avoid jitter
        if (this.remotePlayers && this.player) {
            for (const [id, remote] of this.remotePlayers) {
                // Use target position (stable server value) instead of interpolated position
                // This prevents jitter when the remote player is moving
                const remotePos = remote.targetPosition || remote.position;
                
                // Use very small collision box (6x6) centered on remote player
                const remoteWidth = 6;
                const remoteHeight = 6;
                const remoteCenterX = remotePos.x + 8;
                const remoteCenterY = remotePos.y + 12;
                const remoteX = remoteCenterX - remoteWidth / 2;
                const remoteY = remoteCenterY - remoteHeight / 2;
                
                // Check if already overlapping (don't block - let them escape)
                const playerBox = this.player.getCollisionBox ? this.player.getCollisionBox() : {
                    x: this.player.position.x,
                    y: this.player.position.y,
                    width: this.player.width,
                    height: this.player.height
                };
                const currentlyOverlapping = !(
                    playerBox.x + playerBox.width <= remotePos.x ||
                    playerBox.x >= remotePos.x + 16 ||
                    playerBox.y + playerBox.height <= remotePos.y ||
                    playerBox.y >= remotePos.y + 24
                );
                
                if (currentlyOverlapping) {
                    continue; // Already overlapping, let them move to escape
                }
                
                // Skip collision entirely if remote is currently moving (prevents jitter)
                if (remote.isMoving) {
                    continue;
                }
                
                // Check AABB collision with small hitbox
                if (!(x + width < remoteX ||
                      x > remoteX + remoteWidth ||
                      y + height < remoteY ||
                      y > remoteY + remoteHeight)) {
                    return true; // Would collide with remote player
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
