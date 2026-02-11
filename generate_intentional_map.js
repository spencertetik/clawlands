// FireRed-style: straight main street, row buildings, tree fence borders

const fs = require('fs');
const TILE_SIZE = 16;

const placements = {};
const placed = new Set();

function getKey(x, y) { return `${x},${y}`; }
function addTile(type, x, y) {
  const key = getKey(x, y);
  if (placed.has(key)) return;
  placed.add(key);
  if (!placements[type]) placements[type] = [];
  placements[type].push([x * TILE_SIZE, y * TILE_SIZE]);
}

function placeLine(type, x1, y1, x2, y2) {
  let x = x1, y = y1;
  while (x !== x2 || y !== y2) {
    addTile(type, x, y);
    if (x !== x2) x += Math.sign(x2 - x);
    else y += Math.sign(y2 - y);
  }
  addTile(type, x2, y2);
}

// Island center
const cx = 85, cy = 74;

// === MAIN STREET (wide, straight, horizontal) ===
// Main east-west street through town (3 tiles wide)
const streetY = cy;
for (let x = cx - 12; x <= cx + 12; x++) {
  addTile('cobblestone_path', x, streetY - 1);  // top
  addTile('cobblestone_path', x, streetY);        // center
  addTile('cobblestone_path', x, streetY + 1);    // bottom
}

// === BUILDINGS IN ROWS ALONG THE STREET ===
// North side of street (facing south - doors on bottom)
const northBuildings = [
  { x: cx - 8, w: 4, type: 'house', name: 'Molt Manor' },      // West
  { x: cx - 2, w: 5, type: 'inn', name: 'The Salty Shell' }, // Center-left
  { x: cx + 5, w: 4, type: 'shop', name: 'Coral Cove' }     // Center-right
];

// South side of street (facing north - doors on top)
const southBuildings = [
  { x: cx - 6, w: 5, type: 'house', name: 'Pearl\'s Rest' },  // West
  { x: cx + 2, w: 4, type: 'house', name: 'Crab Cottage' },  // Center
  { x: cx + 8, w: 3, type: 'lighthouse', name: 'Beacon' }    // East
];

// Place north buildings with connections to street
northBuildings.forEach(b => {
  // Building platform (cleared area behind)
  for (let x = b.x; x < b.x + b.w; x++) {
    for (let y = streetY - 5; y <= streetY - 2; y++) {
      addTile('dirt_path', x, y);
    }
  }
  // Door connection to street (cobblestone doorstep)
  const doorX1 = b.x + Math.floor(b.w / 2);
  addTile('cobblestone_path', doorX1, streetY - 2);
});

// Place south buildings with connections
southBuildings.forEach(b => {
  // Building platform
  for (let x = b.x; x < b.x + b.w; x++) {
    for (let y = streetY + 2; y <= streetY + 5; y++) {
      addTile('dirt_path', x, y);
    }
  }
  // Door connection
  const doorX1 = b.x + Math.floor(b.w / 2);
  addTile('cobblestone_path', doorX1, streetY + 2);
});

// === TREE FENCE BORDERS (solid, not scattered) ===
// North border (solid line of trees)
for (let x = cx - 14; x <= cx + 14; x += 2) {
  placements['palm_tree'] = placements['palm_tree'] || [];
  placements['palm_tree'].push([x * TILE_SIZE, (streetY - 8) * TILE_SIZE]);
  placements['palm_tree'].push([(x + 1) * TILE_SIZE, (streetY - 8) * TILE_SIZE]);
}

// South border
for (let x = cx - 14; x <= cx + 14; x += 2) {
  placements['palm_tree'] = placements['palm_tree'] || [];
  placements['palm_tree'].push([x * TILE_SIZE, (streetY + 9) * TILE_SIZE]);
  placements['palm_tree'].push([(x + 1) * TILE_SIZE, (streetY + 9) * TILE_SIZE]);
}

// East/West borders
for (let y = streetY - 8; y <= streetY + 9; y += 2) {
  placements['palm_tree'] = placements['palm_tree'] || [];
  placements['palm_tree'].push([(cx - 14) * TILE_SIZE, y * TILE_SIZE]);
  placements['palm_tree'].push([(cx - 13) * TILE_SIZE, (y + 1) * TILE_SIZE]);
  placements['palm_tree'].push([(cx + 14) * TILE_SIZE, y * TILE_SIZE]);
  placements['palm_tree'].push([(cx + 15) * TILE_SIZE, (y + 1) * TILE_SIZE]);
}

// === SIDE ROADS (vertical, connecting to bridges) ===
// West road from street
placeLine('dirt_path', cx - 10, streetY - 1, cx - 10, streetY - 8);
placeLine('dirt_path', cx - 11, streetY - 1, cx - 11, streetY - 8);

// East road
placeLine('dirt_path', cx + 10, streetY + 1, cx + 10, streetY + 8);
placeLine('dirt_path', cx + 11, streetY + 1, cx + 11, streetY + 8);

// === FLOWER CLUSTERS (decorative) ===
placements['shell_pink'] = placements['shell_pink'] || [];
placements['shell_pink'].push([(cx - 12) * TILE_SIZE, (streetY - 7) * TILE_SIZE]);
placements['shell_pink'].push([(cx - 11.5) * TILE_SIZE, (streetY - 6.5) * TILE_SIZE]);
placements['shell_pink'].push([(cx + 12) * TILE_SIZE, (streetY + 7) * TILE_SIZE]);
placements['shell_pink'].push([(cx + 11.5) * TILE_SIZE, (streetY + 6.5) * TILE_SIZE]);

placements['shell_spiral'] = placements['shell_spiral'] || [];
placements['shell_spiral'].push([(cx - 4) * TILE_SIZE, (streetY + 7) * TILE_SIZE]);
placements['shell_spiral'].push([(cx + 3) * TILE_SIZE, (streetY - 7) * TILE_SIZE]);

// benches
// @ts-ignore
placements['bench'] = placements['bench'] || [];
placements['bench'].push([(cx - 5) * TILE_SIZE, (streetY - 6) * TILE_SIZE]);
placements['bench'].push([(cx + 4) * TILE_SIZE, (streetY + 6) * TILE_SIZE]);

// === DECORATION CLUSTERS ===
placements['coral'] = placements['coral'] || [];
placements['coral'].push([(cx - 13) * TILE_SIZE, (streetY + 6) * TILE_SIZE]);
placements['coral'].push([(cx + 13) * TILE_SIZE, (streetY - 6) * TILE_SIZE]);

placements['rock'] = placements['rock'] || [];
placements['rock'].push([(cx - 12) * TILE_SIZE, (streetY + 8) * TILE_SIZE]);
placements['rock'].push([(cx + 12) * TILE_SIZE, (streetY - 8) * TILE_SIZE]);

placements['rock_small'] = placements['rock_small'] || [];
placements['rock_small'].push([(cx - 13) * TILE_SIZE, (streetY - 7) * TILE_SIZE]);
placements['rock_small'].push([(cx + 13) * TILE_SIZE, (streetY + 7) * TILE_SIZE]);

// Write output
const editorMapData = { placements: placements, deleted: [] };
const content = `// FireRed-style: straight main street, row buildings, tree fences
// Generated: ${new Date().toISOString()}
const EDITOR_MAP_DATA = ${JSON.stringify(editorMapData, null, 2)};
export default EDITOR_MAP_DATA;
`;

fs.writeFileSync('./client/js/data/EditorMapData.js', content);

console.log(`✅ FireRed straight-street town layout:`);
console.log(`  - Main street: 3 tiles wide, ${cx - 12} to ${cx + 12}`);
console.log(`  - 3 buildings north side, 3 buildings south side`);
console.log(`  - Solid tree fence borders (N/S/E/W)`);
console.log(`  - Flower clusters at corners`);
console.log(`  - ${placed.size} path tiles placed`);
