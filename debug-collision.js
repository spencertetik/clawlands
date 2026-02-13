#!/usr/bin/env node
/**
 * Debug collision detection to understand why certain tiles are blocked
 */

const { generateTerrain } = require('./server/terrainMap');
const { ServerCollisionSystem } = require('./server/serverCollisionSystem');

async function debugCollision() {
    console.log('🔧 Debugging collision detection...\n');
    
    const terrainData = generateTerrain();
    const collision = new ServerCollisionSystem(terrainData);
    
    // Test specific coordinates
    const testPoints = [
        { x: 1280, y: 1152, name: "Land tile" },
        { x: 1288, y: 1160, name: "Spawn point" },
        { x: 64, y: 64, name: "Water tile" },
        { x: 1248, y: 1232, name: "Path tile" }
    ];
    
    for (const point of testPoints) {
        console.log(`\n🔍 Testing ${point.name} at (${point.x}, ${point.y}):`);
        
        // Convert to tile coordinates
        const tileX = Math.floor(point.x / 16);
        const tileY = Math.floor(point.y / 16);
        console.log(`   Tile coordinates: (${tileX}, ${tileY})`);
        
        // Check terrain map value
        const terrainValue = terrainData.terrainMap[tileY] && terrainData.terrainMap[tileY][tileX];
        console.log(`   Terrain map value: ${terrainValue} (0=land, 1=water)`);
        
        // Check collision map value
        const collisionValue = terrainData.collisionMap[tileY] && terrainData.collisionMap[tileY][tileX];
        console.log(`   Collision map value: ${collisionValue} (0=walkable, 1=blocked)`);
        
        // Check individual collision components
        console.log(`   Tile solid check: ${collision.isTileSolid(tileX, tileY)}`);
        
        // Check if blocked by decorations
        const decorationBlocked = collision.checkDecorationCollision(point.x, point.y, 16, 24);
        console.log(`   Decoration collision: ${decorationBlocked}`);
        
        // Final collision check
        const finalResult = collision.checkCollision(point.x, point.y);
        console.log(`   Final result: ${finalResult ? 'BLOCKED' : 'WALKABLE'}`);
    }
    
    // Show some decoration collision examples
    console.log('\n📦 Decoration collision analysis:');
    const decorations = terrainData.decorations || [];
    const solidDecorations = decorations.filter(d => {
        if (d.ground || d.layer === 0) return false;
        if (d.type === 'dirt_path' || d.type === 'cobblestone_path') return false;
        return true;
    });
    
    console.log(`   Total decorations: ${decorations.length}`);
    console.log(`   Ground/path decorations: ${decorations.length - solidDecorations.length}`);
    console.log(`   Solid decorations: ${solidDecorations.length}`);
    
    // Check decoration types
    const decorationTypes = {};
    solidDecorations.forEach(d => {
        decorationTypes[d.type] = (decorationTypes[d.type] || 0) + 1;
    });
    
    console.log('\n   Solid decoration types:');
    Object.entries(decorationTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([type, count]) => {
            console.log(`     ${type}: ${count}`);
        });
}

if (require.main === module) {
    debugCollision().catch(console.error);
}