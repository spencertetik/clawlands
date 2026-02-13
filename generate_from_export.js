// Converts editor export JSON → EditorMapData.js
// Preserves exact format: arrays of objects, not grouped dicts
// Usage: node generate_from_export.js <path-to-export.json>

const fs = require('fs');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node generate_from_export.js <export.json>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const output = {
  buildings: data.buildings || [],
  decorations: data.decorations || [],
  editorPlaced: data.editorPlaced || [],
  deleted: data.deleted || [],
};

// Preserve terrain map from editor if present
if (data.terrainMap && data.terrainWidth && data.terrainHeight) {
  output.terrainMap = data.terrainMap;
  output.terrainWidth = data.terrainWidth;
  output.terrainHeight = data.terrainHeight;
  console.log(`Terrain map: ${data.terrainWidth}x${data.terrainHeight} (${data.terrainMap.length} cells)`);
}

console.log(`Buildings: ${output.buildings.length}`);
console.log(`Decorations: ${output.decorations.length}`);
console.log(`Editor-placed floor tiles: ${output.editorPlaced.length}`);
console.log(`Deleted: ${output.deleted.length}`);

const js = `// Editor map data generated from ${inputPath} on ${new Date().toISOString()}
const EDITOR_MAP_DATA = ${JSON.stringify(output, null, 2)};

if (typeof module !== "undefined" && module.exports) {
  module.exports = EDITOR_MAP_DATA;
}
`;

const outPath = 'client/js/data/EditorMapData.js';
fs.writeFileSync(outPath, js);
console.log(`Wrote ${outPath} (${(js.length / 1024).toFixed(1)} KB)`);
