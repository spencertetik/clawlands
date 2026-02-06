const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const RAW_DIR = path.join(__dirname, '..', 'client', 'assets', 'sprites', 'items', 'raw');
const OUT_DIR = path.join(__dirname, '..', 'client', 'assets', 'sprites', 'items');

const FILES = [
  'driftwood.png', 'sea_glass.png', 'pearl.png', 'coral_fragment.png',
  'iron_nugget.png', 'ancient_shell.png', 'kelp_wrap.png', 'coconut.png',
  'golden_doubloon.png', 'old_map.png', 'lighthouse_key.png', 'glowing_scale.png'
];

async function removeWhiteBackground(inputPath) {
  const image = sharp(inputPath).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  const channels = info.channels; // should be 4 (RGBA)

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Pure white / very near white — fully transparent
    if (r > 240 && g > 240 && b > 240) {
      pixels[i + 3] = 0;
    }
    // Near-white — graduated transparency
    else if (r > 230 && g > 230 && b > 230) {
      // Linear fade: at 231 → mostly opaque, at 240 → mostly transparent
      const minVal = Math.min(r, g, b);
      const fade = (minVal - 230) / 10; // 0..1 range where 1 = more white
      pixels[i + 3] = Math.round(255 * (1 - fade));
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels }
  }).png();
}

async function processFile(filename) {
  const inputPath = path.join(RAW_DIR, filename);
  const outputPath = path.join(OUT_DIR, filename);

  try {
    // Step 1: Remove white background
    const cleaned = await removeWhiteBackground(inputPath);

    // Step 2: Trim transparent edges, then resize to 32x32
    const trimmed = await cleaned.trim().toBuffer();

    // Step 3: Resize to 32x32 with nearest-neighbor for pixel art
    await sharp(trimmed)
      .resize(32, 32, {
        fit: 'contain',
        kernel: 'nearest',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);

    const stat = fs.statSync(outputPath);
    console.log(`✓ ${filename} → ${stat.size} bytes`);
  } catch (err) {
    console.error(`✗ ${filename}: ${err.message}`);
  }
}

async function main() {
  // Ensure output dir exists
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Processing ${FILES.length} sprites...`);
  console.log(`  Input:  ${RAW_DIR}`);
  console.log(`  Output: ${OUT_DIR}\n`);

  for (const file of FILES) {
    await processFile(file);
  }

  console.log('\nDone!');
}

main().catch(console.error);
