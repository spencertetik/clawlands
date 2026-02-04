// Player entity controlled by input
class Player extends Entity {
    constructor(x, y, name = 'Player') {
        super(x, y, CONSTANTS.CHARACTER_WIDTH, CONSTANTS.CHARACTER_HEIGHT);

        this.name = name;
        this.speed = CONSTANTS.PLAYER_SPEED;
        this.isMoving = false;

        // Character customization (will be set by character builder)
        this.characterData = null;

        // Animation state
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 1000 / CONSTANTS.WALK_ANIMATION_FPS; // ms per frame
    }

    // Update player based on input
    update(deltaTime, inputManager, collisionSystem) {
        // Get movement from input
        const movement = inputManager.getMovementVector();

        // Update direction if moving
        if (movement.length() > 0) {
            const dir = inputManager.getDirection();
            if (dir) {
                this.direction = dir;
            }
            this.isMoving = true;

            // Calculate velocity
            this.velocity.x = movement.x * this.speed;
            this.velocity.y = movement.y * this.speed;

            // Calculate new position
            const newX = this.position.x + this.velocity.x * deltaTime;
            const newY = this.position.y + this.velocity.y * deltaTime;

            // Check collision before moving
            const canMoveX = !collisionSystem || !collisionSystem.checkCollision(newX, this.position.y, this.width, this.height);
            const canMoveY = !collisionSystem || !collisionSystem.checkCollision(this.position.x, newY, this.width, this.height);

            // Apply movement
            if (canMoveX) {
                this.position.x = newX;
            }
            if (canMoveY) {
                this.position.y = newY;
            }

            // Update animation
            this.updateAnimation(deltaTime);
        } else {
            this.isMoving = false;
            this.velocity.set(0, 0);
            this.animationFrame = 0;
        }
    }

    // Update animation frame
    updateAnimation(deltaTime) {
        this.animationTimer += deltaTime * 1000; // convert to ms

        if (this.animationTimer >= this.animationSpeed) {
            this.animationTimer = 0;
            this.animationFrame = (this.animationFrame + 1) % 3; // 3 walk frames
        }
    }

    // Render player
    render(renderer, spriteRenderer = null) {
        const renderScale = CONSTANTS.CHARACTER_RENDER_SCALE || 1;
        const spriteWidth = CONSTANTS.CHARACTER_SPRITE_WIDTH || this.width;
        const spriteHeight = CONSTANTS.CHARACTER_SPRITE_HEIGHT || this.height;
        const renderWidth = spriteWidth * renderScale;
        const renderHeight = spriteHeight * renderScale;
        const renderX = this.position.x - (renderWidth - this.width) / 2;
        const renderY = this.position.y - (renderHeight - this.height);

        // Draw shadow beneath player for grounding
        this.renderShadow(renderer);

        // Try to use sprite renderer if available
        if (spriteRenderer) {
            const frameIndex = this.animationFrame;
            const dirMap = {
                [CONSTANTS.DIRECTION.DOWN]: 'down',
                [CONSTANTS.DIRECTION.UP]: 'up',
                [CONSTANTS.DIRECTION.LEFT]: 'left',
                [CONSTANTS.DIRECTION.RIGHT]: 'right'
            };
            const direction = dirMap[this.direction] || 'down';

            // Use walk sprite sheet when moving, idle when standing
            const spriteSheet = this.isMoving ? 'character_walk' : 'character_idle';
            const animation = this.isMoving ? 'walk' : 'idle';

            if (spriteRenderer.hasSprite(spriteSheet)) {
                spriteRenderer.renderAnimated(
                    spriteSheet,
                    animation,
                    frameIndex,
                    renderX,
                    renderY,
                    renderWidth,
                    renderHeight,
                    direction,
                    CONSTANTS.LAYER.ENTITIES
                );

                return; // Skip placeholder rendering
            }
        }

        // Fallback: render a simple colored rectangle as placeholder
        let color = '#ff4520'; // Red-orange lobster color

        // Draw character rectangle
        renderer.drawRect(
            renderX,
            renderY,
            renderWidth,
            renderHeight,
            color,
            CONSTANTS.LAYER.ENTITIES
        );

        // Draw direction indicator (small rectangle on the side facing direction)
        let indicatorX = renderX;
        let indicatorY = renderY;
        let indicatorWidth = 4;
        let indicatorHeight = 4;

        switch (this.direction) {
            case CONSTANTS.DIRECTION.UP:
                indicatorX += renderWidth / 2 - 2;
                indicatorY -= 4;
                break;
            case CONSTANTS.DIRECTION.DOWN:
                indicatorX += renderWidth / 2 - 2;
                indicatorY += renderHeight;
                break;
            case CONSTANTS.DIRECTION.LEFT:
                indicatorX -= 4;
                indicatorY += renderHeight / 2 - 2;
                break;
            case CONSTANTS.DIRECTION.RIGHT:
                indicatorX += renderWidth;
                indicatorY += renderHeight / 2 - 2;
                break;
        }

        renderer.drawRect(
            indicatorX,
            indicatorY,
            indicatorWidth,
            indicatorHeight,
            '#fff',
            CONSTANTS.LAYER.ENTITIES
        );

        // Draw name tag above player
        renderer.drawText(
            this.name,
            renderX + renderWidth / 2 - this.name.length * 2,
            renderY - 5,
            '#fff',
            8,
            CONSTANTS.LAYER.UI
        );

        // Draw animation frame indicator (for testing)
        if (this.isMoving) {
            const frameSize = 2;
            for (let i = 0; i < 4; i++) {
                const frameColor = i === this.animationFrame ? '#0f0' : '#333';
                renderer.drawRect(
                    this.position.x + i * 3,
                    this.position.y + this.height + 2,
                    frameSize,
                    frameSize,
                    frameColor,
                    CONSTANTS.LAYER.UI
                );
            }
        }
    }

    // Render shadow beneath player for visual grounding
    renderShadow(renderer) {
        // Proper gradient shadow: opaque core → transparent edge
        const shadowWidth = this.width + 4; // Wider footprint for anchoring
        const shadowHeight = 6;
        const shadowX = this.position.x - 2;
        const shadowY = this.position.y + this.height - 2;
        
        // Layer 1: Outermost (most transparent edge)
        renderer.drawRect(
            shadowX,
            shadowY,
            shadowWidth,
            shadowHeight,
            'rgba(74, 55, 40, 0.08)', // Very soft outer edge
            CONSTANTS.LAYER.GROUND
        );
        
        // Layer 2: Middle ring
        renderer.drawRect(
            shadowX + 1,
            shadowY + 1,
            shadowWidth - 2,
            shadowHeight - 2,
            'rgba(74, 55, 40, 0.15)',
            CONSTANTS.LAYER.GROUND
        );
        
        // Layer 3: Inner ring  
        renderer.drawRect(
            shadowX + 2,
            shadowY + 1,
            shadowWidth - 4,
            shadowHeight - 2,
            'rgba(74, 55, 40, 0.22)',
            CONSTANTS.LAYER.GROUND_DECORATION
        );
        
        // Layer 4: Opaque core (directly under feet)
        renderer.drawRect(
            this.position.x + 2,
            this.position.y + this.height - 2,
            this.width - 4,
            3,
            'rgba(74, 55, 40, 0.35)', // High opacity core
            CONSTANTS.LAYER.GROUND_DECORATION
        );
    }

    // Set character customization data
    setCharacterData(characterData) {
        this.characterData = characterData;
        this.name = characterData.name;
    }
}
