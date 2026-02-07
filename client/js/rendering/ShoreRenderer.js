// ShoreRenderer - Enhanced shore/beach transitions for water-adjacent tiles
class ShoreRenderer {
    constructor() {
        // Beach/shore colors
        this.shoreColors = {
            sand: 'rgb(240, 220, 180)', // Light sandy color
            wetSand: 'rgb(200, 180, 140)', // Darker wet sand
            sandBorder: 'rgb(220, 200, 160)' // Border transition color
        };
        
        // Border thickness in pixels (scaled by tile size)
        this.borderThickness = 2;
        
        console.log('🏖️ Shore renderer initialized');
    }
    
    // Render shore transitions for visible tiles
    render(renderer, camera, worldMap) {
        if (!worldMap || !worldMap.terrainMap) return;
        
        const tileSize = CONSTANTS.TILE_SIZE;
        const bounds = camera.getVisibleTileBounds(tileSize);
        
        // Only render shores in visible area
        for (let row = bounds.startRow; row < bounds.endRow; row++) {
            if (row < 0 || row >= worldMap.height) continue;
            
            for (let col = bounds.startCol; col < bounds.endCol; col++) {
                if (col < 0 || col >= worldMap.width) continue;
                
                // Check if this tile is land (terrainMap: 0 = land, 1 = water)
                const terrain = worldMap.terrainMap[row][col];
                if (terrain === 0) { // Only process land tiles
                    this.renderShoreBorders(renderer, worldMap, col, row, tileSize);
                }
            }
        }
    }
    
    // Render shore borders for a single land tile if adjacent to water
    renderShoreBorders(renderer, worldMap, col, row, tileSize) {
        const x = col * tileSize;
        const y = row * tileSize;
        
        // Check all 8 directions (including diagonals for smoother transitions)
        const directions = [
            { dx: 0, dy: -1, side: 'top' },    // North
            { dx: 1, dy: 0, side: 'right' },   // East  
            { dx: 0, dy: 1, side: 'bottom' },  // South
            { dx: -1, dy: 0, side: 'left' },   // West
            { dx: 1, dy: -1, side: 'topRight' },    // Northeast
            { dx: 1, dy: 1, side: 'bottomRight' },  // Southeast
            { dx: -1, dy: 1, side: 'bottomLeft' },  // Southwest
            { dx: -1, dy: -1, side: 'topLeft' }     // Northwest
        ];
        
        // Track which sides have water
        const waterSides = [];
        
        for (const dir of directions) {
            const checkCol = col + dir.dx;
            const checkRow = row + dir.dy;
            
            // Check bounds
            if (checkRow < 0 || checkRow >= worldMap.height || 
                checkCol < 0 || checkCol >= worldMap.width) {
                continue;
            }
            
            // If adjacent tile is water, mark this side
            if (worldMap.terrainMap[checkRow][checkCol] === 1) {
                waterSides.push(dir.side);
            }
        }
        
        // If no water neighbors, no shore needed
        if (waterSides.length === 0) return;
        
        // Draw shore borders based on water sides
        this.drawShoreBorders(renderer, x, y, tileSize, waterSides);
    }
    
    // Draw shore border graphics based on which sides have water
    drawShoreBorders(renderer, x, y, tileSize, waterSides) {
        const borderWidth = this.borderThickness;
        
        // Add border overlays to the ground decoration layer
        renderer.addToLayer(CONSTANTS.LAYER.GROUND_DECORATION, (ctx) => {
            ctx.fillStyle = this.shoreColors.sandBorder;
            
            // Draw borders on water-facing edges
            for (const side of waterSides) {
                switch (side) {
                    case 'top':
                        // Top edge
                        ctx.fillRect(x, y, tileSize, borderWidth);
                        break;
                    case 'right':
                        // Right edge  
                        ctx.fillRect(x + tileSize - borderWidth, y, borderWidth, tileSize);
                        break;
                    case 'bottom':
                        // Bottom edge
                        ctx.fillRect(x, y + tileSize - borderWidth, tileSize, borderWidth);
                        break;
                    case 'left':
                        // Left edge
                        ctx.fillRect(x, y, borderWidth, tileSize);
                        break;
                    case 'topRight':
                        // Corner accent - small triangle
                        ctx.fillRect(x + tileSize - borderWidth*2, y, borderWidth*2, borderWidth);
                        ctx.fillRect(x + tileSize - borderWidth, y, borderWidth, borderWidth*2);
                        break;
                    case 'bottomRight':
                        ctx.fillRect(x + tileSize - borderWidth*2, y + tileSize - borderWidth, borderWidth*2, borderWidth);
                        ctx.fillRect(x + tileSize - borderWidth, y + tileSize - borderWidth*2, borderWidth, borderWidth*2);
                        break;
                    case 'bottomLeft':
                        ctx.fillRect(x, y + tileSize - borderWidth, borderWidth*2, borderWidth);
                        ctx.fillRect(x, y + tileSize - borderWidth*2, borderWidth, borderWidth*2);
                        break;
                    case 'topLeft':
                        ctx.fillRect(x, y, borderWidth*2, borderWidth);
                        ctx.fillRect(x, y, borderWidth, borderWidth*2);
                        break;
                }
            }
            
            // Add subtle wet sand effect for tiles completely surrounded by water on 3+ sides
            if (waterSides.length >= 3) {
                ctx.fillStyle = this.shoreColors.wetSand;
                ctx.globalAlpha = 0.3;
                ctx.fillRect(x + borderWidth, y + borderWidth, 
                           tileSize - borderWidth*2, tileSize - borderWidth*2);
                ctx.globalAlpha = 1.0;
            }
        });
    }
    
    // Set custom shore colors (for different biomes)
    setShoreColors(colors) {
        this.shoreColors = { ...this.shoreColors, ...colors };
    }
    
    // Set border thickness
    setBorderThickness(thickness) {
        this.borderThickness = Math.max(1, Math.min(4, thickness));
    }
}