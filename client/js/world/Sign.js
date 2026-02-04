// Sign entity - small interactable sign that shows text when player presses SPACE
class Sign {
    constructor(x, y, text) {
        this.x = x; // World position in pixels
        this.y = y;
        this.width = 12;
        this.height = 16;
        this.text = text; // Text to show when interacted with
    }

    // Get center position
    getCenter() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    // Check if player is close enough to interact
    isPlayerNearby(playerX, playerY, playerWidth, playerHeight) {
        const playerCenterX = playerX + playerWidth / 2;
        const playerCenterY = playerY + playerHeight / 2;
        const signCenter = this.getCenter();
        
        const dx = playerCenterX - signCenter.x;
        const dy = playerCenterY - signCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < CONSTANTS.TILE_SIZE * 1.5; // Within 1.5 tiles
    }

    // Get dialog for this sign
    getDialog() {
        return [this.text];
    }

    // Render sign as pixel art
    render(renderer) {
        // Cast shadow extending to the right/down (warm brown)
        renderer.drawRect(
            this.x + 4,
            this.y + 14,
            8,
            4,
            'rgba(92, 64, 51, 0.2)',
            CONSTANTS.LAYER.GROUND
        );
        renderer.drawRect(
            this.x + 5,
            this.y + 15,
            6,
            2,
            'rgba(92, 64, 51, 0.15)',
            CONSTANTS.LAYER.GROUND
        );
        
        // Sign post (brown wood grain)
        renderer.drawRect(
            this.x + 4,
            this.y + 7,
            4,
            9,
            '#6b4423',
            CONSTANTS.LAYER.GROUND_DECORATION
        );
        // Post highlight
        renderer.drawRect(
            this.x + 5,
            this.y + 7,
            1,
            8,
            '#8b5a2b',
            CONSTANTS.LAYER.GROUND_DECORATION
        );
        // Post shadow
        renderer.drawRect(
            this.x + 7,
            this.y + 7,
            1,
            8,
            '#4a3015',
            CONSTANTS.LAYER.GROUND_DECORATION
        );

        // Sign board background
        renderer.drawRect(
            this.x,
            this.y,
            12,
            8,
            '#c9a66b',
            CONSTANTS.LAYER.GROUND_DECORATION
        );
        
        // Sign board border (dark wood frame)
        // Top
        renderer.drawRect(this.x, this.y, 12, 1, '#5c3d2e', CONSTANTS.LAYER.GROUND_DECORATION);
        // Bottom
        renderer.drawRect(this.x, this.y + 7, 12, 1, '#5c3d2e', CONSTANTS.LAYER.GROUND_DECORATION);
        // Left
        renderer.drawRect(this.x, this.y, 1, 8, '#5c3d2e', CONSTANTS.LAYER.GROUND_DECORATION);
        // Right
        renderer.drawRect(this.x + 11, this.y, 1, 8, '#5c3d2e', CONSTANTS.LAYER.GROUND_DECORATION);
        
        // Inner highlight (top-left light)
        renderer.drawRect(this.x + 1, this.y + 1, 10, 1, '#e0c992', CONSTANTS.LAYER.GROUND_DECORATION);
        renderer.drawRect(this.x + 1, this.y + 1, 1, 5, '#e0c992', CONSTANTS.LAYER.GROUND_DECORATION);
        
        // Inner shadow (bottom-right dark)
        renderer.drawRect(this.x + 1, this.y + 6, 10, 1, '#a68b4b', CONSTANTS.LAYER.GROUND_DECORATION);
        renderer.drawRect(this.x + 10, this.y + 2, 1, 4, '#a68b4b', CONSTANTS.LAYER.GROUND_DECORATION);
        
        // Text hint (small lines to suggest writing)
        renderer.drawRect(this.x + 3, this.y + 3, 6, 1, '#6b5030', CONSTANTS.LAYER.GROUND_DECORATION);
        renderer.drawRect(this.x + 3, this.y + 5, 4, 1, '#6b5030', CONSTANTS.LAYER.GROUND_DECORATION);
    }
}
