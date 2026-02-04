/**
 * Test ALL buildings in Claw World - reads positions dynamically from game
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const GAME_URL = 'http://localhost:8080';
const SCREENSHOT_DIR = './playtest-screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);
fs.readdirSync(SCREENSHOT_DIR).forEach(f => {
    if (f.endsWith('.png')) fs.unlinkSync(`${SCREENSHOT_DIR}/${f}`);
});

let shotCount = 0;
const results = { success: [], failed: [] };

function log(msg) {
    console.log(`[${new Date().toISOString().substr(11, 8)}] ${msg}`);
}

async function shot(page, name) {
    shotCount++;
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${String(shotCount).padStart(2, '0')}_${name}.png` });
}

async function holdKey(page, key, ms) {
    await page.keyboard.down(key);
    await new Promise(r => setTimeout(r, ms));
    await page.keyboard.up(key);
}

async function pressKey(page, key) {
    await page.keyboard.down(key);
    await new Promise(r => setTimeout(r, 80));
    await page.keyboard.up(key);
}

async function waitMs(ms) { await new Promise(r => setTimeout(r, ms)); }

async function getState(page) {
    return await page.evaluate(() => {
        if (window.render_game_to_text) return JSON.parse(window.render_game_to_text());
        return null;
    }).catch(() => null);
}

// Get actual building positions from the game
async function getBuildingsFromGame(page) {
    return await page.evaluate(() => {
        if (!window.game || !window.game.buildings) return [];
        return window.game.buildings.map(b => ({
            name: b.name,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            type: b.type,
            doorOffsetX: b.doorOffsetX || 16
        }));
    }).catch(() => []);
}

// Navigate to target position using feedback
// Returns: 'reached' if reached target, 'entered' if entered building during navigation, false if failed
async function navigateTo(page, targetX, targetY, name) {
    log(`🎯 Navigating to ${name} at (${targetX}, ${targetY})`);
    
    for (let attempt = 0; attempt < 10; attempt++) {
        const state = await getState(page);
        if (!state?.player) break;
        
        // If we entered a building during navigation
        if (state.location === 'interior') {
            // Check if we're close to target - if so, we probably entered the right building
            const px = state.player?.x || 0;
            const py = state.player?.y || 0;
            // In interior, position is different - just return 'entered'
            log(`   🚪 Entered building during navigation`);
            return 'entered';
        }
        
        const px = state.player.x;
        const py = state.player.y;
        
        const dx = targetX - px;
        const dy = targetY - py;
        
        if (Math.abs(dx) < 25 && Math.abs(dy) < 25) {
            log(`   ✓ Reached target (${px.toFixed(0)}, ${py.toFixed(0)})`);
            return 'reached';
        }
        
        // Move toward target
        if (Math.abs(dx) > 20) {
            const key = dx > 0 ? 'd' : 'a';
            const time = Math.min(Math.abs(dx) * 15, 2500);
            await holdKey(page, key, time);
            await waitMs(50);
        }
        
        if (Math.abs(dy) > 20) {
            const key = dy > 0 ? 's' : 'w';
            const time = Math.min(Math.abs(dy) * 15, 2500);
            await holdKey(page, key, time);
            await waitMs(50);
        }
    }
    return false;
}

// Test a single building
async function testBuilding(page, building) {
    const { name, x, y, width, height, doorOffsetX } = building;
    
    // Door is at bottom-center of building
    // Trigger zone: y = building.y + height - 8, height = 40 (so extends to y + height + 32)
    // Position player so their FEET (playerY + 20) will be in the trigger zone when walking up
    const doorX = x + (doorOffsetX || width / 2);
    const doorY = y + height + 24; // 24px below building - feet at doorY+20 will be in trigger zone
    
    log(`\n🏠 === Testing: ${name} ===`);
    log(`   Building at (${x}, ${y}), door at ~(${doorX.toFixed(0)}, ${doorY.toFixed(0)})`);
    
    // Navigate to just below the door
    const navResult = await navigateTo(page, doorX, doorY, name);
    
    let state = await getState(page);
    
    // If we entered during navigation, we're already inside
    let alreadyEntered = navResult === 'entered' && state?.location === 'interior';
    
    if (!alreadyEntered && (navResult === 'reached' || navResult === 'entered')) {
        // Walk up into the door
        log(`   Walking into door...`);
        await holdKey(page, 'w', 1200);
        await waitMs(1000);
        state = await getState(page);
    }
    
    // Check if we entered
    if (state?.location === 'interior') {
        log(`   ✅ ENTERED ${name}!`);
        await shot(page, `${name.replace(/[^a-z0-9]/gi, '_')}_interior`);
        
        // Try NPC dialog
        await holdKey(page, 'w', 400);
        await waitMs(200);
        await pressKey(page, ' ');
        await waitMs(400);
        
        state = await getState(page);
        if (state?.dialogOpen) {
            log(`   💬 Dialog opened!`);
            for (let i = 0; i < 5; i++) {
                await pressKey(page, ' ');
                await waitMs(300);
                state = await getState(page);
                if (!state?.dialogOpen) break;
            }
        }
        
        // Exit building - walk south to exit, then keep walking south to clear all trigger zones
        log(`   Exiting...`);
        await holdKey(page, 's', 2500); // Walk south to exit
        await waitMs(500);
        
        // Check if we exited, if not keep walking
        state = await getState(page);
        if (state?.location === 'interior') {
            await holdKey(page, 's', 1500); // Try again
            await waitMs(500);
            state = await getState(page);
        }
        
        // Now walk even further south to clear any nearby trigger zones
        if (state?.location === 'outdoor') {
            await holdKey(page, 's', 800); // Walk south to clear area
            await waitMs(2500); // Wait for exit cooldown
            log(`   ✅ Exited successfully`);
            results.success.push(name);
            return true;
        } else {
            // Still inside? Try exiting again
            await holdKey(page, 's', 2000);
            await waitMs(800);
            state = await getState(page);
            if (state?.location === 'outdoor') {
                log(`   ✅ Exited successfully (2nd try)`);
                results.success.push(name);
                return true;
            }
        }
    } else {
        // Retry once more
        log(`   Retrying entry...`);
        await holdKey(page, 'w', 800);
        await waitMs(800);
        
        state = await getState(page);
        if (state?.location === 'interior') {
            log(`   ✅ ENTERED ${name} (retry)!`);
            await shot(page, `${name.replace(/[^a-z0-9]/gi, '_')}_interior`);
            
            // Exit
            await holdKey(page, 's', 1800);
            await waitMs(1200);
            
            state = await getState(page);
            if (state?.location === 'outdoor') {
                results.success.push(name);
                return true;
            }
        }
    }
    
    log(`   ❌ Could not complete test for ${name}`);
    await shot(page, `${name.replace(/[^a-z0-9]/gi, '_')}_failed`);
    results.failed.push(name);
    return false;
}

async function main() {
    log('🎮 Testing ALL Buildings in Claw World\n');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1024, height: 768 }
    });
    
    const page = await browser.newPage();
    
    page.on('console', msg => {
        const t = msg.text();
        if (t.includes('🏠') || t.includes('🚪') || t.includes('✅')) {
            log(`[GAME] ${t}`);
        }
    });

    // Load and setup game
    log('=== Loading Game ===');
    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await waitMs(2000);
    
    // Quick character creation
    await page.click('button');
    await waitMs(800);
    
    const nameInput = await page.$('input[type="text"]');
    if (nameInput) {
        await nameInput.click();
        await nameInput.type('BuildingTester');
        await page.click('body');
    }
    
    for (const btn of await page.$$('button')) {
        const text = await btn.evaluate(el => el.textContent);
        if (text.includes('Enter World')) {
            await btn.click();
            break;
        }
    }
    await waitMs(2500);
    
    // Get actual building positions from game
    const buildings = await getBuildingsFromGame(page);
    log(`📍 Found ${buildings.length} buildings in game:`);
    buildings.forEach(b => log(`   • ${b.name} at (${b.x}, ${b.y})`));
    
    let state = await getState(page);
    log(`📍 Player starting at (${state?.player?.x?.toFixed(0)}, ${state?.player?.y?.toFixed(0)})`);
    await shot(page, 'game_start');
    
    // Test each building (only main island buildings, not cottages)
    // Reorder to minimize crossing paths: start at Inn, go clockwise
    log('\n========== TESTING BUILDINGS ==========');
    
    const mainBuildings = buildings.filter(b => !b.name.includes('Cottage'));
    
    // Sort by a path that avoids crossing other buildings
    // Inn (center) -> Molting Den (east) -> Anchor House (north) -> Lighthouse (northwest) -> Shop (south)
    const buildingOrder = ['The Drift-In Inn', 'Molting Den', 'Anchor House', 'Current\'s Edge Light', 'Continuity Goods'];
    mainBuildings.sort((a, b) => {
        const aIdx = buildingOrder.indexOf(a.name);
        const bIdx = buildingOrder.indexOf(b.name);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
    });
    
    for (const building of mainBuildings) {
        await testBuilding(page, building);
        await waitMs(800); // Extra wait between buildings
    }
    
    // Final report
    log('\n========== RESULTS ==========');
    log(`✅ Success: ${results.success.length}/${mainBuildings.length}`);
    results.success.forEach(n => log(`   • ${n}`));
    
    if (results.failed.length > 0) {
        log(`❌ Failed: ${results.failed.length}`);
        results.failed.forEach(n => log(`   • ${n}`));
    }
    
    await shot(page, 'final');
    log(`\n📸 Screenshots: ${shotCount}`);
    
    // Always close browser when done
    await browser.close();
    log('🧹 Browser closed');
    
    // Save report
    const report = `# Building Test Report
Generated: ${new Date().toISOString()}

## Buildings Found: ${buildings.length}
${buildings.map(b => `- ${b.name} at (${b.x}, ${b.y})`).join('\n')}

## Results: ${results.success.length}/${mainBuildings.length} main buildings tested

### Successful
${results.success.map(n => `- ${n}`).join('\n') || '(none)'}

### Failed
${results.failed.map(n => `- ${n}`).join('\n') || '(none)'}
`;
    fs.writeFileSync('./building-test-report.md', report);
}

main().catch(console.error);
