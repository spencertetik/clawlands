// Base entity class for all game entities
class Entity {
    constructor(x, y, width, height) {
        this.position = new Vector2(x, y);
        this.width = width;
        this.height = height;
        this.direction = CONSTANTS.DIRECTION.DOWN;
        this.velocity = new Vector2(0, 0);
    }

    // Update entity
    update(deltaTime) {
        // Base update logic - override in subclasses
    }

    // Render entity
    render(renderer) {
        // Base render logic - override in subclasses
    }

    // Get bounding box for collision
    getBounds() {
        return {
            x: this.position.x,
            y: this.position.y,
            width: this.width,
            height: this.height
        };
    }

    // Check collision with another entity
    collidesWith(other) {
        const bounds1 = this.getBounds();
        const bounds2 = other.getBounds();

        return !(
            bounds1.x + bounds1.width < bounds2.x ||
            bounds1.x > bounds2.x + bounds2.width ||
            bounds1.y + bounds1.height < bounds2.y ||
            bounds1.y > bounds2.y + bounds2.height
        );
    }

    // Get center position
    getCenter() {
        return new Vector2(
            this.position.x + this.width / 2,
            this.position.y + this.height / 2
        );
    }
}
