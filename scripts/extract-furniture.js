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
            
            if (alpha < 10) continue;
            
            visited.add(key);
            pixelCount++;
            
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        
        return { minX, maxX, minY, maxY, pixelCount };
    }
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            
            const idx = (y * width + x) * channels;
            const alpha = data[idx + 3];
            
            if (alpha >= 10) {
                const bounds = floodFill(x, y);
                const w = bounds.maxX - bounds.minX + 1;
                const h = bounds.maxY - bounds.minY + 1;
                
                if (bounds.pixelCount >= 100 && w >= 10 && h >= 10) {
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
        const rowA = Math.floor(a.y / 120);
        const rowB = Math.floor(b.y / 120);
        if (rowA !== rowB) return rowA - rowB;
        return a.x - b.x;
    });
    
    return sprites;
}

async function main() {
    console.log('=== Extracting Furniture Sprites ===\n');
    
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    const sprites = await findSpriteBounds(SOURCE_FILE);
    console.log(`Found ${sprites.length} furniture pieces\n`);
    
    for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        const padding = 2;
        
        const x = Math.max(0, sprite.x - padding);
        const y = Math.max(0, sprite.y - padding);
        const w = sprite.width + padding * 2;
        const h = sprite.height + padding * 2;
        
        // Scale down to game size (target ~24-32px for most items)
        const maxDim = Math.max(w, h);
        const targetSize = maxDim > 200 ? 32 : (maxDim > 100 ? 28 : 24);
        const scale = Math.min(targetSize / Math.max(w, h), 1);
        const finalW = Math.round(w * scale);
        const finalH = Math.round(h * scale);
        
        const outputName = `furniture_${i + 1}.png`;
        const outputPath = path.join(OUTPUT_DIR, outputName);
        
        try {
            await sharp(SOURCE_FILE)
                .extract({ left: x, top: y, width: w, height: h })
                .resize(finalW, finalH, { kernel: 'nearest' })
                .png()
                .toFile(outputPath);
            
            console.log(`✓ ${outputName} (${finalW}x${finalH})`);
        } catch (err) {
            console.log(`✗ Failed: ${outputName} - ${err.message}`);
        }
    }
    
    console.log('\n=== Done ===');
}

main().catch(console.error);
