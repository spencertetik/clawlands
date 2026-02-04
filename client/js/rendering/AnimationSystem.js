// Animation system for managing sprite animations
class AnimationSystem {
    constructor() {
        this.animations = new Map();
    }

    // Create an animation state for an entity
    createAnimation(entityId, defaultAnimation = 'idle') {
        const animState = {
            currentAnimation: defaultAnimation,
            currentFrame: 0,
            frameTime: 0,
            frameDuration: 0.15, // 150ms per frame (default)
            isPlaying: true,
            loop: true
        };

        this.animations.set(entityId, animState);
        return animState;
    }

    // Update animation state
    update(entityId, deltaTime) {
        const animState = this.animations.get(entityId);
        if (!animState || !animState.isPlaying) {
            return;
        }

        animState.frameTime += deltaTime;

        if (animState.frameTime >= animState.frameDuration) {
            animState.frameTime = 0;
            animState.currentFrame++;

            // Handle looping or stopping
            if (!animState.loop && animState.currentFrame >= animState.maxFrames) {
                animState.currentFrame = animState.maxFrames - 1;
                animState.isPlaying = false;
            }
        }
    }

    // Change current animation
    setAnimation(entityId, animationName, frameCount = 4, frameDuration = 0.15, loop = true) {
        const animState = this.animations.get(entityId);
        if (!animState) {
            return;
        }

        // Only reset if switching to different animation
        if (animState.currentAnimation !== animationName) {
            animState.currentAnimation = animationName;
            animState.currentFrame = 0;
            animState.frameTime = 0;
            animState.maxFrames = frameCount;
            animState.frameDuration = frameDuration;
            animState.loop = loop;
            animState.isPlaying = true;
        }
    }

    // Get current frame
    getCurrentFrame(entityId) {
        const animState = this.animations.get(entityId);
        return animState ? animState.currentFrame : 0;
    }

    // Get animation state
    getAnimationState(entityId) {
        return this.animations.get(entityId);
    }

    // Play animation
    play(entityId) {
        const animState = this.animations.get(entityId);
        if (animState) {
            animState.isPlaying = true;
        }
    }

    // Pause animation
    pause(entityId) {
        const animState = this.animations.get(entityId);
        if (animState) {
            animState.isPlaying = false;
        }
    }

    // Reset animation to first frame
    reset(entityId) {
        const animState = this.animations.get(entityId);
        if (animState) {
            animState.currentFrame = 0;
            animState.frameTime = 0;
        }
    }

    // Remove animation
    removeAnimation(entityId) {
        this.animations.delete(entityId);
    }
}
