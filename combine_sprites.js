#!/usr/bin/env node
/**
 * Simple sprite combiner using Canvas API
 * Combines 4 character direction sprites into a single sprite sheet
 */

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function combineSprites() {
    const charDir = 'client/assets/sprites/characters';
    const directions = ['south', 'north', 'west', 'east'];

    console.log('🎨 Combining character sprites...');

    try {
        // Load all direction images
        const images = [];
        for (const dir of directions) {
            const imgPath = `${charDir}/${dir}.png`;
            if (fs.existsSync(imgPath)) {
                const img = await loadImage(imgPath);
                images.push(img);
                console.log(`✅ Loaded ${dir}.png (${img.width}x${img.height})`);
            }
        }

        if (images.length === 0) {
            console.error('❌ No images found!');
            return;
        }

        // Create sprite sheet canvas
        const charWidth = images[0].width;
        const charHeight = images[0].height;
        const canvas = createCanvas(charWidth * 4, charHeight);
        const ctx = canvas.getContext('2d');

        // Draw each image side by side
        for (let i = 0; i < images.length; i++) {
            ctx.drawImage(images[i], i * charWidth, 0);
        }

        // Save combined image
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(`${charDir}/lobster_character.png`, buffer);

        console.log(`✅ Saved lobster_character.png (${canvas.width}x${canvas.height})`);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

combineSprites();
