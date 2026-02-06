const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_DIR = path.join(process.env.HOME, 'Desktop/claw-world-raw-sheets');
const OUTPUT_DIR = path.join(__dirname, '../client/assets/sprites/decorations');

// Target sizes for game sprites
const SPRITE_CONFIGS = {
    // Palm trees - tall sprites
    palm: { maxWidth: 48, maxHeight: 96, minArea: 5000 },
    // Bushes/plants - medium sprites  
    bush: { maxWidth: 40, maxHeight: 40, minArea: 400 },
    // Small items - shells, starfish, etc
    small: { maxWidth: 30, maxHeight: 30, minArea: 100 },
    // Medium items - chests, statues
    medium: { maxWidth: 60, maxHeight: 60, minArea: 800 },
};

async function findSpriteBounds(imagePath) {
    const { data, info } = await sharp(imagePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const { width, height, channels } = info;
    const sprites = [];
    const visited = new Set();
    
    // Find connected regions of non-transparent pixels
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
            
            if (alpha < 10) continue; // Transparent
            
            visited.add(key);
            pixelCount++;
            
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            
            // Check neighbors (4-connected for speed)
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        
        return { minX, maxX, minY, maxY, pixelCount };
    }
    
    // Scan for sprite regions
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
                
                // Filter out tiny noise (less than 50 pixels)
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
    
    // Sort by position (top to bottom, left to right)
    sprites.sort((a, b) => {
        const rowA = Math.floor(a.y / 100);
        const rowB = Math.floor(b.y / 100);
        if (rowA !== rowB) return rowA - rowB;
        return a.x - b.x;
    });
    
    return sprites;
}

async function extractSprites(imagePath, outputPrefix, targetSize) {
    console.log(`\nProcessing: ${path.basename(imagePath)}`);
    
    const sprites = await findSpriteBounds(imagePath);
    console.log(`  Found ${sprites.length} sprite regions`);
    
    const extracted = [];
    
    for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        const padding = 2; // Add small padding
        
        const x = Math.max(0, sprite.x - padding);
        const y = Math.max(0, sprite.y - padding);
        const w = sprite.width + padding * 2;
        const h = sprite.height + padding * 2;
        
        // Calculate scale to fit target size
        const scale = Math.min(targetSize / w, targetSize / h, 1);
        const finalW = Math.round(w * scale);
        const finalH = Math.round(h * scale);
        
        const outputName = `${outputPrefix}_${i + 1}.png`;
        const outputPath = path.join(OUTPUT_DIR, outputName);
        
        try {
            await sharp(imagePath)
                .extract({ left: x, top: y, width: w, height: h })
                .resize(finalW, finalH, { kernel: 'nearest' })
                .png()
                .toFile(outputPath);
            
            extracted.push({ name: outputName, width: finalW, height: finalH });
            console.log(`  ✓ ${outputName} (${finalW}x${finalH})`);
        } catch (err) {
            console.log(`  ✗ Failed: ${outputName} - ${err.message}`);
        }
    }
    
    return extracted;
}

async function main() {
    console.log('=== Sprite Extraction from Clean Sheets ===\n');
    
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    const results = {};
    
    // Extract from each sheet with appropriate target sizes
    
    // Palm trees - keep them larger (48px target)
    results.palm = await extractSprites(
        path.join(SOURCE_DIR, 'palm_tree_raw.png'),
        'palm_tree',
        48
    );
    
    // Bushes - medium size (24px target)
    results.bushes = await extractSprites(
        path.join(SOURCE_DIR, 'bushes_raw.png'),
        'plant',
        24
    );
    
    // Rocks/shells/small items (20px target)
    results.rocks = await extractSprites(
        path.join(SOURCE_DIR, 'rocks_raw.png'),
        'beach',
        20
    );
    
    // Ocean decor - medium items (28px target)
    results.ocean = await extractSprites(
        path.join(SOURCE_DIR, 'ocean_decor_sheet.png'),
        'decor',
        28
    );
    
    // Copy the dirt path directly
    const pathSrc = path.join(SOURCE_DIR, 'path_raw.png');
    const pathDest = path.join(OUTPUT_DIR, 'dirt_path.png');
    
    // Resize path to 16x16 tile
    await sharp(pathSrc)
        .resize(16, 16, { kernel: 'nearest' })
        .png()
        .toFile(pathDest);
    console.log('\n✓ dirt_path.png (16x16)');
    
    // Summary
    console.log('\n=== Extraction Complete ===');
    let total = 1; // dirt_path
    for (const [sheet, sprites] of Object.entries(results)) {
        console.log(`${sheet}: ${sprites.length} sprites`);
        total += sprites.length;
    }
    console.log(`\nTotal: ${total} sprites extracted to ${OUTPUT_DIR}`);
}

main().catch(console.error);
