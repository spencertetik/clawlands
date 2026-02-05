const sharp = require('sharp');
const path = require('path');

async function processSprite(inputPath, outputPath, options = {}) {
    const { left = 0, top = 0, width, height, resizeWidth, resizeHeight } = options;
    
    let image = sharp(inputPath);
    
    // Get metadata to know original size
    const metadata = await image.metadata();
    console.log(`Original size: ${metadata.width}x${metadata.height}`);
    
    // Extract region if specified
    if (width && height) {
        image = image.extract({ left, top, width, height });
        console.log(`Extracted region: ${left},${top} ${width}x${height}`);
    }
    
    // Resize if specified
    if (resizeWidth || resizeHeight) {
        image = image.resize(resizeWidth, resizeHeight, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
        console.log(`Resized to: ${resizeWidth}x${resizeHeight}`);
    }
    
    await image.png().toFile(outputPath);
    console.log(`Saved to: ${outputPath}`);
}

// Process based on command line args
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node process-sprite.js input.png output.png [left top width height] [resizeW resizeH]');
    process.exit(1);
}

const [input, output, ...rest] = args;
const options = {};

if (rest.length >= 4) {
    options.left = parseInt(rest[0]);
    options.top = parseInt(rest[1]);
    options.width = parseInt(rest[2]);
    options.height = parseInt(rest[3]);
}

if (rest.length >= 6) {
    options.resizeWidth = parseInt(rest[4]);
    options.resizeHeight = parseInt(rest[5]);
}

processSprite(input, output, options).catch(console.error);
