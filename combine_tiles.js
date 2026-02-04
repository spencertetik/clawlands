#!/usr/bin/env node
/**
 * Combine individual tile PNGs into a single sprite sheet
 */

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function combineTiles() {
    const tilesDir = 'client/assets/sprites/tiles';

    console.log('🏖️ Combining sand/water tileset...');

    try {
        // Load all 16 tiles
        const images = [];
        for (let i = 0; i < 16; i++) {
            const imgPath = `${tilesDir}/sand_water_tile_${i}.png`;
            if (fs.existsSync(imgPath)) {
                const img = await loadImage(imgPath);
                images.push(img);
            }
        }

        if (images.length === 0) {
            console.error('❌ No tile images found!');
            return;
        }

        console.log(`✅ Loaded ${images.length} tiles`);

        // Create sprite sheet canvas (4x4 grid)
        const tileSize = 16;
        const columns = 4;
        const rows = 4;
        const canvas = createCanvas(tileSize * columns, tileSize * rows);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Draw each tile in grid position
        for (let i = 0; i < images.length; i++) {
            const col = i % columns;
            const row = Math.floor(i / columns);
            ctx.drawImage(images[i], col * tileSize, row * tileSize);
        }

        // Save combined image
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(`${tilesDir}/sand_water_tileset.png`, buffer);

        console.log(`✅ Created sand_water_tileset.png (${canvas.width}x${canvas.height})`);
        console.log(`   4x4 grid, ${tileSize}x${tileSize} tiles`);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

combineTiles();
