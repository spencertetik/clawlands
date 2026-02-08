// ShoreRenderer - Soft gradient shore transitions (sand→water)
// Draws smooth gradient overlays on water tiles adjacent to land
class ShoreRenderer {
    constructor() {
        // Foam/shore gradient cached canvases (one per edge configuration)
        this.gradientCache = new Map();
        this.tileSize = CONSTANTS.TILE_SIZE;
        
        // Shore colors — light sandy foam that blends into water
        this.foamColor = { r: 230, g: 215, b: 175 }; // Warm sand
        this.foamAlpha = 0.55; // How opaque the foam edge is at its strongest
        
        console.log('🏖️ Shore renderer initialized (soft gradient mode)');
    }
    
    render(renderer, camera, worldMap) {
        if (!worldMap || !worldMap.terrainMap) return;
        
        const tileSize = this.tileSize;
        const bounds = camera.getVisibleTileBounds(tileSize);
        
        for (let row = bounds.startRow; row < bounds.endRow; row++) {
            if (row < 0 || row >= worldMap.height) continue;
            
            for (let col = bounds.startCol; col < bounds.endCol; col++) {
                if (col < 0 || col >= worldMap.width) continue;
                
                // Only process WATER tiles that are next to land
                if (worldMap.terrainMap[row][col] !== 1) continue;
                
                // Check which sides have land neighbors
                const landSides = this.getLandNeighbors(worldMap, col, row);
                if (landSides.length === 0) continue;
                
                const x = col * tileSize;
                const y = row * tileSize;
                
                // Draw soft gradient foam on this water tile from land-facing edges
                this.drawFoamGradient(renderer, x, y, tileSize, landSides);
            }
        }
    }
    
    getLandNeighbors(worldMap, col, row) {
        const sides = [];
        const checks = [
            { dx: 0, dy: -1, side: 'top' },
            { dx: 0, dy: 1, side: 'bottom' },
            { dx: -1, dy: 0, side: 'left' },
            { dx: 1, dy: 0, side: 'right' }
        ];
        
        for (const c of checks) {
            const r = row + c.dy, cc = col + c.dx;
            if (r < 0 || r >= worldMap.height || cc < 0 || cc >= worldMap.width) continue;
            if (worldMap.terrainMap[r][cc] === 0) { // land
                sides.push(c.side);
            }
        }
        return sides;
    }
    
    drawFoamGradient(renderer, x, y, tileSize, landSides) {
        const { r, g, b } = this.foamColor;
        const maxAlpha = this.foamAlpha;
        
        renderer.addToLayer(CONSTANTS.LAYER.GROUND_DECORATION, (ctx) => {
            for (const side of landSides) {
                let gradient;
                
                switch (side) {
                    case 'top':
                        // Land is above — gradient fades from top to bottom of this water tile
                        gradient = ctx.createLinearGradient(x, y, x, y + tileSize);
                        gradient.addColorStop(0, `rgba(${r},${g},${b},${maxAlpha})`);
                        gradient.addColorStop(0.4, `rgba(${r},${g},${b},${maxAlpha * 0.3})`);
                        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
                        break;
                    case 'bottom':
                        gradient = ctx.createLinearGradient(x, y + tileSize, x, y);
                        gradient.addColorStop(0, `rgba(${r},${g},${b},${maxAlpha})`);
                        gradient.addColorStop(0.4, `rgba(${r},${g},${b},${maxAlpha * 0.3})`);
                        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
                        break;
                    case 'left':
                        gradient = ctx.createLinearGradient(x, y, x + tileSize, y);
                        gradient.addColorStop(0, `rgba(${r},${g},${b},${maxAlpha})`);
                        gradient.addColorStop(0.4, `rgba(${r},${g},${b},${maxAlpha * 0.3})`);
                        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
                        break;
                    case 'right':
                        gradient = ctx.createLinearGradient(x + tileSize, y, x, y);
                        gradient.addColorStop(0, `rgba(${r},${g},${b},${maxAlpha})`);
                        gradient.addColorStop(0.4, `rgba(${r},${g},${b},${maxAlpha * 0.3})`);
                        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
                        break;
                }
                
                if (gradient) {
                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, y, tileSize, tileSize);
                }
            }
        });
    }
}
