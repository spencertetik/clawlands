#!/usr/bin/env node
/*
 * Build a tileset sprite sheet (and numbered debug sheet) from a PixelLab JSON file.
 *
 * Usage:
 *   node tools/build_tileset_from_json.js <tileset_json> <out_name> [--split] [--columns <n>]
 *
 * Example:
 *   node tools/build_tileset_from_json.js tileset_sand_water.json sand_water
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('Usage: node tools/build_tileset_from_json.js <tileset_json> <out_name> [--split] [--columns <n>]');
    process.exit(1);
}

const jsonPath = args[0];
const outName = args[1];
const splitTiles = args.includes('--split');

let columnsArg = null;
const columnsIndex = args.indexOf('--columns');
if (columnsIndex !== -1 && args[columnsIndex + 1]) {
    const parsed = parseInt(args[columnsIndex + 1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
        columnsArg = parsed;
    }
}

const outputDir = path.join('client', 'assets', 'sprites', 'tiles');
const infoPath = path.join(outputDir, 'tileset_info.json');

function getDefaultColumns(totalTiles) {
    const root = Math.round(Math.sqrt(totalTiles));
    if (root * root === totalTiles) return root;
    return Math.min(4, totalTiles);
}

async function buildTileset() {
    if (!fs.existsSync(jsonPath)) {
        console.error(`❌ JSON not found: ${jsonPath}`);
        process.exit(1);
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const tiles = (jsonData.tileset && jsonData.tileset.tiles) || [];
    const tileSize = (jsonData.tileset && jsonData.tileset.tile_size) || { width: 16, height: 16 };

    if (tiles.length === 0) {
        console.error('❌ No tiles found in JSON.');
        process.exit(1);
    }

    // Sort tiles by numeric ID
    const sortedTiles = [...tiles].sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

    const totalTiles = sortedTiles.length;
    const columns = columnsArg || getDefaultColumns(totalTiles);
    const rows = Math.ceil(totalTiles / columns);

    const sheetWidth = columns * tileSize.width;
    const sheetHeight = rows * tileSize.height;

    const canvas = createCanvas(sheetWidth, sheetHeight);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Draw tiles in ID order
    for (let i = 0; i < sortedTiles.length; i++) {
        const tile = sortedTiles[i];
        const dataUrl = `data:image/png;base64,${tile.image.base64}`;
        const img = await loadImage(dataUrl);

        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = col * tileSize.width;
        const y = row * tileSize.height;

        ctx.drawImage(img, x, y);

        if (splitTiles) {
            const splitCanvas = createCanvas(tileSize.width, tileSize.height);
            const splitCtx = splitCanvas.getContext('2d');
            splitCtx.imageSmoothingEnabled = false;
            splitCtx.drawImage(img, 0, 0);
            const splitBuffer = splitCanvas.toBuffer('image/png');
            fs.writeFileSync(path.join(outputDir, `${outName}_tile_${tile.id}.png`), splitBuffer);
        }
    }

    const outPath = path.join(outputDir, `${outName}_tileset.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log(`✅ Created ${outPath} (${sheetWidth}x${sheetHeight})`);

    // Create numbered debug tileset
    const numbered = createCanvas(sheetWidth, sheetHeight);
    const nctx = numbered.getContext('2d');
    nctx.imageSmoothingEnabled = false;
    nctx.drawImage(canvas, 0, 0);

    nctx.font = 'bold 10px monospace';
    nctx.textAlign = 'center';
    nctx.textBaseline = 'middle';

    for (let i = 0; i < totalTiles; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = col * tileSize.width;
        const y = row * tileSize.height;

        nctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        nctx.fillRect(x + 2, y + 2, tileSize.width - 4, tileSize.height - 4);

        nctx.fillStyle = '#000';
        nctx.fillText(i.toString(), x + tileSize.width / 2, y + tileSize.height / 2);
    }

    const numberedPath = path.join(outputDir, `numbered_${outName}_tileset.png`);
    fs.writeFileSync(numberedPath, numbered.toBuffer('image/png'));
    console.log(`✅ Created ${numberedPath}`);

    // Update tileset_info.json
    let info = {};
    if (fs.existsSync(infoPath)) {
        try {
            info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        } catch (err) {
            console.warn(`⚠️  Failed to parse tileset_info.json, rewriting: ${err.message}`);
            info = {};
        }
    }

    info[outName] = {
        tile_count: totalTiles,
        tile_size: {
            width: tileSize.width,
            height: tileSize.height
        },
        columns,
        rows
    };

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
    console.log(`✅ Updated ${infoPath}`);
}

buildTileset().catch(err => {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
});
