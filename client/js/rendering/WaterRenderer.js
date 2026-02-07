// WaterRenderer - Performant water animation using palette cycling
class WaterRenderer {
    constructor() {
        // Animation timing (slower for subtle effect)
        this.animationSpeed = 800; // Milliseconds per frame
        this.currentFrame = 0;
        this.frameCount = 3; // 3-frame animation cycle
        this.lastFrameTime = 0;
        
        // Water animation colors (blue palette cycle)
        this.waterPalettes = [
            // Frame 0: Base water color
            { r: 80, g: 160, b: 240 },  // #50a0f0
            // Frame 1: Slightly lighter (wave peak)
            { r: 90, g: 175, b: 245 },  // #5aafF5  
            // Frame 2: Slightly darker (wave trough)
            { r: 70, g: 145, b: 235 }   // #4691eb
        ];
        
        // Cache for color strings to avoid string concatenation every frame
        this.cachedColors = this.waterPalettes.map(p => `rgb(${p.r},${p.g},${p.b})`);
        
        // Track viewport for performance - only animate visible tiles
        this.lastViewportBounds = null;
    }
    
    // Update animation timing
    update(deltaTime) {
        this.lastFrameTime += deltaTime * 1000; // Convert to milliseconds
        
        if (this.lastFrameTime >= this.animationSpeed) {
            this.currentFrame = (this.currentFrame + 1) % this.frameCount;
            this.lastFrameTime = 0;
        }
    }
    
    // Render animated water tiles in viewport
    render(renderer, camera, worldMap) {
        if (!worldMap || !worldMap.terrainMap) return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        
        // Get visible tile bounds (only animate what's on screen)
        const bounds = camera.getVisibleTileBounds(tileSize);
        
        // Cache current water color
        const currentWaterColor = this.cachedColors[this.currentFrame];
        
        // Only animate water tiles in the visible area
        for (let row = bounds.startRow; row < bounds.endRow; row++) {
            if (row < 0 || row >= worldMap.height) continue;
            
            for (let col = bounds.startCol; col < bounds.endCol; col++) {
                if (col < 0 || col >= worldMap.width) continue;
                
                // Check if this tile is water (terrainMap: 1 = water)
                const terrain = worldMap.terrainMap[row][col];
                if (terrain === 1) {
                    // Draw animated water tile
                    const x = col * tileSize;
                    const y = row * tileSize;
                    
                    renderer.addToLayer(CONSTANTS.LAYER.GROUND, (ctx) => {
                        ctx.fillStyle = currentWaterColor;
                        ctx.fillRect(
                            Math.floor(x), 
                            Math.floor(y), 
                            tileSize, 
                            tileSize
                        );
                    });
                }
            }
        }
    }
    
    // Get current water color for other systems that might need it
    getCurrentWaterColor() {
        return this.cachedColors[this.currentFrame];
    }
    
    // Manual frame advance (for testing or sync purposes)
    advanceFrame() {
        this.currentFrame = (this.currentFrame + 1) % this.frameCount;
    }
}