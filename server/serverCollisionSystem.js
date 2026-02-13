/**
 * Server-side collision system that exactly matches the client
 * 
 * This system replicates the client's CollisionSystem.js logic for bots:
 * - Tile-based collision using collision layer
 * - Building collision with door zones
 * - Decoration collision with proper offsets
 * - NPC collision boxes
 */

// Import client modules (now with Node.js exports)
const DecorationLoader = require('../client/js/core/DecorationLoader.js');
const Building = require('../client/js/world/Building.js');
const CONSTANTS = require('../client/js/shared/Constants.js');

class ServerCollisionSystem {
    constructor(worldData) {
        this.worldMap = worldData.worldMap || null;
        this.collisionMap = worldData.collisionMap || worldData.terrainMap;
        this.worldWidth = worldData.width || 200;
        this.worldHeight = worldData.height || 200;
        this.buildings = [];
        this.decorations = [];
        this.npcs = [];
        
        // Initialize decoration loader for collision definitions
        this.decorationLoader = new DecorationLoader();
    }

    // Set buildings array (Building instances with collision methods)
    setBuildings(buildings) {
        this.buildings = buildings;
    }

    // Set decorations array with collision data
    setDecorations(decorations) {
        this.decorations = decorations;
    }

    // Set NPCs array
    setNPCs(npcs) {
        this.npcs = npcs;
    }

    // Check if a tile at position is solid (matches client CollisionSystem.isTileSolid)
    isTileSolid(tileX, tileY) {
        if (!this.collisionMap) {
            return false;
        }

        // Check bounds
        if (tileX < 0 || tileY < 0 ||
            tileX >= this.worldWidth ||
            tileY >= this.worldHeight) {
            return true; // Treat out of bounds as solid
        }

        // Check collision layer - 0 or null = passable, anything else = solid
        const tileId = this.collisionMap[tileY] && this.collisionMap[tileY][tileX];
        return tileId !== null && tileId !== 0;
    }

    // Main collision check - matches client CollisionSystem.checkCollision
    checkCollision(
        x,
        y,
        width = CONSTANTS.CHARACTER_COLLISION_WIDTH || CONSTANTS.CHARACTER_WIDTH,
        height = CONSTANTS.CHARACTER_COLLISION_HEIGHT || CONSTANTS.CHARACTER_HEIGHT,
        excludeEntity = null
    ) {
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

        // Check collision with buildings (pixel-based with door zones)
        for (const building of this.buildings) {
            if (this.checkBuildingCollision(building, x, y, width, height)) {
                return true;
            }
        }

        // Check collision with decorations
        if (this.checkDecorationCollision(x, y, width, height)) {
            return true;
        }

        // Check collision with NPCs (exclude self for NPC movement)
        for (const npc of this.npcs) {
            if (npc === excludeEntity) continue;
            
            if (this.checkNPCCollision(npc, x, y, width, height)) {
                return true;
            }
        }

        return false; // No collision
    }

    // Check collision with a building (matches client Building.checkCollision logic)
    checkBuildingCollision(building, x, y, width, height) {
        // Check multiple points along the entity's bounds (matches client logic)
        const checkPoints = [
            { x: x + 2, y: y + height - 4 },           // Bottom-left (feet)
            { x: x + width - 2, y: y + height - 4 },   // Bottom-right (feet)
            { x: x + width / 2, y: y + height - 2 },   // Bottom-center (feet)
        ];

        for (const point of checkPoints) {
            if (building.checkCollision && typeof building.checkCollision === 'function') {
                if (building.checkCollision(point.x, point.y)) {
                    return true;
                }
            } else {
                // Fallback: simple AABB check with door zone
                if (this.simpleBuildingCollision(building, point.x, point.y)) {
                    return true;
                }
            }
        }

        return false;
    }

    // Fallback building collision when Building class methods not available
    simpleBuildingCollision(building, pointX, pointY) {
        // Check if point is within building bounds
        if (pointX < building.x || pointX >= building.x + building.width ||
            pointY < building.y || pointY >= building.y + building.height) {
            return false; // Outside building
        }

        // Calculate door zone (matches client Building.getDoorBounds logic)
        const doorWidth = this.getBuildingDoorWidth(building.type);
        const doorHeight = 20;
        const doorOffsetX = this.getBuildingDoorOffsetX(building.type, building.width, doorWidth);
        const doorOffsetY = this.getBuildingDoorOffsetY(building.type);
        
        const doorX = building.x + doorOffsetX;
        const doorY = building.y + building.height - doorHeight - doorOffsetY;

        // Check if point is within the door (no collision there)
        if (pointX >= doorX && pointX < doorX + doorWidth &&
            pointY >= doorY && pointY < doorY + doorHeight) {
            return false; // In doorway, no collision
        }

        return true; // Inside building but not in door = collision
    }

    // Get building door width by type (matches client Building.getDoorWidth)
    getBuildingDoorWidth(type) {
        const widths = {
            'inn': 16,
            'shop': 12,
            'house': 10,
            'lighthouse': 10,
            'dock': 16,
            'temple': 14,
            'market': 16
        };
        return widths[type] || 12;
    }

    // Get building door X offset (matches client Building.getDoorOffsetX)
    getBuildingDoorOffsetX(type, buildingWidth, doorWidth) {
        const offsets = {
            'inn': 40,
            'shop': 42,
            'house': 19,
            'lighthouse': 19,
            'dock': 16,
            'temple': 24,
            'market': 40
        };
        return offsets[type] || Math.floor((buildingWidth - doorWidth) / 2);
    }

    // Get building door Y offset (matches client Building.getDoorOffsetY)
    getBuildingDoorOffsetY(type) {
        const offsets = {
            'inn': 0,
            'shop': 0,
            'house': 1,
            'lighthouse': 5,
            'dock': 0,
            'temple': 0,
            'market': 0
        };
        return offsets[type] || 0;
    }

    // Check collision with decorations
    checkDecorationCollision(x, y, width, height) {
        const tileSize = CONSTANTS.TILE_SIZE;

        for (const decor of this.decorations) {
            // Skip ground decorations (paths, grass, etc.)
            if (decor.ground || decor.layer === CONSTANTS.LAYER.GROUND) {
                continue;
            }

            // Skip path tiles specifically
            if (decor.type === 'dirt_path' || decor.type === 'cobblestone_path') {
                continue;
            }

            // Get collision definition
            let collisionDef = decor.collision || null;
            if (!collisionDef && this.decorationLoader) {
                const def = this.decorationLoader.getDefinition(decor.type);
                collisionDef = def?.collision || null;
            }
            
            // Skip decorations without collision
            if (!collisionDef) continue;

            // Calculate collision box (matches client markDecorationCollisions logic)
            const decoWidth = decor.width || tileSize;
            const decoHeight = decor.height || tileSize;
            const collisionWidth = collisionDef.width || decoWidth;
            const collisionHeight = collisionDef.height || decoHeight;
            
            if (collisionWidth <= 0 || collisionHeight <= 0) continue;
            
            const offsetX = collisionDef.offsetX || Math.round((decoWidth - collisionWidth) / 2);
            const offsetY = collisionDef.offsetY || Math.max(0, decoHeight - collisionHeight);
            const baseX = (decor.x || 0) + offsetX;
            const baseY = (decor.y || 0) + offsetY;

            // Check AABB collision
            if (!(x + width < baseX ||
                  x > baseX + collisionWidth ||
                  y + height < baseY ||
                  y > baseY + collisionHeight)) {
                return true; // Collision with decoration
            }
        }

        return false;
    }

    // Check collision with NPC (matches client NPC.checkCollision)
    checkNPCCollision(npc, x, y, width, height) {
        // Get NPC collision box
        const npcBox = this.getNPCCollisionBox(npc);
        
        // AABB collision check
        return !(x + width <= npcBox.x ||
                 x >= npcBox.x + npcBox.width ||
                 y + height <= npcBox.y ||
                 y >= npcBox.y + npcBox.height);
    }

    // Get NPC collision box (matches client NPC.getCollisionBox)
    getNPCCollisionBox(npc) {
        const footprintWidth = CONSTANTS.CHARACTER_COLLISION_WIDTH;
        const footprintHeight = CONSTANTS.CHARACTER_COLLISION_HEIGHT;
        const offsetX = (CONSTANTS.CHARACTER_WIDTH - footprintWidth) / 2;
        const offsetY = CONSTANTS.CHARACTER_HEIGHT - footprintHeight;
        
        return {
            x: npc.x + offsetX,
            y: npc.y + offsetY,
            width: footprintWidth,
            height: footprintHeight
        };
    }

    // Helper: Check if a box position is walkable
    isBoxWalkable(
        x,
        y,
        width = CONSTANTS.CHARACTER_COLLISION_WIDTH || CONSTANTS.CHARACTER_WIDTH,
        height = CONSTANTS.CHARACTER_COLLISION_HEIGHT || CONSTANTS.CHARACTER_HEIGHT
    ) {
        return !this.checkCollision(x, y, width, height);
    }
}

function getCharacterCollisionBox(atX, atY) {
    const footprintWidth = CONSTANTS.CHARACTER_COLLISION_WIDTH || CONSTANTS.CHARACTER_WIDTH;
    const footprintHeight = CONSTANTS.CHARACTER_COLLISION_HEIGHT || CONSTANTS.CHARACTER_HEIGHT;
    const offsetX = (CONSTANTS.CHARACTER_WIDTH - footprintWidth) / 2;
    const offsetY = CONSTANTS.CHARACTER_HEIGHT - footprintHeight;
    return {
        x: atX + offsetX,
        y: atY + offsetY,
        width: footprintWidth,
        height: footprintHeight
    };
}

module.exports = { ServerCollisionSystem, CONSTANTS, getCharacterCollisionBox };
