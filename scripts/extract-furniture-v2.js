const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_FILE = path.join(process.env.HOME, 'Desktop/claw-world-interior-sheets/furniture_raw.png');
const OUTPUT_DIR = path.join(__dirname, '../client/assets/sprites/interior');

async function findSpriteBounds(imagePath) {
    const { data, info } = await sharp(imagePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const { width, height, channels } = info;
    const sprites = [];
    const visited = new Set();
    
    // More aggressive flood fill - 8-connected instead of 4-connected
    function floodFill(startX, startY) {
        const stack = [[startX, startY]];
        let minX = startX, maxX = startX, minY = startY, maxY = startY;
        let pixelCount = 0;
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key)) continue;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            
            const idx = (y * width + x) * channels;
            const alpha = data[idx + 3];
            
            if (alpha < 5) continue; // Lower threshold
            
            visited.add(key);
            pixelCount++;
            
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            
            // 8-connected neighbors
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx !== 0 || dy !== 0) {
                        stack.push([x + dx, y + dy]);
                    }
                }
            }
        }
        
        return { minX, maxX, minY, maxY, pixelCount };
    }
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            
            const idx = (y * width + x) * channels;
            const alpha = data[idx + 3];
            
            if (alpha >= 5) {
                const bounds = floodFill(x, y);
                const w = bounds.maxX - bounds.minX + 1;
                const h = bounds.maxY - bounds.minY + 1;
                
                // Include smaller items too
                if (bounds.pixelCount >= 50 && w >= 8 && h >= 8) {
                    sprites.push({
                        x: bounds.minX,
                        y: bounds.minY,
                        width: w,
                        height: h,
                        area: bounds.pixelCount
                    });
                }
            }
        }
    }
    
    sprites.sort((a, b) => {
        const rowA = Math.floor(a.y / 100);
        const rowB = Math.floor(b.y / 100);
        if (rowA !== rowB) return rowA - rowB;
        return a.x - b.x;
    });
    
    return sprites;
}

async function main() {
    console.log('=== Re-extracting Furniture (v2) ===\n');
    
    const sprites = await findSpriteBounds(SOURCE_FILE);
    console.log(`Found ${sprites.length} furniture pieces\n`);
    
    // Show all found items with positions
    for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i];
        console.log(`#${i+1}: pos(${s.x},${s.y}) size(${s.width}x${s.height}) area=${s.area}`);
    }
    
    // Extract items we might have missed - focus on larger items
    const missedItems = sprites.filter(s => s.width > 100 || s.height > 100);
    console.log(`\nLarge items (potential bed): ${missedItems.length}`);
    
    for (let i = 0; i < missedItems.length; i++) {
        const sprite = missedItems[i];
        const padding = 2;
        
        const x = Math.max(0, sprite.x - padding);
        const y = Math.max(0, sprite.y - padding);
        const w = sprite.width + padding * 2;
        const h = sprite.height + padding * 2;
        
        // Scale to game size
        const scale = Math.min(32 / Math.max(w, h), 1);
        const finalW = Math.round(w * scale);
        const finalH = Math.round(h * scale);
        
        const outputName = `new_item_${i + 1}.png`;
        const outputPath = path.join(OUTPUT_DIR, outputName);
        
        await sharp(SOURCE_FILE)
            .extract({ left: x, top: y, width: w, height: h })
            .resize(finalW, finalH, { kernel: 'nearest' })
            .png()
            .toFile(outputPath);
        
        console.log(`✓ ${outputName} (${finalW}x${finalH}) from (${sprite.x},${sprite.y})`);
    }
}

main().catch(console.error);
