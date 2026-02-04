#!/usr/bin/env node
/**
 * Analyze the PixelLab tileset JSON to create proper corner-to-tile mapping
 */

const fs = require('fs');

const json = JSON.parse(fs.readFileSync('tileset_sand_water.json', 'utf8'));

console.log('📊 PixelLab Wang Tileset Analysis\n');
console.log('Terrain types:', json.tileset.terrain_types); // ["lower", "upper"]
console.log('Terrain prompts:', json.metadata.terrain_prompts); // lower=sandy beach, upper=ocean water
console.log('\n🎯 Corner Pattern Mapping:\n');

// Build mapping: corner pattern → tile ID
const mapping = {};

json.tileset.tiles.forEach(tile => {
    const id = tile.id;
    const corners = tile.corners;

    // Create corner key in format: NW,NE,SW,SE
    const key = `${corners.NW},${corners.NE},${corners.SW},${corners.SE}`;

    mapping[key] = id;

    console.log(`Tile ${id.padStart(2, ' ')}: ${key}`);
});

console.log('\n🔄 Inverted for AutoTiler (sand=lower, water=upper in VISUALS):');
console.log('Since visuals are inverted from JSON labels, we need to swap:');
console.log('- JSON "lower" (sandy beach) → visually shows WATER');
console.log('- JSON "upper" (ocean water) → visually shows SAND\n');

// Generate AutoTiler mapping
console.log('this.cornerToTile = {');
Object.entries(mapping).forEach(([pattern, tileId]) => {
    console.log(`    '${pattern}': ${tileId},`);
});
console.log('};');
