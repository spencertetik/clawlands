const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DECORATIONS_DIR = path.join(__dirname, '../client/assets/sprites/decorations');

// Background colors to make transparent (in RGB)
// These are the common checkered/solid background colors from DALL-E
const BACKGROUND_COLORS = [
    // Gray checkered pattern (light and dark)
    { r: 204, g: 204, b: 204, tolerance: 15 }, // Light gray
    { r: 153, g: 153, b: 153, tolerance: 15 }, // Medium gray
    { r: 128, g: 128, b: 128, tolerance: 15 }, // Gray
    { r: 102, g: 102, b: 102, tolerance: 15 }, // Dark gray
    { r: 75, g: 85, b: 99, tolerance: 20 },    // Slate gray (rocks sheet)
    { r: 51, g: 51, b: 51, tolerance: 15 },    // Darker gray
    { r: 0, g: 0, b: 0, tolerance: 10 },       // Black
    
    // Blue/teal checkered pattern (bushes sheet)
    { r: 100, g: 140, b: 150, tolerance: 25 }, // Teal-ish
    { r: 130, g: 160, b: 170, tolerance: 25 }, // Light teal
    { r: 160, g: 185, b: 190, tolerance: 25 }, // Lighter teal
    { r: 180, g: 200, b: 205, tolerance: 25 }, // Very light teal
];

// Check if a color should be made transparent
function isBackgroundColor(r, g, b) {
    for (const bg of BACKGROUND_COLORS) {
        if (Math.abs(r - bg.r) <= bg.tolerance &&
            Math.abs(g - bg.g) <= bg.tolerance &&
            Math.abs(b - bg.b) <= bg.tolerance) {
            return true;
        }
    }
    return false;
}

// Remove background from raw pixel data
async function removeBackground(buffer, width, height) {
    const pixels = new Uint8Array(width * height * 4); // RGBA output
    
    for (let i = 0; i < width * height; i++) {
        const srcIdx = i * 3; // RGB input
        const dstIdx = i * 4; // RGBA output
        
        const r = buffer[srcIdx];
        const g = buffer[srcIdx + 1];
        const b = buffer[srcIdx + 2];
        
        if (isBackgroundColor(r, g, b)) {
            // Make transparent
            pixels[dstIdx] = 0;
            pixels[dstIdx + 1] = 0;
            pixels[dstIdx + 2] = 0;
            pixels[dstIdx + 3] = 0;
        } else {
            // Keep the color
            pixels[dstIdx] = r;
            pixels[dstIdx + 1] = g;
            pixels[dstIdx + 2] = b;
            pixels[dstIdx + 3] = 255;
        }
    }
    
    return Buffer.from(pixels);
}

const extractionJobs = [
    {
        source: path.join(DECORATIONS_DIR, 'rocks_raw.png'),
        extractions: [
            // Shells
            { name: 'shell_pink', x: 15, y: 65, width: 80, height: 65, outputWidth: 14, outputHeight: 12 },
            { name: 'shell_spiral', x: 20, y: 540, width: 75, height: 75, outputWidth: 12, outputHeight: 12 },
            { name: 'shell_white', x: 15, y: 390, width: 85, height: 70, outputWidth: 14, outputHeight: 12 },
            
            // Rocks
            { name: 'rock_gray', x: 210, y: 70, width: 90, height: 65, outputWidth: 16, outputHeight: 12 },
            
            // Starfish
            { name: 'starfish', x: 660, y: 65, width: 85, height: 85, outputWidth: 14, outputHeight: 14 },
            { name: 'starfish_orange', x: 660, y: 165, width: 85, height: 85, outputWidth: 14, outputHeight: 14 },
            
            // Driftwood
            { name: 'driftwood', x: 665, y: 365, width: 90, height: 40, outputWidth: 16, outputHeight: 8 },
            
            // Coral
            { name: 'coral', x: 550, y: 565, width: 75, height: 80, outputWidth: 12, outputHeight: 14 },
            { name: 'coral_pink', x: 660, y: 565, width: 75, height: 80, outputWidth: 12, outputHeight: 14 },
            
            // Seagrass
            { name: 'seagrass', x: 110, y: 670, width: 95, height: 60, outputWidth: 18, outputHeight: 12 },
        ]
    },
    {
        source: path.join(DECORATIONS_DIR, 'bushes_raw.png'),
        extractions: [
            { name: 'bush_green', x: 120, y: 190, width: 100, height: 95, outputWidth: 18, outputHeight: 16 },
            { name: 'bush_flower', x: 660, y: 190, width: 110, height: 90, outputWidth: 20, outputHeight: 16 },
            { name: 'fern', x: 340, y: 190, width: 100, height: 95, outputWidth: 18, outputHeight: 16 },
            { name: 'seagrass_tall', x: 750, y: 300, width: 115, height: 120, outputWidth: 20, outputHeight: 22 },
        ]
    },
    {
        source: path.join(DECORATIONS_DIR, 'ocean_decor_sheet.png'),
        extractions: [
            { name: 'treasure_chest', x: 35, y: 30, width: 140, height: 110, outputWidth: 22, outputHeight: 18 },
            { name: 'lobster_statue', x: 440, y: 25, width: 125, height: 145, outputWidth: 20, outputHeight: 24 },
            { name: 'wooden_sign', x: 785, y: 45, width: 135, height: 95, outputWidth: 20, outputHeight: 14 },
            { name: 'anchor', x: 350, y: 250, width: 75, height: 120, outputWidth: 12, outputHeight: 20 },
            { name: 'campfire', x: 465, y: 260, width: 95, height: 110, outputWidth: 16, outputHeight: 18 },
            { name: 'fishing_net', x: 620, y: 255, width: 115, height: 115, outputWidth: 20, outputHeight: 20 },
            { name: 'message_bottle', x: 35, y: 385, width: 85, height: 110, outputWidth: 12, outputHeight: 16 },
        ]
    },
    {
        source: path.join(DECORATIONS_DIR, 'palm_tree_raw.png'),
        extractions: [
            { name: 'palm_tree', x: 80, y: 40, width: 180, height: 380, outputWidth: 24, outputHeight: 48 },
        ]
    }
];

async function extractSpriteClean(sourcePath, extraction) {
    const { name, x, y, width, height, outputWidth, outputHeight } = extraction;
    const outputPath = path.join(DECORATIONS_DIR, `${name}.png`);
    
    try {
        // Extract the region as raw RGB
        const { data, info } = await sharp(sourcePath)
            .extract({ left: x, top: y, width, height })
            .raw()
            .toBuffer({ resolveWithObject: true });
        
        // Remove background
        const rgbaData = await removeBackground(data, info.width, info.height);
        
        // Create new image with transparency and resize
        await sharp(rgbaData, {
            raw: {
                width: info.width,
                height: info.height,
                channels: 4
            }
        })
            .resize(outputWidth, outputHeight, {
                fit: 'fill',
                kernel: 'nearest'
            })
            .png({ compressionLevel: 9 })
            .toFile(outputPath);
        
        console.log(`✓ ${name} (${outputWidth}x${outputHeight})`);
        return true;
    } catch (err) {
        console.error(`✗ ${name}: ${err.message}`);
        return false;
    }
}

async function main() {
    console.log('🎨 Extracting sprites with background removal...\n');
    
    let success = 0;
    let failed = 0;
    
    for (const job of extractionJobs) {
        console.log(`\n📁 ${path.basename(job.source)}`);
        console.log('─'.repeat(40));
        
        if (!fs.existsSync(job.source)) {
            console.log(`  ⚠️ Source not found, skipping`);
            continue;
        }
        
        for (const extraction of job.extractions) {
            const result = await extractSpriteClean(job.source, extraction);
            if (result) success++;
            else failed++;
        }
    }
    
    console.log(`\n${'═'.repeat(40)}`);
    console.log(`✅ Extracted: ${success} sprites with transparency`);
    if (failed > 0) console.log(`❌ Failed: ${failed} sprites`);
}

main().catch(console.error);
