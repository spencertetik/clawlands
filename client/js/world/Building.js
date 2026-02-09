// Building entity - collision matches actual sprite dimensions
class Building {
    constructor(x, y, type, spriteImage = null) {
        this.x = x; // World position in pixels (top-left of building)
        this.y = y;
        this.type = type; // 'inn', 'shop', 'house', 'lighthouse', etc.
        this.spriteImage = spriteImage;
        
        // Dimensions come from sprite or defaults
        this.width = spriteImage ? spriteImage.width : this.getDefaultWidth();
        this.height = spriteImage ? spriteImage.height : this.getDefaultHeight();
        
        // Visual overflow: extra pixels the sprite extends ABOVE the collision box (for roofs/peaks)
        this.spriteOverflowY = this.getSpriteOverflowY();
        
        // Building properties
        this.name = this.getDefaultName();
        
        // Door dimensions (per building type based on sprite analysis)
        this.doorWidth = this.getDoorWidth();
        this.doorHeight = 20;
        
        // Door position offset from building left edge (custom per building type)
        this.doorOffsetX = this.getDoorOffsetX();
        
        // Door Y offset from building bottom (most doors are at ground level)
        this.doorOffsetY = this.getDoorOffsetY();
    }
    
    // Get door width based on sprite analysis
    getDoorWidth() {
        const widths = {
            'inn': 16,        // Wide entrance
            'shop': 12,       // Medium entrance  
            'house': 10,      // Narrow door
            'lighthouse': 10, // Narrow door
            'dock': 16,
            'temple': 14,
            'market': 16
        };
        return widths[this.type] || 12;
    }
    
    // Sprite overflow above collision box (for peaked roofs that extend above the footprint)
    getSpriteOverflowY() {
        const overflow = {
            'inn': 12,
            'shop': 16,
            'house': 10,
            'lighthouse': 8,
        };
        return overflow[this.type] || 0;
    }
    
    // Get door X offset from building left edge (based on sprite analysis)
    getDoorOffsetX() {
        // Values measured from actual sprite pixels
        const offsets = {
            'inn': 40,        // Centered in 96px width
            'shop': 42,       // Door is right of center in 72px width
            'house': 19,      // Centered, measured ~20px from left
            'lighthouse': 19, // Centered, measured ~19-20px from left
            'dock': 16,
            'temple': 24,
            'market': 40
        };
        return offsets[this.type] || Math.floor((this.width - this.doorWidth) / 2);
    }
    
    // Get door Y offset from bottom of building (0 = at ground, positive = higher up)
    getDoorOffsetY() {
        const offsets = {
            'inn': 0,         // Door at ground level
            'shop': 0,        // Door at ground level
            'house': 1,       // Door at ground level
            'lighthouse': 5,  // Door is 4-6px up from bottom (on foundation)
            'dock': 0,
            'temple': 0,
            'market': 0
        };
        return offsets[this.type] || 0;
    }

    // Get default pixel dimensions based on type (used when no sprite)
    getDefaultWidth() {
        const widths = {
            'inn': 96,
            'shop': 72,
            'house': 48,
            'lighthouse': 48,
            'dock': 48,
            'temple': 64,
            'market': 96
        };
        return widths[this.type] || 48;
    }

    getDefaultHeight() {
        const heights = {
            'inn': 72,
            'shop': 48,
            'house': 48,
            'lighthouse': 96,
            'dock': 32,
            'temple': 80,
            'market': 64
        };
        return heights[this.type] || 48;
    }

    // Get default name based on type
    getDefaultName() {
        const names = {
            'inn': 'Lobster Inn',
            'shop': 'Lobster Mart',
            'house': 'House',
            'lighthouse': 'Lighthouse',
            'dock': 'Wooden Dock',
            'temple': 'Crustacean Temple',
            'market': 'Seaside Market'
        };
        return names[this.type] || 'Building';
    }

    // Get the door bounds in world coordinates
    getDoorBounds() {
        const doorX = this.x + this.doorOffsetX;
        // Door Y position: building bottom minus door height, plus any Y offset
        const doorY = this.y + this.height - this.doorHeight - this.doorOffsetY;
        return {
            x: doorX,
            y: doorY,
            width: this.doorWidth,
            height: this.doorHeight
        };
    }

    // Get the trigger zone (area in front of door that triggers entry)
    // Positioned to match the actual door location - tighter zone
    getTriggerZone() {
        const door = this.getDoorBounds();
        const doorBottom = this.y + this.height - this.doorOffsetY;
        return {
            x: door.x,  // Exact door width, no extra margin
            y: doorBottom - 2, // Starts 2px into doorway
            width: this.doorWidth, // Exact door width
            height: 10 // 2px into building + 8px below - must be close to enter
        };
    }
    
    // Get doormat bounds (for rendering the welcome mat)
    // Mat rendered on GROUND layer (0), building on BUILDING_BASE layer (2)
    // Mat needs to be positioned at the door - which varies by building type
    getDoormatBounds() {
        const door = this.getDoorBounds();
        
        // Door visual position varies by building type
        // These offsets position the mat at the visible door in each sprite
        const matOffsets = {
            'inn': 24,        // Inn door is ~24px from sprite bottom
            'shop': 16,       // Shop door is ~16px from sprite bottom
            'house': 12,      // House door is ~12px from sprite bottom
            'lighthouse': 20, // Lighthouse door is ~20px from sprite bottom
            'dock': 8,
            'temple': 16,
            'market': 20
        };
        const offset = matOffsets[this.type] || 16;
        
        return {
            x: door.x - 2,
            y: this.y + this.height - offset - 8, // Position mat at door level
            width: this.doorWidth + 4,
            height: 8
        };
    }

    // Check if a point is inside the building (for collision)
    checkCollision(worldX, worldY) {
        // Check if point is within building bounds
        if (worldX < this.x || worldX >= this.x + this.width ||
            worldY < this.y || worldY >= this.y + this.height) {
            return false; // Outside building, no collision
        }

        // Check if point is within the door (no collision there)
        const door = this.getDoorBounds();
        if (worldX >= door.x && worldX < door.x + door.width &&
            worldY >= door.y && worldY < door.y + door.height) {
            return false; // In doorway, no collision
        }

        // Inside building but not in door = collision
        return true;
    }

    // Check if player is in the trigger zone (should enter building)
    isInTriggerZone(playerX, playerY, playerWidth, playerHeight) {
        const trigger = this.getTriggerZone();
        
        // Check if player's feet area overlaps with trigger zone
        const playerCenterX = playerX + playerWidth / 2;
        const playerFeetY = playerY + playerHeight - 4; // Bottom 4px of sprite
        
        // More forgiving check - player center X within trigger, feet Y overlaps
        const inXRange = playerCenterX >= trigger.x && playerCenterX < trigger.x + trigger.width;
        const inYRange = playerFeetY >= trigger.y && playerFeetY < trigger.y + trigger.height;
        
        return inXRange && inYRange;
    }

    // Set sprite image and update dimensions
    setSprite(image) {
        this.spriteImage = image;
        if (image) {
            this.width = image.width;
            this.height = image.height;
            // Recalculate door offset for new dimensions
            this.doorOffsetX = this.getDoorOffsetX();
        }
    }

    // Render building
    render(renderer) {
        // Render building shadow first (behind everything)
        this.renderBuildingShadow(renderer);
        
        // Render doormat (behind building)
        this.renderDoormat(renderer);
        
        if (this.spriteImage) {
            // Draw sprite with overflow — extends above collision box for roofs
            // The collision box starts at (this.x, this.y), but the sprite renders higher
            const renderY = this.y - this.spriteOverflowY;
            const renderH = this.height + this.spriteOverflowY;
            renderer.drawSprite(
                this.spriteImage,
                0, 0,
                this.spriteImage.width,
                this.spriteImage.height,
                this.x,
                renderY,
                this.width,
                renderH,
                CONSTANTS.LAYER.BUILDING_BASE
            );
        } else {
            // Placeholder rendering
            this.renderPlaceholder(renderer);
        }
    }
    
    // Render shadow beneath building for visual grounding
    renderBuildingShadow(renderer) {
        // Continuous shadow strip using warm brown tones
        const shadowWidth = this.width;
        const shadowHeight = 8;
        
        // Main shadow (warm brown, continuous)
        renderer.drawRect(
            this.x,
            this.y + this.height,
            shadowWidth,
            shadowHeight,
            'rgba(92, 64, 51, 0.15)', // Warm brown #5C4033
            CONSTANTS.LAYER.GROUND
        );
        
        // Contact shadow (closer to building base)
        renderer.drawRect(
            this.x + 2,
            this.y + this.height,
            shadowWidth - 4,
            3,
            'rgba(92, 64, 51, 0.1)',
            CONSTANTS.LAYER.GROUND
        );
    }

    // Render doormat/doorstep in front of door
    renderDoormat(renderer) {
        const mat = this.getDoormatBounds();
        
        // Shadow beneath doorstep
        renderer.drawRect(
            mat.x + 1,
            mat.y + mat.height - 1,
            mat.width - 2,
            2,
            'rgba(0, 0, 0, 0.2)',
            CONSTANTS.LAYER.GROUND
        );
        
        // Doorstep base (stone/wood)
        renderer.drawRect(
            mat.x,
            mat.y,
            mat.width,
            mat.height,
            '#6b5344',
            CONSTANTS.LAYER.GROUND
        );
        
        // Top highlight
        renderer.drawRect(
            mat.x + 1,
            mat.y,
            mat.width - 2,
            2,
            '#8b7355',
            CONSTANTS.LAYER.GROUND
        );
        
        // Bottom shadow edge
        renderer.drawRect(
            mat.x + 1,
            mat.y + mat.height - 2,
            mat.width - 2,
            1,
            '#4a3728',
            CONSTANTS.LAYER.GROUND
        );
        
        // Center mat texture
        renderer.drawRect(
            mat.x + 2,
            mat.y + 2,
            mat.width - 4,
            mat.height - 4,
            '#7a6448',
            CONSTANTS.LAYER.GROUND
        );
    }

    // Render placeholder when no sprite
    renderPlaceholder(renderer) {
        const colors = {
            'inn': '#ff4040',
            'shop': '#4080ff',
            'house': '#ffa040',
            'lighthouse': '#ffff40',
            'dock': '#8b4513',
            'temple': '#daa520',
            'market': '#cd853f'
        };

        const color = colors[this.type] || '#808080';

        // Draw building body
        renderer.drawRect(
            this.x,
            this.y,
            this.width,
            this.height,
            color,
            CONSTANTS.LAYER.BUILDING_BASE
        );

        // Draw door (darker)
        const door = this.getDoorBounds();
        renderer.drawRect(
            door.x,
            door.y,
            door.width,
            door.height,
            '#402020',
            CONSTANTS.LAYER.BUILDING_BASE
        );
    }

    // Render debug info (collision box, door, trigger zone)
    renderDebug(ctx, camera, scale) {
        // Building collision bounds (red fill + outline)
        const bx = (this.x - camera.x) * scale;
        const by = (this.y - camera.y) * scale;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        ctx.fillRect(bx, by, this.width * scale, this.height * scale);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, this.width * scale, this.height * scale);

        // Door area (green fill) - where you can walk through
        const door = this.getDoorBounds();
        const dx = (door.x - camera.x) * scale;
        const dy = (door.y - camera.y) * scale;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.fillRect(dx, dy, door.width * scale, door.height * scale);
        ctx.strokeStyle = 'rgba(0, 255, 0, 1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, door.width * scale, door.height * scale);

        // Doormat area (cyan) - visual mat position
        const mat = this.getDoormatBounds();
        const mx = (mat.x - camera.x) * scale;
        const my = (mat.y - camera.y) * scale;
        ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.fillRect(mx, my, mat.width * scale, mat.height * scale);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.strokeRect(mx, my, mat.width * scale, mat.height * scale);

        // Trigger zone (yellow dashed) - enter building area
        const trigger = this.getTriggerZone();
        const tx = (trigger.x - camera.x) * scale;
        const ty = (trigger.y - camera.y) * scale;
        ctx.strokeStyle = 'rgba(255, 255, 0, 1)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(tx, ty, trigger.width * scale, trigger.height * scale);
        ctx.setLineDash([]);

        // Building name label
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.font = `bold ${5 * scale}px monospace`;
        ctx.strokeText(this.name, bx, by - 2 * scale);
        ctx.fillText(this.name, bx, by - 2 * scale);
    }
}
