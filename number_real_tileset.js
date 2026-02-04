#!/usr/bin/env node
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function numberRealTileset() {
    const tilesDir = 'client/assets/sprites/tiles';
    
    // Load the actual PixelLab tileset
    const tileset = await loadImage(`${tilesDir}/sand_water_tileset.png`);
    
    const tileSize = 16;
    const canvas = createCanvas(tileSize * 4, tileSize * 4);
    const ctx = canvas.getContext('2d');
    
    // Draw the original tileset
    ctx.drawImage(tileset, 0, 0);
    
    // Add numbers on top
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < 16; i++) {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = col * tileSize;
        const y = row * tileSize;
        
        // Draw white background for number
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(x + 2, y + 2, 12, 12);
        
        // Draw number
        ctx.fillStyle = '#000';
        ctx.fillText(i.toString(), x + tileSize/2, y + 8);
    }
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(`${tilesDir}/numbered_sand_water_tileset.png`, buffer);
    console.log('✅ Created numbered_sand_water_tileset.png');
}

numberRealTileset().catch(err => console.error('Error:', err));
