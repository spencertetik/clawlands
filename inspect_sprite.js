const { loadImage } = require('canvas');

async function inspect(file) {
    const img = await loadImage(file);
    const canvas = require('canvas').createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    
    // Check corners and edges for transparency
    console.log(`${file}: ${img.width}x${img.height}`);
    console.log(`  Top-left (0,0): rgba(${data[0]},${data[1]},${data[2]},${data[3]})`);
    
    // Check if any pixel is fully transparent
    let transparentCount = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) transparentCount++;
    }
    console.log(`  Transparent pixels: ${transparentCount}/${data.length/4}`);
}

inspect('client/assets/sprites/decorations/palm_tree.png');
