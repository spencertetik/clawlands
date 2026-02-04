// Sprite renderer for characters and entities
class SpriteRenderer {
    constructor(renderEngine) {
        this.renderEngine = renderEngine;
        this.sprites = new Map();
    }

    // Add a sprite sheet
    addSpriteSheet(key, image, frameWidth, frameHeight, animations) {
        this.sprites.set(key, {
            image,
            frameWidth,
            frameHeight,
            animations
        });
    }

    // Render a sprite frame
    renderSprite(spriteKey, frameIndex, x, y, width, height, layer = CONSTANTS.LAYER.ENTITIES, flipX = false) {
        const sprite = this.sprites.get(spriteKey);
        if (!sprite) {
            console.warn(`Sprite not found: ${spriteKey}`);
            return;
        }

        const image = sprite.image;
        const frameWidth = sprite.frameWidth;
        const frameHeight = sprite.frameHeight;

        // Calculate source position in sprite sheet
        const framesPerRow = Math.floor(image.width / frameWidth);
        const srcX = (frameIndex % framesPerRow) * frameWidth;
        const srcY = Math.floor(frameIndex / framesPerRow) * frameHeight;

        // Render sprite
        this.renderEngine.drawSprite(
            image,
            srcX, srcY, frameWidth, frameHeight,
            x, y, width, height,
            layer,
            flipX
        );
    }

    // Render an animated sprite based on animation state
    renderAnimated(spriteKey, animationName, frameIndex, x, y, width, height, direction, layer = CONSTANTS.LAYER.ENTITIES) {
        const sprite = this.sprites.get(spriteKey);
        if (!sprite || !sprite.animations) {
            this.renderSprite(spriteKey, frameIndex, x, y, width, height, layer);
            return;
        }

        const animation = sprite.animations[animationName];
        if (!animation) {
            this.renderSprite(spriteKey, frameIndex, x, y, width, height, layer);
            return;
        }

        // Get direction-specific frames
        const directionFrames = animation[direction];
        if (!directionFrames) {
            this.renderSprite(spriteKey, frameIndex, x, y, width, height, layer);
            return;
        }

        // Get actual frame from animation sequence
        const actualFrame = directionFrames[frameIndex % directionFrames.length];
        this.renderSprite(spriteKey, actualFrame, x, y, width, height, layer);
    }

    // Check if sprite exists
    hasSprite(key) {
        return this.sprites.has(key);
    }

    // Get sprite info
    getSpriteInfo(key) {
        return this.sprites.get(key);
    }
}
