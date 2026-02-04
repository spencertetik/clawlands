/**
 * Focused Building Entry Test
 * Specifically tests walking into buildings
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const GAME_URL = 'http://localhost:8080';
const SCREENSHOT_DIR = './playtest-screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

let screenshotCount = 0;

async function log(msg) {
    console.log(`[${new Date().toISOString().substr(11, 8)}] ${msg}`);
}

async function screenshot(page, name) {
    screenshotCount++;
    const filename = `${SCREENSHOT_DIR}/${String(screenshotCount).padStart(2, '0')}_${name}.png`;
    await page.screenshot({ path: filename });
    log(`📸 ${filename}`);
}

async function waitMs(ms) {
    await new Promise(r => setTimeout(r, ms));
}

async function holdKey(page, key, duration) {
    await page.keyboard.down(key);
    await new Promise(r => setTimeout(r, duration));
    await page.keyboard.up(key);
}

async function getGameState(page) {
    return await page.evaluate(() => {
        if (window.game) {
            return {
                playerX: window.game.player?.position?.x,
                playerY: window.game.player?.position?.y,
                location: window.game.currentLocation,
                buildingCount: window.game.buildings?.length || 0,
                currentBuilding: window.game.currentBuilding?.name || null
            };
        }
        return null;
    });
}

async function getBuildingPositions(page) {
    return await page.evaluate(() => {
        if (window.game && window.game.buildings) {
            return window.game.buildings.map(b => ({
                name: b.name,
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                doorX: b.x + b.doorOffsetX,
                doorY: b.y + b.height,
                triggerZone: b.getTriggerZone()
            }));
        }
        return [];
    });
}

async function playtest() {
    log('🏠 Building Entry Test Starting...');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1024, height: 768 }
    });
    
    const page = await browser.newPage();
    
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('🏠') || text.includes('🚪') || text.includes('Entered') || text.includes('Exited')) {
            log(`[GAME] ${text}`);
        }
    });

    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await waitMs(2000);
    
    // Quick character creation - just click through
    await page.click('button'); // Begin Journey
    await waitMs(500);
    
    // Find and click Enter World
    const buttons = await page.$$('button');
    for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent);
        if (text.includes('Enter World')) {
            await btn.click();
            break;
        }
    }
    await waitMs(2000);
    
    let state = await getGameState(page);
    log(`📍 Player at: (${state?.playerX?.toFixed(0)}, ${state?.playerY?.toFixed(0)})`);
    log(`📍 Location: ${state?.location}`);
    
    // Get building positions
    const buildings = await getBuildingPositions(page);
    log(`🏠 Found ${buildings.length} buildings:`);
    buildings.forEach(b => {
        log(`   - ${b.name} at (${b.x}, ${b.y}), door at (${b.doorX}, ${b.doorY})`);
    });
    
    await screenshot(page, 'start_position');
    
    // Find nearest building
    if (buildings.length > 0 && state) {
        const nearest = buildings.reduce((closest, b) => {
            const dist = Math.hypot(b.doorX - state.playerX, b.doorY - state.playerY);
            if (!closest || dist < closest.dist) {
                return { building: b, dist };
            }
            return closest;
        }, null);
        
        log(`🎯 Nearest building: ${nearest.building.name} (${nearest.dist.toFixed(0)}px away)`);
        log(`   Door at: (${nearest.building.doorX}, ${nearest.building.doorY})`);
        log(`   Trigger zone: x=${nearest.building.triggerZone.x}, y=${nearest.building.triggerZone.y}`);
        
        // The door is at the BOTTOM of the building - need to navigate around
        // First go SOUTH (down) to get below the building, then approach from below
        const doorY = nearest.building.y + nearest.building.height; // Bottom of building
        const triggerCenterX = nearest.building.triggerZone.x + nearest.building.triggerZone.width / 2;
        const triggerCenterY = nearest.building.triggerZone.y + nearest.building.triggerZone.height / 2;
        
        log(`📐 Building at (${nearest.building.x}, ${nearest.building.y}), size ${nearest.building.width}x${nearest.building.height}`);
        log(`   Door/trigger at y=${doorY}, trigger zone: x=${nearest.building.triggerZone.x}-${nearest.building.triggerZone.x + nearest.building.triggerZone.width}`);
        
        // Step 1: Move SOUTH to get below the building (door level + some margin)
        const targetY = doorY + 20; // A bit below the door
        if (state.playerY < targetY) {
            const moveY = targetY - state.playerY;
            log(`⬇️ Step 1: Moving DOWN ${moveY.toFixed(0)}px to get below building`);
            await holdKey(page, 's', Math.max(moveY * 15, 800));
            await waitMs(200);
        }
        
        state = await getGameState(page);
        log(`📍 After going south: (${state?.playerX?.toFixed(0)}, ${state?.playerY?.toFixed(0)})`);
        
        // Step 2: Move horizontally to align with door
        const dx = triggerCenterX - state.playerX;
        if (Math.abs(dx) > 5) {
            const key = dx > 0 ? 'd' : 'a';
            log(`➡️ Step 2: Moving ${key} ${Math.abs(dx).toFixed(0)}px to align with door`);
            await holdKey(page, key, Math.max(Math.abs(dx) * 15, 500));
            await waitMs(200);
        }
        
        state = await getGameState(page);
        log(`📍 After aligning: (${state?.playerX?.toFixed(0)}, ${state?.playerY?.toFixed(0)})`);
        
        // Step 3: Walk UP into the door trigger zone
        log(`⬆️ Step 3: Walking UP into door`);
        await holdKey(page, 'w', 800);
        await waitMs(300);
        
        await screenshot(page, 'at_door');
        
        state = await getGameState(page);
        log(`📍 After vertical: (${state?.playerX?.toFixed(0)}, ${state?.playerY?.toFixed(0)})`);
        log(`📍 Location: ${state?.location}`);
        
        if (state?.location === 'interior') {
            log('✅ SUCCESS! Entered building!');
            log(`🏠 Inside: ${state?.currentBuilding}`);
            await screenshot(page, 'inside_building');
            
            // Try to exit
            log('🚪 Attempting to exit...');
            await holdKey(page, 's', 1500);
            await waitMs(500);
            
            state = await getGameState(page);
            log(`📍 After exit attempt: ${state?.location}`);
            await screenshot(page, 'after_exit');
        } else {
            log('⚠️ Did not enter building - trying to walk directly into doormat');
            
            // Enable debug mode to see trigger zones
            await page.keyboard.press('`');
            await waitMs(100);
            await screenshot(page, 'debug_at_door');
            
            // Try walking up into the building
            for (let i = 0; i < 5; i++) {
                await holdKey(page, 'w', 300);
                await waitMs(200);
                state = await getGameState(page);
                if (state?.location === 'interior') {
                    log('✅ Entered on attempt ' + (i+1));
                    break;
                }
            }
            
            await screenshot(page, 'final_attempt');
            state = await getGameState(page);
            log(`📍 Final state: ${state?.location}`);
        }
    }
    
    log('\n=== TEST COMPLETE ===');
    log('Browser left open for inspection.');
}

playtest().catch(console.error);
