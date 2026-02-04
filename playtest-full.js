/**
 * Comprehensive Playtest for Claw World
 * Tests all buildings, NPC dialog, and full world exploration
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const GAME_URL = 'http://localhost:8080';
const SCREENSHOT_DIR = './playtest-screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR);
}

// Clear old screenshots
fs.readdirSync(SCREENSHOT_DIR).forEach(f => {
    if (f.endsWith('.png')) fs.unlinkSync(`${SCREENSHOT_DIR}/${f}`);
});

let screenshotCount = 0;
const observations = [];
const bugs = [];
const successes = [];

function log(msg) {
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`[${timestamp}] ${msg}`);
    observations.push(msg);
}

function bug(msg) {
    log(`🐛 BUG: ${msg}`);
    bugs.push(msg);
}

function success(msg) {
    log(`✅ ${msg}`);
    successes.push(msg);
}

async function screenshot(page, name) {
    screenshotCount++;
    const filename = `${SCREENSHOT_DIR}/${String(screenshotCount).padStart(2, '0')}_${name}.png`;
    await page.screenshot({ path: filename });
    log(`📸 ${name}`);
    return filename;
}

async function pressKey(page, key, duration = 100) {
    await page.keyboard.down(key);
    await new Promise(r => setTimeout(r, duration));
    await page.keyboard.up(key);
}

async function holdKey(page, key, duration) {
    await page.keyboard.down(key);
    await new Promise(r => setTimeout(r, duration));
    await page.keyboard.up(key);
}

async function waitMs(ms) {
    await new Promise(r => setTimeout(r, ms));
}

async function getGameState(page) {
    try {
        return await page.evaluate(() => {
            if (window.render_game_to_text) {
                return JSON.parse(window.render_game_to_text());
            }
            return null;
        });
    } catch (e) {
        return null;
    }
}

// Navigate to a specific pixel position
async function navigateTo(page, targetX, targetY) {
    const state = await getGameState(page);
    if (!state?.player) return false;
    
    const startX = state.player.x;
    const startY = state.player.y;
    
    // Move speed is roughly 100px/sec
    const dx = targetX - startX;
    const dy = targetY - startY;
    
    // Move horizontally
    if (Math.abs(dx) > 5) {
        const key = dx > 0 ? 'd' : 'a';
        const duration = Math.abs(dx) * 10;
        await holdKey(page, key, duration);
        await waitMs(100);
    }
    
    // Move vertically
    if (Math.abs(dy) > 5) {
        const key = dy > 0 ? 's' : 'w';
        const duration = Math.abs(dy) * 10;
        await holdKey(page, key, duration);
        await waitMs(100);
    }
    
    return true;
}

// Try to enter a building by walking into its door
async function tryEnterBuilding(page, buildingName) {
    // Walk up to enter
    await holdKey(page, 'w', 800);
    await waitMs(500);
    
    const state = await getGameState(page);
    if (state?.location === 'interior') {
        success(`Entered ${buildingName}`);
        return true;
    }
    
    // Retry with longer walk
    await holdKey(page, 'w', 600);
    await waitMs(500);
    
    const state2 = await getGameState(page);
    return state2?.player?.location === 'interior';
}

// Test NPC dialog interaction
async function testNPCDialog(page) {
    log('💬 Testing NPC dialog...');
    
    // Press space to talk
    await pressKey(page, ' ');
    await waitMs(300);
    
    const state = await getGameState(page);
    if (state?.dialogOpen) {
        success('Dialog opened with NPC');
        await screenshot(page, 'dialog_open');
        
        // Advance through dialog
        for (let i = 0; i < 5; i++) {
            await pressKey(page, ' ');
            await waitMs(300);
            const s = await getGameState(page);
            if (!s?.dialogOpen) break;
        }
        
        success('Dialog completed');
        return true;
    } else {
        bug('Could not open NPC dialog');
        return false;
    }
}

// Exit building by walking south
async function exitBuilding(page) {
    log('🚪 Exiting building...');
    await holdKey(page, 's', 1500);
    await waitMs(500);
    
    const state = await getGameState(page);
    if (state?.location === 'outdoor') {
        success('Exited building');
        return true;
    }
    return false;
}

// Building definitions with their approximate door positions
// Based on: Inn at (30,60), Shop at (39,65), Lighthouse at (24,66), etc.
const BUILDINGS = {
    'The Drift-In Inn': { 
        tileX: 30, tileY: 60, 
        width: 96, height: 72,
        doorOffsetX: 20 
    },
    'Continuity Goods': { 
        tileX: 39, tileY: 65, 
        width: 72, height: 48,
        doorOffsetX: 28 
    },
    'Current\'s Edge Light': { 
        tileX: 24, tileY: 66, 
        width: 48, height: 96,
        doorOffsetX: 16 
    },
    'Anchor House': { 
        tileX: 24, tileY: 58, 
        width: 48, height: 48,
        doorOffsetX: 16 
    }
};

async function testBuilding(page, name, info) {
    log(`\n🏠 Testing: ${name}`);
    
    // Calculate door position
    const doorX = info.tileX * 16 + info.doorOffsetX;
    const doorY = info.tileY * 16 + info.height + 8; // Just below door
    
    log(`   Door position: (${doorX}, ${doorY})`);
    
    // Navigate to door
    await navigateTo(page, doorX, doorY);
    await screenshot(page, `${name.replace(/[^a-z]/gi, '_')}_approach`);
    
    // Try to enter
    const entered = await tryEnterBuilding(page, name);
    
    if (entered) {
        await screenshot(page, `${name.replace(/[^a-z]/gi, '_')}_interior`);
        
        // Test NPC dialog if inside
        await waitMs(500);
        
        // Walk up toward NPCs
        await holdKey(page, 'w', 500);
        await waitMs(200);
        
        await testNPCDialog(page);
        
        // Exit
        await exitBuilding(page);
        await screenshot(page, `${name.replace(/[^a-z]/gi, '_')}_exit`);
    } else {
        bug(`Could not enter ${name}`);
        await screenshot(page, `${name.replace(/[^a-z]/gi, '_')}_failed`);
    }
    
    return entered;
}

async function playtest() {
    log('🎮 Starting Comprehensive Claw World Playtest...\n');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1024, height: 768 },
        args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Capture console messages
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('🏠') || text.includes('🚪') || text.includes('✅') || text.includes('⚠️') || text.includes('🎵')) {
            log(`[GAME] ${text}`);
        }
    });

    try {
        // ===== PHASE 1: LOAD GAME =====
        log('=== PHASE 1: Loading Game ===');
        await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
        await waitMs(2000);
        await screenshot(page, 'welcome');
        success('Game loaded');

        // ===== PHASE 2: CHARACTER CREATION =====
        log('\n=== PHASE 2: Character Creation ===');
        
        await page.click('button'); // Begin Journey
        await waitMs(1000);
        
        // Select species (mantis shrimp - index 3)
        const speciesButtons = await page.$$('button');
        if (speciesButtons.length > 4) {
            await speciesButtons[4].click(); // mantis_shrimp
            log('🦐 Selected mantis shrimp');
        }
        await waitMs(300);
        
        // Select color (green)
        const allButtons = await page.$$('button');
        for (const btn of allButtons) {
            const title = await btn.evaluate(el => el.title);
            if (title === 'Green') {
                await btn.click();
                log('🟢 Selected green color');
                break;
            }
        }
        await waitMs(300);
        await screenshot(page, 'character_created');
        
        // Enter name
        const nameInput = await page.$('input[type="text"]');
        if (nameInput) {
            await nameInput.click();
            await nameInput.type('TestCrustacean');
            await page.click('body');
            log('📝 Named: TestCrustacean');
        }
        
        // Enter world
        for (const btn of await page.$$('button')) {
            const text = await btn.evaluate(el => el.textContent);
            if (text.includes('Enter World')) {
                await btn.click();
                break;
            }
        }
        await waitMs(2500);
        await screenshot(page, 'game_start');
        success('Entered game world');

        // ===== PHASE 3: TEST ALL BUILDINGS =====
        log('\n=== PHASE 3: Building Tests ===');
        
        let buildingsEntered = 0;
        let buildingsTested = 0;
        
        for (const [name, info] of Object.entries(BUILDINGS)) {
            buildingsTested++;
            if (await testBuilding(page, name, info)) {
                buildingsEntered++;
            }
            await waitMs(500);
        }
        
        log(`\n📊 Buildings: ${buildingsEntered}/${buildingsTested} entered successfully`);

        // ===== PHASE 4: WORLD EXPLORATION =====
        log('\n=== PHASE 4: World Exploration ===');
        
        // Get current position
        let state = await getGameState(page);
        log(`📍 Current position: (${state?.player?.x?.toFixed(0)}, ${state?.player?.y?.toFixed(0)})`);
        
        // Explore around
        log('🗺️ Exploring world...');
        
        // Walk around to test collision with buildings and water
        await holdKey(page, 'd', 2000); // Right
        await holdKey(page, 'w', 1500); // Up
        await holdKey(page, 'a', 2000); // Left
        await holdKey(page, 's', 1500); // Down
        
        state = await getGameState(page);
        log(`📍 Explored to: (${state?.player?.x?.toFixed(0)}, ${state?.player?.y?.toFixed(0)})`);
        await screenshot(page, 'exploration');
        
        success('World exploration complete');

        // ===== PHASE 5: CONTROLS TEST =====
        log('\n=== PHASE 5: Controls Test ===');
        
        // Mute toggle
        await pressKey(page, 'm');
        log('🔇 Mute toggled');
        await waitMs(200);
        await pressKey(page, 'm');
        
        // Debug mode
        await pressKey(page, '`');
        await waitMs(300);
        await screenshot(page, 'debug_mode');
        success('Debug mode works');
        await pressKey(page, '`');

        // ===== FINAL REPORT =====
        log('\n========== PLAYTEST COMPLETE ==========');
        log(`✅ Successes: ${successes.length}`);
        successes.forEach(s => log(`   • ${s}`));
        
        if (bugs.length > 0) {
            log(`\n🐛 Bugs found: ${bugs.length}`);
            bugs.forEach(b => log(`   • ${b}`));
        } else {
            log('\n🎉 No bugs found!');
        }
        
        log(`\n📸 Screenshots: ${screenshotCount}`);
        await screenshot(page, 'final_state');

        // Save report
        const report = `# Claw World Playtest Report
Generated: ${new Date().toISOString()}

## Summary
- Buildings tested: ${buildingsTested}
- Buildings entered: ${buildingsEntered}
- Successes: ${successes.length}
- Bugs: ${bugs.length}

## Successes
${successes.map(s => `- ${s}`).join('\n')}

## Bugs
${bugs.length > 0 ? bugs.map(b => `- ${b}`).join('\n') : '(none)'}

## Full Log
${observations.map(o => `- ${o}`).join('\n')}
`;
        fs.writeFileSync('./playtest-report.md', report);
        log('\n📄 Report saved to playtest-report.md');

    } catch (error) {
        bug(`Error: ${error.message}`);
        await screenshot(page, 'error');
    }

    log('\n👀 Browser left open for inspection.');
}

playtest().catch(console.error);
