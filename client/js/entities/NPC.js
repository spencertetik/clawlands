// NPC entity with dialog and sprite
class NPC extends Entity {
    constructor(x, y, name = 'NPC', dialog = [], species = null) {
        super(x, y, CONSTANTS.CHARACTER_WIDTH, CONSTANTS.CHARACTER_HEIGHT);
        this.name = name;
        this.dialog = Array.isArray(dialog) ? dialog : [dialog];
        this.color = '#6b5b95'; // Fallback purple tint
        
        // Assign species (random if not specified)
        const speciesList = ['lobster', 'crab', 'shrimp', 'mantis_shrimp', 'hermit_crab'];
        this.species = species || speciesList[Math.floor(Math.random() * speciesList.length)];
        
        // Sprite will be loaded externally
        this.sprite = null;
        this.spritesByDirection = {}; // { south: img, north: img, east: img, west: img }
        this.direction = 'south'; // NPCs face down by default
        
        // Random hue shift for variety
        this.hueShift = Math.floor(Math.random() * 360);
        
        // Wandering behavior
        this.canWander = false; // Set to true for wandering NPCs
        this.wanderTimer = Math.random() * 1000; // Start with some randomness so not all sync
        this.wanderInterval = 1000 + Math.random() * 2000; // 1-3 seconds between moves (faster)
        this.wanderSpeed = 40; // Faster movement (was 30)
        this.isMoving = false;
        this.moveTarget = null;
        this.homePosition = { x, y }; // Remember spawn position
        this.wanderRadius = 48; // How far from home they can wander (3 tiles)
        
        // Animation
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 150; // ms per frame
        
        // Walk sprites by direction (loaded externally)
        this.walkSpritesByDirection = {}; // { south: [frame0, frame1, frame2], ... }
    }

    // Set the sprite image (south-facing default)
    setSprite(image) {
        this.sprite = image;
        this.spritesByDirection.south = image;
    }
    
    // Set directional sprites for animated NPCs
    setDirectionalSprites(sprites) {
        this.spritesByDirection = sprites;
        this.sprite = sprites.south || this.sprite;
    }
    
    // Set walk animation sprites by direction
    // walkSprites: { south: [frame0, frame1, frame2], north: [...], east: [...], west: [...] }
    setWalkSprites(walkSprites) {
        this.walkSpritesByDirection = walkSprites;
    }

    // Update NPC (wandering behavior)
    update(deltaTime, collisionSystem = null) {
        // Update animation even if not wandering
        if (this.isMoving) {
            this.animationTimer += deltaTime * 1000;
            if (this.animationTimer >= this.animationSpeed) {
                this.animationTimer = 0;
                this.animationFrame = (this.animationFrame + 1) % 3; // 3 walk frames
            }
        } else {
            this.animationFrame = 0;
            this.animationTimer = 0;
        }
        
        if (!this.canWander) return;
        
        // Debug: log first time this NPC tries to wander
        if (!this._loggedWander) {
            console.log(`🚶 ${this.name} wandering enabled, timer: ${this.wanderTimer}, interval: ${this.wanderInterval}`);
            this._loggedWander = true;
        }
        
        // If moving toward a target
        if (this.isMoving && this.moveTarget) {
            const dx = this.moveTarget.x - this.position.x;
            const dy = this.moveTarget.y - this.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 2) {
                // Reached target
                this.isMoving = false;
                this.moveTarget = null;
            } else {
                // Move toward target
                const moveX = (dx / dist) * this.wanderSpeed * deltaTime;
                const moveY = (dy / dist) * this.wanderSpeed * deltaTime;
                
                const newX = this.position.x + moveX;
                const newY = this.position.y + moveY;
                
                // Check collision before moving (use smaller hitbox for NPCs)
                // Pass 'this' to exclude self from NPC collision checks
                const canMove = !collisionSystem || !collisionSystem.checkCollision(
                    newX + 4, newY + 8, this.width - 8, this.height - 8, this
                );
                
                // Also check if we'd walk onto the player (NPCs should avoid player)
                let wouldHitPlayer = false;
                if (collisionSystem && collisionSystem.player) {
                    const p = collisionSystem.player;
                    const npcBox = { x: newX + 4, y: newY + 8, w: this.width - 8, h: this.height - 8 };
                    const playerBox = { x: p.position.x, y: p.position.y, w: p.width, h: p.height };
                    
                    // AABB overlap check
                    wouldHitPlayer = !(
                        npcBox.x + npcBox.w < playerBox.x ||
                        npcBox.x > playerBox.x + playerBox.w ||
                        npcBox.y + npcBox.h < playerBox.y ||
                        npcBox.y > playerBox.y + playerBox.h
                    );
                }
                
                if (canMove && !wouldHitPlayer) {
                    this.position.x = newX;
                    this.position.y = newY;
                    
                    // Update direction based on movement
                    if (Math.abs(dx) > Math.abs(dy)) {
                        this.direction = dx > 0 ? 'east' : 'west';
                    } else {
                        this.direction = dy > 0 ? 'south' : 'north';
                    }
                } else {
                    // Hit something or player is in the way, stop
                    this.isMoving = false;
                    this.moveTarget = null;
                }
            }
        } else {
            // Idle, count down to next wander
            this.wanderTimer += deltaTime * 1000;
            if (this.wanderTimer >= this.wanderInterval) {
                this.wanderTimer = 0;
                this.wanderInterval = 2000 + Math.random() * 3000;
                this.startWander();
            }
        }
    }
    
    // Pick a random nearby spot to wander to
    startWander() {
        // Random angle and distance
        const angle = Math.random() * Math.PI * 2;
        const distance = 16 + Math.random() * this.wanderRadius;
        
        const targetX = this.homePosition.x + Math.cos(angle) * distance;
        const targetY = this.homePosition.y + Math.sin(angle) * distance;
        
        this.moveTarget = { x: targetX, y: targetY };
        this.isMoving = true;
        
        console.log(`🚶 ${this.name} starts walking to (${Math.round(targetX)}, ${Math.round(targetY)})`);
        
        // Update direction immediately when starting to move
        const dx = targetX - this.position.x;
        const dy = targetY - this.position.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'east' : 'west';
        } else {
            this.direction = dy > 0 ? 'south' : 'north';
        }
    }
    
    // Check if player would collide with this NPC
    checkCollision(playerX, playerY, playerWidth, playerHeight) {
        // Simple AABB collision
        return playerX < this.position.x + this.width &&
               playerX + playerWidth > this.position.x &&
               playerY < this.position.y + this.height &&
               playerY + playerHeight > this.position.y;
    }

    // Render NPC with sprite or fallback to rectangle
    render(renderer) {
        // Draw shadow beneath character for grounding
        this.renderShadow(renderer);
        
        // Get directional sprite - use walk sprites if moving
        let currentSprite = null;
        
        if (this.isMoving && this.walkSpritesByDirection[this.direction]) {
            // Use walk animation frame
            const walkFrames = this.walkSpritesByDirection[this.direction];
            // Check if the specific frame exists (handles sparse arrays from async loading)
            const frameIndex = this.animationFrame % 3;
            if (walkFrames && walkFrames[frameIndex]) {
                currentSprite = walkFrames[frameIndex];
            }
        }
        
        // Fallback to static directional sprite or default
        if (!currentSprite) {
            currentSprite = this.spritesByDirection[this.direction] || this.sprite;
        }
        
        const renderScale = CONSTANTS.CHARACTER_RENDER_SCALE || 1;
        const spriteWidth = CONSTANTS.CHARACTER_SPRITE_WIDTH || this.width;
        const spriteHeight = CONSTANTS.CHARACTER_SPRITE_HEIGHT || this.height;
        const renderWidth = spriteWidth * renderScale;
        const renderHeight = spriteHeight * renderScale;
        const renderX = this.position.x - (renderWidth - this.width) / 2;
        const renderY = this.position.y - (renderHeight - this.height);

        if (currentSprite) {
            renderer.drawSprite(
                currentSprite,
                0, 0,
                currentSprite.width,
                currentSprite.height,
                renderX,
                renderY,
                renderWidth,
                renderHeight,
                CONSTANTS.LAYER.ENTITIES
            );
        } else {
            // Fallback to colored rectangle
            renderer.drawRect(
                renderX,
                renderY,
                renderWidth,
                renderHeight,
                this.color,
                CONSTANTS.LAYER.ENTITIES
            );
        }
    }
    
    // Render shadow beneath character for visual grounding
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

        // Draw name above NPC with outline for readability
        // Center text above sprite - use character pixel width for accurate centering
        const charWidth = 3.5; // Approximate pixel width per character at font size 6
        const textWidth = this.name.length * charWidth;
        const nameX = this.position.x + this.width / 2 - textWidth / 2;
        const nameY = this.position.y - 10; // Raise slightly higher above sprite
        
        // Draw shadow/outline first (offset by 1px in each direction)
        renderer.drawText(this.name, nameX - 1, nameY, '#000', 6, CONSTANTS.LAYER.UI);
        renderer.drawText(this.name, nameX + 1, nameY, '#000', 6, CONSTANTS.LAYER.UI);
        renderer.drawText(this.name, nameX, nameY - 1, '#000', 6, CONSTANTS.LAYER.UI);
        renderer.drawText(this.name, nameX, nameY + 1, '#000', 6, CONSTANTS.LAYER.UI);
        // Draw main text on top
        renderer.drawText(this.name, nameX, nameY, '#fff', 6, CONSTANTS.LAYER.UI);
    }

    getDialog() {
        return this.dialog;
    }
}
