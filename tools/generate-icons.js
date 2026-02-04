const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Simple pixel art lobster design (16x16 base, will scale up)
const lobsterPixels = [
    '................',
    '..RR........RR..',
    '.RRRR......RRRR.',
    '..RR........RR..',
    '...RR......RR...',
    '....RRRRRRRR....',
    '...RRRRRRRRRR...',
    '..RROORRRROORR..',
    '..RRRRRRRRRRRR..',
    '...RRRRRRRRRR...',
    '....RRRRRRRR....',
    '...RR..RR..RR...',
    '..RR...RR...RR..',
    '.RR....RR....RR.',
    '................',
    '................',
];

const colors = {
    'R': '#E53935', // Red lobster
    'O': '#FFFFFF', // White eyes
    '.': null       // Transparent
};

function drawPixelArt(ctx, pixels, scale, offsetX = 0, offsetY = 0) {
    pixels.forEach((row, y) => {
        [...row].forEach((pixel, x) => {
            const color = colors[pixel];
            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(
                    offsetX + x * scale,
                    offsetY + y * scale,
                    scale,
                    scale
                );
            }
        });
    });
}

function generateIcon(size, filename) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background - ocean blue gradient feel
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(0, 0, size, size);
    
    // Add subtle water pattern
    ctx.fillStyle = '#2d4a6f';
    for (let i = 0; i < size; i += size/8) {
        ctx.fillRect(0, i, size, size/16);
    }
    
    // Calculate scale to fit lobster with padding
    const padding = size * 0.1;
    const availableSize = size - (padding * 2);
    const scale = Math.floor(availableSize / 16);
    const offsetX = Math.floor((size - 16 * scale) / 2);
    const offsetY = Math.floor((size - 16 * scale) / 2);
    
    // Draw lobster
    drawPixelArt(ctx, lobsterPixels, scale, offsetX, offsetY);
    
    // Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`✅ Generated ${filename} (${size}x${size})`);
}

// Generate icons
const clientPath = path.join(__dirname, '..', 'client');

// Favicon (32x32)
generateIcon(32, path.join(clientPath, 'favicon.png'));

// Apple touch icon (180x180)
generateIcon(180, path.join(clientPath, 'apple-touch-icon.png'));

// Also generate a 192x192 for Android PWA
generateIcon(192, path.join(clientPath, 'icon-192.png'));

// And 512x512 for high-res
generateIcon(512, path.join(clientPath, 'icon-512.png'));

console.log('🦞 All icons generated!');
