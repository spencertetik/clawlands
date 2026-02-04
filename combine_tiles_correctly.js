#!/usr/bin/env node
/**
 * Combine tile PNGs into sprite sheet in CORRECT tile ID order
 */

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function combineTilesCorrectly() {
    const tilesDir = 'client/assets/sprites/tiles';
    const jsonPath = 'tileset_sand_water.json';

    console.log('🏖️ Combining sand/water tileset in correct order...');

    try {
        // Read JSON to get tile order
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const tiles = jsonData.tileset.tiles;

        // Sort tiles by ID (0-15)
        tiles.sort((a, b) => parseInt(a.id) - parseInt(b.id));

        console.log('Tile order:', tiles.map(t => t.id).join(', '));

        // Load images in ID order
        const images = [];
        for (let i = 0; i < 16; i++) {
            const imgPath = `${tilesDir}/sand_water_tile_${i}.png`;
            if (fs.existsSync(imgPath)) {
                const img = await loadImage(imgPath);
                images.push(img);
                console.log(`Loaded tile ${i}: ${tiles[i].corners.NW},${tiles[i].corners.NE},${tiles[i].corners.SW},${tiles[i].corners.SE}`);
            } else {
                console.error(`❌ Missing tile ${i}`);
            }
        }

        if (images.length !== 16) {
            console.error(`❌ Expected 16 tiles, found ${images.length}!`);
            return;
        }

        // Create sprite sheet canvas (4x4 grid)
        const tileSize = 16;
        const columns = 4;
        const rows = 4;
        const canvas = createCanvas(tileSize * columns, tileSize * rows);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Draw each tile in grid position (ID order: 0, 1, 2, 3 on row 0, etc.)
        for (let i = 0; i < images.length; i++) {
            const col = i % columns;
            const row = Math.floor(i / columns);
            ctx.drawImage(images[i], col * tileSize, row * tileSize);
            console.log(`Tile ${i} -> grid position (${col}, ${row})`);
        }

        // Save combined image
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(`${tilesDir}/sand_water_tileset.png`, buffer);

        console.log(`✅ Created sand_water_tileset.png (${canvas.width}x${canvas.height})`);
        console.log(`   Tiles arranged by ID: 0-3 (row 0), 4-7 (row 1), 8-11 (row 2), 12-15 (row 3)`);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

combineTilesCorrectly();
