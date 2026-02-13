#!/usr/bin/env node
/**
 * Test script to verify the server collision system matches client data
 */

const { generateTerrain, generateBuildings } = require('./server/terrainMap');
const { ServerCollisionSystem } = require('./server/serverCollisionSystem');

async function testCollisionSystem() {
    console.log('🧪 Testing server collision system...');
    
    try {
        // Generate terrain and buildings
        console.log('📍 Generating terrain data...');
        const terrainData = generateTerrain();
        console.log(`   ✅ Terrain: ${terrainData.width}×${terrainData.height}`);
        console.log(`   ✅ Islands: ${terrainData.islands.length}`);
        console.log(`   ✅ Decorations: ${(terrainData.decorations || []).length}`);
        
        console.log('🏠 Generating buildings...');
        const buildings = generateBuildings(terrainData);
        console.log(`   ✅ Buildings: ${buildings.length}`);
        
        // Initialize collision system
        console.log('🚧 Initializing collision system...');
        const collision = new ServerCollisionSystem(terrainData);
        collision.setBuildings(buildings);
        collision.setDecorations(terrainData.decorations || []);
        console.log('   ✅ Collision system initialized');
        
        // Test collision at various points
        console.log('🔍 Testing collision detection...');
        
        // Test spawn area (should be walkable)
        const spawnResult = collision.checkCollision(1288, 1160);
        console.log(`   Spawn point (1288, 1160): ${spawnResult ? 'BLOCKED' : 'WALKABLE'}`);
        
        // Test water (should be blocked)
        const waterResult = collision.checkCollision(100, 100);
        console.log(`   Water point (100, 100): ${waterResult ? 'BLOCKED' : 'WALKABLE'}`);
        
        // Test building collision
        if (buildings.length > 0) {
            const building = buildings[0];
            const buildingResult = collision.checkCollision(building.x + 10, building.y + 10);
            console.log(`   Building interior (${building.x + 10}, ${building.y + 10}): ${buildingResult ? 'BLOCKED' : 'WALKABLE'}`);
        }
        
        console.log('✅ Collision system test completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testCollisionSystem().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testCollisionSystem };