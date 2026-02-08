// WaterRenderer - Subtle animated overlay on water tiles (preserves autotile transitions)
class WaterRenderer {
    constructor() {
        // Animation timing
        this.animationSpeed = 1200; // ms per frame (slow for subtle)
        this.currentFrame = 0;
        this.frameCount = 4;
        this.lastFrameTime = 0;
        
        // Subtle wave shimmer alphas (very light overlay to animate without destroying tileset art)
        this.frameAlphas = [0.0, 0.04, 0.08, 0.04];
        
        // Highlight color for wave shimmer
        this.shimmerColor = 'rgba(180, 220, 255,'; // Closed by alpha)
        
        // Specular highlight positions (cached per-tile for consistency)
        this.specularSeed = Date.now();
    }
    
    // Update animation timing
    update(deltaTime) {
        this.lastFrameTime += deltaTime * 1000;
        
        if (this.lastFrameTime >= this.animationSpeed) {
            this.currentFrame = (this.currentFrame + 1) % this.frameCount;
            this.lastFrameTime = 0;
        }
    }
    
    // Render subtle shimmer on water tiles (does NOT replace tile art)
    render(renderer, camera, worldMap) {
        if (!worldMap || !worldMap.terrainMap) return;
        
        const alpha = this.frameAlphas[this.currentFrame];
        
        // Frame 0 has zero alpha — skip entirely for performance
        if (alpha <= 0) return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        const bounds = camera.getVisibleTileBounds(tileSize);
        const colorStr = this.shimmerColor + alpha + ')';
        
        for (let row = bounds.startRow; row < bounds.endRow; row++) {
            if (row < 0 || row >= worldMap.height) continue;
            
            for (let col = bounds.startCol; col < bounds.endCol; col++) {
                if (col < 0 || col >= worldMap.width) continue;
                
                // Only fully-water tiles (not edge transitions)
                if (worldMap.terrainMap[row][col] !== 1) continue;
                
                // Check if ALL 4 cardinal neighbors are also water (skip shore edges)
                const isFullWater = this.isFullyWater(worldMap, col, row);
                if (!isFullWater) continue;
                
                const x = col * tileSize;
                const y = row * tileSize;
                
                renderer.addToLayer(CONSTANTS.LAYER.GROUND_DECORATION, (ctx) => {
                    ctx.fillStyle = colorStr;
                    ctx.fillRect(Math.floor(x), Math.floor(y), tileSize, tileSize);
                });
            }
        }
    }
    
    // Check if tile and all cardinal neighbors are water (deep water)
    isFullyWater(worldMap, col, row) {
        const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        for (const [dx, dy] of dirs) {
            const r = row + dy, c = col + dx;
            if (r < 0 || r >= worldMap.height || c < 0 || c >= worldMap.width) continue;
            if (worldMap.terrainMap[r][c] !== 1) return false;
        }
        return true;
    }
    
    // Get current animation frame (for external sync)
    getCurrentFrame() {
        return this.currentFrame;
    }
}
