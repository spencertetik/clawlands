// Generate intentional town layout for FireRed/Link's Awakening vibes
// Run: node generate_intentional_map.js

const fs = require('fs');

const TILE_SIZE = 16;
const WORLD_WIDTH = 200;
const WORLD_HEIGHT = 200;

// Island centers (from existing world generation)
const islands = [
  { id: 2, x: 85, y: 74, size: 18, isMain: true },   // Main island - spawn
  { id: 5, x: 35, y: 90, size: 15 },                  // North-west
  { id: 1, x: 140, y: 50, size: 16 },                 // North-east
  { id: 3, x: 45, y: 140, size: 17 },                 // South-west
  { id: 4, x: 125, y: 130, size: 15 },                // South-east
  { id: 9, x: 85, y: 35, size: 15 },                  // Far north
  { id: 6, x: 160, y: 90, size: 16 },                 // East
  { id: 7, x: 30, y: 50, size: 15 },                  // Far west
  { id: 8, x: 100, y: 160, size: 17 },                // South
  { id: 0, x: 170, y: 150, size: 15 }                 // Far south-east
];

const placements = {};

// Helper: get unique key for position
function getPosKey(x, y) {
  return `${x},${y}`;
}

// Set of placed positions to avoid duplicates
const placedPaths = new Set();
const placedDecors = new Set();

// Helper: place a circular plaza
function placePlaza(cx, cy, radius, type = 'cobblestone_path') {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx*dx + dy*dy <= radius*radius) {
        const key = getPosKey(cx + dx, cy + dy);
        if (!placedPaths.has(key)) {
          placedPaths.add(key);
          if (!placements[type]) placements[type] = [];
          placements[type].push([(cx + dx) * TILE_SIZE, (cy + dy) * TILE_SIZE]);
        }
      }
    }
  }
}

// Helper: place curved path between two points
function placeCurvedPath(x1, y1, x2, y2, type = 'dirt_path') {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const midX = (x1 + x2) / 2 + (Math.abs(y2 - y1) > Math.abs(x2 - x1) ? 2 : 0);
    const midY = (y1 + y2) / 2;
    
    const x = Math.round((1-t)*(1-t)*x1 + 2*(1-t)*t*midX + t*t*x2);
    const y = Math.round((1-t)*(1-t)*y1 + 2*(1-t)*t*midY + t*t*y2);
    
    const key = getPosKey(x, y);
    if (!placedPaths.has(key)) {
      placedPaths.add(key);
      if (!placements[type]) placements[type] = [];
      placements[type].push([x * TILE_SIZE, y * TILE_SIZE]);
    }
    
    // 2-wide path
    const key2 = getPosKey(x + 1, y);
    if (!placedPaths.has(key2)) {
      placedPaths.add(key2);
      if (!placements[type]) placements[type] = [];
      placements[type].push([(x + 1) * TILE_SIZE, y * TILE_SIZE]);
    }
  }
}

// === MAIN ISLAND TOWN DESIGN ===
const main = islands[0];
const townCenter = { x: main.x, y: main.y };

// Circular town plaza (radius 4 tiles)
placePlaza(townCenter.x, townCenter.y, 4, 'cobblestone_path');

// Place buildings around plaza in a circle
const buildingPositions = [
  { x: townCenter.x - 6, y: townCenter.y - 4, type: 'inn', name: 'The Salty Shell' },
  { x: townCenter.x + 5, y: townCenter.y - 3, type: 'shop', name: 'Coral Cove Goods' },
  { x: townCenter.x - 3, y: townCenter.y + 6, type: 'house', name: 'Pearl\'s Rest' },
  { x: townCenter.x + 4, y: townCenter.y + 5, type: 'lighthouse', name: 'Beacon' },
  { x: townCenter.x - 7, y: townCenter.y + 2, type: 'house', name: 'Molt Manor' },
  { x: townCenter.x + 6, y: townCenter.y + 1, type: 'house', name: 'Crab Cottage' }
];

// Cobblestone paths from plaza to each building
buildingPositions.forEach(b => {
  // Doorstep is cobblestone
  placePlaza(b.x + 1, b.y + 1, 1, 'cobblestone_path');
  placePlaza(b.x + 2, b.y + 1, 1, 'cobblestone_path');
  
  // Dirt path from town center toward building
  placeCurvedPath(townCenter.x, townCenter.y, b.x + 1, b.y + 1, 'dirt_path');
});

// Place dirt roads from plaza toward bridge exits (NE, SE, SW, NW)
const bridgeDirs = [
  { dx: 1, dy: -1, name: 'NE' },   // To island 1
  { dx: 1, dy: 1, name: 'SE' },    // To island 4  
  { dx: -1, dy: 1, name: 'SW' },    // To island 3
  { dx: -1, dy: -1, name: 'NW' }   // To island 2
];

bridgeDirs.forEach(dir => {
  const roadLen = main.size + 3;
  const endX = townCenter.x + dir.dx * roadLen;
  const endY = townCenter.y + dir.dy * roadLen;
  placeCurvedPath(townCenter.x + dir.dx * 4, townCenter.y + dir.dy * 4, endX, endY, 'dirt_path');
});

// Decoration placement
const decors = [
  // Trees around town edges
  ['palm_tree', townCenter.x - 8, townCenter.y - 6],
  ['palm_tree', townCenter.x - 7, townCenter.y - 6],
  ['rock', townCenter.x - 8, townCenter.y - 5],
  ['palm_tree', townCenter.x + 8, townCenter.y - 5],
  ['shell_pink', townCenter.x + 9, townCenter.y - 4],
  ['coral', townCenter.x + 8, townCenter.y - 4],
  ['palm_tree', townCenter.x - 7, townCenter.y + 7],
  ['shell_spiral', townCenter.x - 8, townCenter.y + 8],
  ['rock', townCenter.x - 7, townCenter.y + 8],
  ['palm_tree', townCenter.x + 7, townCenter.y + 8],
  ['palm_tree', townCenter.x + 8, townCenter.y + 9],
  
  // Seating in plaza edges
  ['bench', townCenter.x - 2, townCenter.y - 3],
  ['bench', townCenter.x + 3, townCenter.y + 2],
  
  // Details along paths
  ['shell_stripe', townCenter.x - 10, townCenter.y],
  ['rock_small', townCenter.x - 11, townCenter.y],
  ['shell_white', townCenter.x + 11, townCenter.y],
  ['coral', townCenter.x + 12, townCenter.y],
  ['rock', townCenter.x, townCenter.y - 11],
  ['shell_pink', townCenter.x, townCenter.y - 12],
  ['rock_small', townCenter.x, townCenter.y + 12],
  ['shell_spiral', townCenter.x, townCenter.y + 13]
];

decors.forEach(([type, x, y]) => {
  const key = getPosKey(x, y);
  if (!placedDecors.has(key)) {
    placedDecors.add(key);
    if (!placements[type]) placements[type] = [];
    placements[type].push([x * TILE_SIZE, y * TILE_SIZE]);
  }
});

// === SECONDARY ISLANDS (smaller settlements) ===
islands.slice(1).forEach((island, idx) => {
  if (idx % 2 === 0) {
    // Some islands get a small plaza
    placePlaza(island.x, island.y, 2, 'cobblestone_path');
    
    // Paths to buildings
    placeCurvedPath(island.x, island.y, island.x - 3 + 2, island.y - 2 + 1, 'dirt_path');
    placeCurvedPath(island.x, island.y, island.x + 3, island.y + 2, 'dirt_path');
    
    // Sparse decorations
    if (!placements['palm_tree']) placements['palm_tree'] = [];
    placements['palm_tree'].push([(island.x - 4) * TILE_SIZE, (island.y - 3) * TILE_SIZE]);
    if (!placements['shell_pink']) placements['shell_pink'] = [];
    placements['shell_pink'].push([(island.x + 4) * TILE_SIZE, (island.y + 3) * TILE_SIZE]);
  }
});

// Build EditorMapData structure in the format the game expects
const editorMapData = {
  placements: placements,
  deleted: []
};

// Count total
totalItems = 0;
for (const [type, coords] of Object.entries(placements)) {
  totalItems += coords.length;
}

// Write to file
const outputPath = './client/js/data/EditorMapData.js';
const content = `// Intentional town layout — FireRed/Link's Awakening inspired
// Generated: ${new Date().toISOString()}
const EDITOR_MAP_DATA = ${JSON.stringify(editorMapData, null, 2)};
export default EDITOR_MAP_DATA;
`;

fs.writeFileSync(outputPath, content);

console.log(`✅ Generated intentional map for FireRed/Zelda vibes:`);
console.log(`  - ${placedPaths.size} path tiles`);
console.log(`  - ${placedDecors.size} decorations`);
console.log(`  - Main island: circular plaza with roads to 6 buildings`);
console.log(`  - 4 curved roads from town center to bridges`);
console.log(`  - Trees, shells, rocks clustered (not scattered)`);
console.log(`Written to: ${outputPath}`);
