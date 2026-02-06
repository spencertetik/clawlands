const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DECORATIONS_DIR = path.join(__dirname, '../client/assets/sprites/decorations');

// Ensure output directory exists
if (!fs.existsSync(DECORATIONS_DIR)) {
    fs.mkdirSync(DECORATIONS_DIR, { recursive: true });
}

// Sprite extraction definitions for 1024x1024 sheets
// Coordinates estimated from visual inspection
const extractionJobs = [
    {
        source: path.join(DECORATIONS_DIR, 'rocks_raw.png'),
        removeBackground: true, // Has gray/black backgrounds
        extractions: [
            // Left panel - shells (gray background ~x:0-190)
            { name: 'shell_pink', x: 15, y: 65, width: 80, height: 65, outputWidth: 14, outputHeight: 12 },
            { name: 'shell_striped', x: 110, y: 65, width: 75, height: 65, outputWidth: 12, outputHeight: 10 },
            { name: 'shell_white', x: 15, y: 390, width: 85, height: 70, outputWidth: 14, outputHeight: 12 },
            { name: 'shell_spiral', x: 20, y: 540, width: 75, height: 75, outputWidth: 12, outputHeight: 12 },
            { name: 'shell_spiral2', x: 110, y: 550, width: 65, height: 65, outputWidth: 10, outputHeight: 10 },
            
            // Middle panel - rocks (~x:190-420)
            { name: 'rock_gray', x: 210, y: 70, width: 90, height: 65, outputWidth: 16, outputHeight: 12 },
            { name: 'rock_gray2', x: 320, y: 75, width: 85, height: 60, outputWidth: 14, outputHeight: 10 },
            { name: 'rock_smooth', x: 210, y: 160, width: 90, height: 70, outputWidth: 16, outputHeight: 12 },
            
            // Right panel - shells, starfish, coral (black background ~x:420+)
            { name: 'shell_red', x: 435, y: 60, width: 95, height: 75, outputWidth: 16, outputHeight: 12 },
            { name: 'shell_peach', x: 545, y: 60, width: 95, height: 75, outputWidth: 16, outputHeight: 12 },
            
            // Starfish (right side)
            { name: 'starfish', x: 660, y: 65, width: 85, height: 85, outputWidth: 14, outputHeight: 14 },
            { name: 'starfish_orange', x: 660, y: 165, width: 85, height: 85, outputWidth: 14, outputHeight: 14 },
            { name: 'starfish_pink', x: 770, y: 65, width: 85, height: 85, outputWidth: 14, outputHeight: 14 },
            
            // Driftwood 
            { name: 'driftwood', x: 665, y: 365, width: 90, height: 40, outputWidth: 16, outputHeight: 8 },
            { name: 'driftwood2', x: 785, y: 375, width: 85, height: 35, outputWidth: 14, outputHeight: 6 },
            
            // Coral (bottom right)
            { name: 'coral', x: 550, y: 565, width: 75, height: 80, outputWidth: 12, outputHeight: 14 },
            { name: 'coral_pink', x: 660, y: 565, width: 75, height: 80, outputWidth: 12, outputHeight: 14 },
            
            // Seagrass (bottom left)
            { name: 'seagrass', x: 110, y: 670, width: 95, height: 60, outputWidth: 18, outputHeight: 12 },
        ]
    },
    {
        source: path.join(DECORATIONS_DIR, 'bushes_raw.png'),
        removeBackground: true, // Has blue checkered background
        extractions: [
            // Row 2 - bushes and ferns
            { name: 'bush_green', x: 120, y: 190, width: 100, height: 95, outputWidth: 18, outputHeight: 16 },
            { name: 'fern', x: 340, y: 190, width: 100, height: 95, outputWidth: 18, outputHeight: 16 },
            { name: 'fern2', x: 450, y: 190, width: 100, height: 95, outputWidth: 18, outputHeight: 16 },
            { name: 'bush_flower', x: 660, y: 190, width: 110, height: 90, outputWidth: 20, outputHeight: 16 },
            
            // Row 3 - more bushes
            { name: 'bush_round', x: 20, y: 300, width: 90, height: 85, outputWidth: 16, outputHeight: 14 },
            { name: 'bush_flower2', x: 235, y: 415, width: 130, height: 110, outputWidth: 22, outputHeight: 18 },
            
            // Row 4 - tall grass and seagrass
            { name: 'seagrass_tall', x: 750, y: 300, width: 115, height: 120, outputWidth: 20, outputHeight: 22 },
            
            // Row 5 - tropical plants
            { name: 'flower_stem', x: 120, y: 540, width: 95, height: 140, outputWidth: 16, outputHeight: 24 },
            { name: 'grass_tall', x: 240, y: 550, width: 100, height: 130, outputWidth: 18, outputHeight: 22 },
            { name: 'tropical_plant', x: 870, y: 540, width: 130, height: 140, outputWidth: 22, outputHeight: 24 },
        ]
    },
    {
        source: path.join(DECORATIONS_DIR, 'ocean_decor_sheet.png'),
        removeBackground: true, // Has checkered background
        extractions: [
            // Row 1 - chests, lobsters, sign
            { name: 'treasure_chest', x: 35, y: 30, width: 140, height: 110, outputWidth: 22, outputHeight: 18 },
            { name: 'treasure_chest2', x: 195, y: 30, width: 140, height: 115, outputWidth: 22, outputHeight: 18 },
            { name: 'lobster_statue', x: 440, y: 25, width: 125, height: 145, outputWidth: 20, outputHeight: 24 },
            { name: 'lobster_statue2', x: 585, y: 25, width: 125, height: 145, outputWidth: 20, outputHeight: 24 },
            { name: 'wooden_sign', x: 785, y: 45, width: 135, height: 95, outputWidth: 20, outputHeight: 14 },
            
            // Row 2 - more chests, bottles, anchor, campfire, net
            { name: 'treasure_chest_gold', x: 30, y: 245, width: 115, height: 100, outputWidth: 18, outputHeight: 16 },
            { name: 'potion_blue', x: 165, y: 245, width: 90, height: 110, outputWidth: 14, outputHeight: 18 },
            { name: 'anchor', x: 350, y: 250, width: 75, height: 120, outputWidth: 12, outputHeight: 20 },
            { name: 'campfire', x: 465, y: 260, width: 95, height: 110, outputWidth: 16, outputHeight: 18 },
            { name: 'fishing_net', x: 620, y: 255, width: 115, height: 115, outputWidth: 20, outputHeight: 20 },
            
            // Row 3 - bottles
            { name: 'message_bottle', x: 35, y: 385, width: 85, height: 110, outputWidth: 12, outputHeight: 16 },
            { name: 'potion_blue2', x: 135, y: 385, width: 85, height: 115, outputWidth: 12, outputHeight: 18 },
            
            // Row 4 - scrolls, nets, etc
            { name: 'scroll', x: 30, y: 540, width: 85, height: 105, outputWidth: 12, outputHeight: 16 },
            { name: 'fishing_boat', x: 340, y: 525, width: 130, height: 100, outputWidth: 22, outputHeight: 18 },
            
            // Campfire variant
            { name: 'campfire2', x: 870, y: 535, width: 110, height: 120, outputWidth: 18, outputHeight: 20 },
            
            // Buoy
            { name: 'buoy', x: 780, y: 385, width: 100, height: 125, outputWidth: 16, outputHeight: 20 },
        ]
    },
    {
        source: path.join(DECORATIONS_DIR, 'palm_tree_raw.png'),
        removeBackground: true,
        extractions: [
            // Palm trees from the sheet
            { name: 'palm_tree', x: 80, y: 40, width: 180, height: 380, outputWidth: 24, outputHeight: 48 },
            { name: 'palm_tree2', x: 330, y: 40, width: 180, height: 380, outputWidth: 24, outputHeight: 48 },
            { name: 'palm_tree3', x: 580, y: 40, width: 180, height: 380, outputWidth: 24, outputHeight: 48 },
        ]
    }
];

async function extractSprite(sourcePath, extraction, removeBackground = false) {
    const { name, x, y, width, height, outputWidth, outputHeight } = extraction;
    const outputPath = path.join(DECORATIONS_DIR, `${name}.png`);
    
    try {
        let pipeline = sharp(sourcePath)
            .extract({ left: x, top: y, width, height });
        
        // Resize with nearest neighbor for pixel art
        pipeline = pipeline.resize(outputWidth, outputHeight, {
            fit: 'fill',
            kernel: 'nearest'
        });
        
        // Ensure PNG with alpha
        pipeline = pipeline.png({ compressionLevel: 9 });
        
        await pipeline.toFile(outputPath);
        
        console.log(`✓ ${name} (${outputWidth}x${outputHeight})`);
        return true;
    } catch (err) {
        console.error(`✗ ${name}: ${err.message}`);
        return false;
    }
}

async function main() {
    console.log('🎨 Extracting sprites from raw sheets...\n');
    
    let success = 0;
    let failed = 0;
    
    for (const job of extractionJobs) {
        console.log(`\n📁 ${path.basename(job.source)}`);
        console.log('─'.repeat(40));
        
        // Check if source exists
        if (!fs.existsSync(job.source)) {
            console.log(`  ⚠️ Source not found, skipping`);
            continue;
        }
        
        for (const extraction of job.extractions) {
            const result = await extractSprite(job.source, extraction, job.removeBackground);
            if (result) success++;
            else failed++;
        }
    }
    
    console.log(`\n${'═'.repeat(40)}`);
    console.log(`✅ Extracted: ${success} sprites`);
    if (failed > 0) console.log(`❌ Failed: ${failed} sprites`);
}

main().catch(console.error);
