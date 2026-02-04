#!/usr/bin/env node
const fs = require('fs');
const { createCanvas } = require('canvas');

// Create debug tileset with numbers
const tileSize = 16;
const canvas = createCanvas(tileSize * 4, tileSize * 4);
const ctx = canvas.getContext('2d');

// Background colors to distinguish tiles
const colors = [
    '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1',
    '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE',
    '#85C1E2', '#F8B739', '#52BE80', '#EC7063',
    '#AF7AC5', '#5DADE2', '#F5B041', '#48C9B0'
];

ctx.font = 'bold 10px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

for (let i = 0; i < 16; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = col * tileSize;
    const y = row * tileSize;
    
    // Fill with color
    ctx.fillStyle = colors[i];
    ctx.fillRect(x, y, tileSize, tileSize);
    
    // Draw border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, tileSize, tileSize);
    
    // Draw number
    ctx.fillStyle = '#000';
    ctx.fillText(i.toString(), x + tileSize/2, y + tileSize/2);
}

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('client/assets/sprites/tiles/debug_tileset.png', buffer);
console.log('✅ Created debug_tileset.png with numbered tiles 0-15');
