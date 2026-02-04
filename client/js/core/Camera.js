// Camera system for viewport following
class Camera {
    constructor(viewportWidth, viewportHeight, worldWidth, worldHeight) {
        this.position = new Vector2(0, 0);
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;

        // Target for smooth following
        this.target = null;

        // Lerp speed (0 = instant, 1 = no movement)
        this.lerpSpeed = 0.1;
    }

    // Set the target entity to follow
    setTarget(target) {
        this.target = target;
    }

    // Update camera position
    update(deltaTime) {
        if (!this.target) return;

        // Calculate desired camera position (center target in viewport)
        const desiredX = this.target.position.x - this.viewportWidth / 2;
        const desiredY = this.target.position.y - this.viewportHeight / 2;

        // Smooth lerp to desired position
        this.position.x += (desiredX - this.position.x) * this.lerpSpeed;
        this.position.y += (desiredY - this.position.y) * this.lerpSpeed;

        // Clamp to world bounds
        this.clampToWorld();
    }

    // Keep camera within world boundaries
    clampToWorld() {
        // Only clamp if world is larger than viewport
        if (this.worldWidth > this.viewportWidth) {
            this.position.x = Math.max(0, Math.min(
                this.position.x,
                this.worldWidth - this.viewportWidth
            ));
        } else {
            // Center camera if world is smaller
            this.position.x = (this.worldWidth - this.viewportWidth) / 2;
        }

        if (this.worldHeight > this.viewportHeight) {
            this.position.y = Math.max(0, Math.min(
                this.position.y,
                this.worldHeight - this.viewportHeight
            ));
        } else {
            // Center camera if world is smaller
            this.position.y = (this.worldHeight - this.viewportHeight) / 2;
        }
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        return new Vector2(
            worldX - this.position.x,
            worldY - this.position.y
        );
    }

    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        return new Vector2(
            screenX + this.position.x,
            screenY + this.position.y
        );
    }

    // Check if a rectangle is visible in the viewport
    isVisible(x, y, width, height) {
        return !(
            x + width < this.position.x ||
            x > this.position.x + this.viewportWidth ||
            y + height < this.position.y ||
            y > this.position.y + this.viewportHeight
        );
    }

    // Get visible tile bounds for culling
    getVisibleTileBounds(tileSize) {
        return {
            startCol: Math.floor(this.position.x / tileSize),
            endCol: Math.ceil((this.position.x + this.viewportWidth) / tileSize),
            startRow: Math.floor(this.position.y / tileSize),
            endRow: Math.ceil((this.position.y + this.viewportHeight) / tileSize)
        };
    }
}
