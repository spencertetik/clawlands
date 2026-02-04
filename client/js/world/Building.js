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
        
        // Building properties
        this.name = this.getDefaultName();
        
        // Door dimensions
        this.doorWidth = 16;
        this.doorHeight = 20;
        
        // Door position offset from building left edge (custom per building type)
        this.doorOffsetX = this.getDoorOffsetX();
    }
    
    // Get door X offset from building left edge (based on sprite analysis)
    getDoorOffsetX() {
        // These values place the 16px door centered on each building
        // Formula: (buildingWidth - doorWidth) / 2
        // Inn: 96px → (96-16)/2 = 40
        // Shop: 72px → (72-16)/2 = 28
        // House: 48px → (48-16)/2 = 16
        // Lighthouse: 48px → (48-16)/2 = 16
        const offsets = {
            'inn': 40,        // Centered in 96px width
            'shop': 28,       // Centered in 72px width
            'house': 16,      // Centered in 48px width
            'lighthouse': 16, // Centered in 48px width
            'dock': 16,
            'temple': 24,
            'market': 40
        };
        return offsets[this.type] || (this.width - this.doorWidth) / 2;
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
        const doorY = this.y + this.height - this.doorHeight;
        return {
            x: doorX,
            y: doorY,
            width: this.doorWidth,
            height: this.doorHeight
        };
    }

    // Get the trigger zone (area in front of building that triggers entry)
    // Balanced zone - close to door but forgiving enough to hit
    getTriggerZone() {
        const door = this.getDoorBounds();
        return {
            x: door.x - 8,  // 8px wider on each side
            y: this.y + this.height - 6, // Starts 6px above building bottom (into doorway)
            width: this.doorWidth + 16, // 32px total width
            height: 24 // 6px into building + 18px below
        };
    }
    
    // Get doormat bounds (for rendering the welcome mat)
    // Positioned directly below the door, outside the building
    getDoormatBounds() {
        const door = this.getDoorBounds();
        return {
            x: door.x - 2,
            y: this.y + this.height, // Start at building bottom (outside)
            width: this.doorWidth + 4,
            height: 8
        };
    }

    // Check if a point is inside the building (for collision)
    checkCollision(worldX, worldY) {
        // Extended collision zone - includes building plus area above it
        // This prevents players from walking "on top" of buildings
        const collisionTop = this.y - 8; // Extend collision 8px above building
        
        // First check if point is within extended building bounds
        if (worldX < this.x || worldX >= this.x + this.width ||
            worldY < collisionTop || worldY >= this.y + this.height) {
            return false; // Outside building, no collision
        }

        // Check if point is within the door (no collision there)
        // Door only applies at the actual building level, not above
        const door = this.getDoorBounds();
        if (worldY >= this.y && // Only check door at building level
            worldX >= door.x && worldX < door.x + door.width &&
            worldY >= door.y && worldY < door.y + door.height) {
            return false; // In doorway, no collision
        }

        // Inside building (or above it) but not in door = collision
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
            // Draw the sprite at its native size
            renderer.drawSprite(
                this.spriteImage,
                0, 0,
                this.spriteImage.width,
                this.spriteImage.height,
                this.x,
                this.y,
                this.width,
                this.height,
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
        // Extended collision zone (magenta, semi-transparent fill)
        const collisionTop = this.y - 8;
        const cx = (this.x - camera.x) * scale;
        const cy = (collisionTop - camera.y) * scale;
        const collisionHeight = this.height + 8;
        ctx.fillStyle = 'rgba(255, 0, 255, 0.2)';
        ctx.fillRect(cx, cy, this.width * scale, collisionHeight * scale);
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, this.width * scale, collisionHeight * scale);

        // Building sprite bounds (red outline)
        const bx = (this.x - camera.x) * scale;
        const by = (this.y - camera.y) * scale;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, this.width * scale, this.height * scale);

        // Door area (green fill)
        const door = this.getDoorBounds();
        const dx = (door.x - camera.x) * scale;
        const dy = (door.y - camera.y) * scale;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
        ctx.fillRect(dx, dy, door.width * scale, door.height * scale);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.strokeRect(dx, dy, door.width * scale, door.height * scale);

        // Doormat area (cyan)
        const mat = this.getDoormatBounds();
        const mx = (mat.x - camera.x) * scale;
        const my = (mat.y - camera.y) * scale;
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.fillRect(mx, my, mat.width * scale, mat.height * scale);

        // Trigger zone (yellow outline)
        const trigger = this.getTriggerZone();
        const tx = (trigger.x - camera.x) * scale;
        const ty = (trigger.y - camera.y) * scale;
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(tx, ty, trigger.width * scale, trigger.height * scale);
        ctx.setLineDash([]);

        // Building name label
        ctx.fillStyle = '#ff0';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.font = `bold ${6 * scale}px monospace`;
        ctx.strokeText(this.name, bx, by - 4 * scale);
        ctx.fillText(this.name, bx, by - 4 * scale);
        
        // Legend for this building
        ctx.font = `${4 * scale}px monospace`;
        ctx.fillStyle = '#f0f';
        ctx.fillText('COLLISION', cx + 2, cy + 4 * scale);
    }
}
