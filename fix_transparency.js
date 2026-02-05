const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const decorDir = 'client/assets/sprites/decorations';

async function fixTransparency(filename) {
    const filepath = path.join(decorDir, filename);
    if (!fs.existsSync(filepath)) return;
    
    const img = await loadImage(filepath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    
    // Get the corner pixel color as the background color to remove
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    
    // Skip if already has transparency at corner
    if (data[3] === 0) {
        console.log(`  ${filename}: Already transparent`);
        return;
    }
    
    console.log(`  ${filename}: Removing bg color rgb(${bgR},${bgG},${bgB})`);
    
    // Make matching pixels transparent (with tolerance)
    const tolerance = 30;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (Math.abs(r - bgR) < tolerance && 
            Math.abs(g - bgG) < tolerance && 
            Math.abs(b - bgB) < tolerance) {
            data[i + 3] = 0; // Set alpha to 0
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
    console.log(`  ${filename}: Fixed!`);
}

async function main() {
    const sprites = [
        'palm_tree.png',
        'bush_green.png',
        'bush_flower.png',
        'seagrass.png',
        'fern.png',
        'shell_pink.png',
        'shell_spiral.png',
        'rock_gray.png',
        'starfish.png',
        'coral.png',
        'driftwood.png',
        'treasure_chest.png',
        'lobster_statue.png',
        'wooden_sign.png',
        'anchor.png',
        'campfire.png',
        'fishing_net.png',
        'message_bottle.png'
    ];
    
    console.log('Fixing sprite transparency...');
    for (const sprite of sprites) {
        await fixTransparency(sprite);
    }
    console.log('Done!');
}

main().catch(console.error);
