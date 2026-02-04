#!/usr/bin/env node
/**
 * Create walk animation frames from static character sprites
 * Generates 3 frames per direction (left leg forward, center, right leg forward)
 */

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function createWalkFrames() {
    const directions = ['south', 'north', 'east', 'west'];
    const spriteDir = 'client/assets/sprites/characters';

    for (const dir of directions) {
        console.log(`🚶 Creating walk frames for ${dir}...`);

        // Load the base sprite
        const basePath = `${spriteDir}/${dir}.png`;
        const baseImage = await loadImage(basePath);

        const width = baseImage.width;
        const height = baseImage.height;

        // Create a sprite sheet with 3 frames side by side
        const canvas = createCanvas(width * 3, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Frame 0: Left leg forward (shift lower half left by 1px)
        ctx.save();
        ctx.drawImage(baseImage, 0, 0, width, height * 0.6, 0, 0, width, height * 0.6);
        ctx.drawImage(baseImage, 0, height * 0.6, width, height * 0.4, -1, height * 0.6, width, height * 0.4);
        ctx.restore();

        // Frame 1: Center stance (original sprite)
        ctx.drawImage(baseImage, width, 0);

        // Frame 2: Right leg forward (shift lower half right by 1px)
        ctx.save();
        ctx.drawImage(baseImage, 0, 0, width, height * 0.6, width * 2, 0, width, height * 0.6);
        ctx.drawImage(baseImage, 0, height * 0.6, width, height * 0.4, width * 2 + 1, height * 0.6, width, height * 0.4);
        ctx.restore();

        // Save the animation sprite sheet
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(`${spriteDir}/${dir}_walk.png`, buffer);
        console.log(`  ✅ Created ${dir}_walk.png (${canvas.width}x${canvas.height})`);
    }

    console.log('✨ All walk animations created!');
}

createWalkFrames().catch(err => console.error('❌ Error:', err));
