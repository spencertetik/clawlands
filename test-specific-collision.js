#!/usr/bin/env node
/**
 * Test specific collision points to verify decoration collision works correctly
 */

const { generateTerrain, generateBuildings } = require('./server/terrainMap');
const { ServerCollisionSystem } = require('./server/serverCollisionSystem');

async function testSpecificCollision() {
    console.log('🎯 Testing specific collision points...\n');
    
    const terrainData = generateTerrain();
    const buildings = generateBuildings(terrainData);
    const collision = new ServerCollisionSystem(terrainData);
    collision.setBuildings(buildings);
    collision.setDecorations(terrainData.decorations || []);
    
    // Test various land points to find one that should be clear
    const testPoints = [
        { x: 1300, y: 1100 },
        { x: 1350, y: 1150 },
        { x: 1400, y: 1200 },
        { x: 1250, y: 1100 },
        { x: 1200, y: 1050 }
    ];
    
    console.log('Testing land points for clear walkable area:');
    
    for (const point of testPoints) {
        const tileX = Math.floor(point.x / 16);
        const tileY = Math.floor(point.y / 16);
        const terrainValue = terrainData.terrainMap[tileY] && terrainData.terrainMap[tileY][tileX];
        const decorBlocked = collision.checkDecorationCollision(point.x, point.y, 16, 24);
        const buildingBlocked = collision.checkBuildingCollision({x: point.x, y: point.y, width: 16, height: 24}, point.x, point.y, 16, 24);
        const finalResult = collision.checkCollision(point.x, point.y);
        
        console.log(`   (${point.x}, ${point.y}): terrain=${terrainValue}, decor=${decorBlocked}, building=${buildingBlocked}, final=${finalResult ? 'BLOCKED' : 'WALKABLE'}`);
    }
    
    // Test decoration collision specifically
    console.log('\nTesting decoration collision:');
    const decorations = terrainData.decorations || [];
    
    // Find a rock decoration
    const rock = decorations.find(d => d.type === 'rock');
    if (rock) {
        console.log(`   Rock at (${rock.x}, ${rock.y}):`);
        const rockBlocked = collision.checkCollision(rock.x, rock.y);
        console.log(`     Collision check: ${rockBlocked ? 'BLOCKED' : 'WALKABLE'}`);
        
        // Test adjacent to rock
        const adjacentX = rock.x + 20;
        const adjacentY = rock.y;
        const adjacentBlocked = collision.checkCollision(adjacentX, adjacentY);
        console.log(`     Adjacent to rock (${adjacentX}, ${adjacentY}): ${adjacentBlocked ? 'BLOCKED' : 'WALKABLE'}`);
    }
    
    // Test path collision
    const path = decorations.find(d => d.type === 'cobblestone_path');
    if (path) {
        console.log(`   Path at (${path.x}, ${path.y}):`);
        const pathBlocked = collision.checkCollision(path.x, path.y);
        console.log(`     Collision check: ${pathBlocked ? 'BLOCKED' : 'WALKABLE'}`);
    }
    
    console.log('\n✅ Specific collision testing completed!');
}

if (require.main === module) {
    testSpecificCollision().catch(console.error);
}