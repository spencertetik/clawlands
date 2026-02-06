const sharp = require('sharp');
const path = require('path');

const DECORATIONS_DIR = path.join(__dirname, '../client/assets/sprites/decorations');

async function sampleCorners(imagePath) {
    const { data, info } = await sharp(imagePath)
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const { width, height, channels } = info;
    
    // Sample corners and edges
    const positions = [
        { name: 'top-left', x: 0, y: 0 },
        { name: 'top-right', x: width - 1, y: 0 },
        { name: 'bottom-left', x: 0, y: height - 1 },
        { name: 'bottom-right', x: width - 1, y: height - 1 },
        { name: 'center', x: Math.floor(width / 2), y: Math.floor(height / 2) },
        // Sample some checkered pattern points
        { name: 'checker-1', x: 50, y: 50 },
        { name: 'checker-2', x: 51, y: 50 },
        { name: 'checker-3', x: 50, y: 51 },
        { name: 'checker-4', x: 100, y: 100 },
        { name: 'checker-5', x: 101, y: 100 },
    ];
    
    console.log(`\nSampling: ${path.basename(imagePath)} (${width}x${height}, ${channels} channels)`);
    console.log('─'.repeat(50));
    
    for (const pos of positions) {
        const idx = (pos.y * width + pos.x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        console.log(`${pos.name.padEnd(15)}: rgb(${r}, ${g}, ${b}) - #${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`);
    }
}

async function main() {
    const files = [
        path.join(DECORATIONS_DIR, 'bushes_raw.png'),
        path.join(DECORATIONS_DIR, 'rocks_raw.png'),
        path.join(DECORATIONS_DIR, 'ocean_decor_sheet.png'),
    ];
    
    for (const file of files) {
        await sampleCorners(file);
    }
}

main().catch(console.error);
