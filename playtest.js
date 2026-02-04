/**
 * Automated Playtest for Claw World
 * Plays through the game and reports on mechanics
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const GAME_URL = 'http://localhost:8080';
const SCREENSHOT_DIR = './playtest-screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR);
}

let screenshotCount = 0;
const observations = [];

function log(msg) {
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`[${timestamp}] ${msg}`);
    observations.push(msg);
}

async function screenshot(page, name) {
    screenshotCount++;
    const filename = `${SCREENSHOT_DIR}/${String(screenshotCount).padStart(2, '0')}_${name}.png`;
    await page.screenshot({ path: filename });
    log(`📸 Screenshot: ${filename}`);
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

async function playtest() {
    log('🎮 Starting Claw World Playtest...');
    
    const browser = await puppeteer.launch({
        headless: false, // Watch it play!
        defaultViewport: { width: 1024, height: 768 },
        args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Listen for console messages
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('🏠') || text.includes('🚪') || text.includes('✅') || text.includes('⚠️')) {
            log(`[GAME] ${text}`);
        }
    });

    try {
        // PHASE 1: Load game
        log('\n=== PHASE 1: Loading Game ===');
        await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
        await waitMs(2000);
        await screenshot(page, 'welcome_screen');
        
        // Check if welcome screen loaded
        const welcomeTitle = await page.$eval('h1', el => el?.textContent).catch(() => null);
        if (welcomeTitle?.includes('CLAW WORLD')) {
            log('✅ Welcome screen loaded correctly');
        } else {
            log('⚠️ Welcome screen may have issues');
        }

        // PHASE 2: Character Creation
        log('\n=== PHASE 2: Character Creation ===');
        
        // Click "Begin Your Journey"
        await page.click('button');
        await waitMs(1000);
        await screenshot(page, 'character_creation');
        
        // Try selecting a different species (click second species button)
        const speciesButtons = await page.$$('button');
        if (speciesButtons.length > 3) {
            await speciesButtons[2].click(); // Select crab
            log('🦀 Selected crab species');
            await waitMs(500);
        }
        
        // Select a color (click a color button)
        const allButtons = await page.$$('button');
        for (const btn of allButtons) {
            const title = await btn.evaluate(el => el.title);
            if (title === 'Blue') {
                await btn.click();
                log('🔵 Selected blue color');
                break;
            }
        }
        await waitMs(500);
        await screenshot(page, 'character_customized');
        
        // Enter name
        const nameInput = await page.$('input[type="text"]');
        if (nameInput) {
            await nameInput.click();
            await nameInput.type('PlaytestBot');
            log('📝 Entered name: PlaytestBot');
            // Blur the input so movement keys don't get captured
            await page.click('body');
            await waitMs(100);
        }
        
        // Click Enter World - find button containing "Enter"
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await btn.evaluate(el => el.textContent);
            if (text.includes('Enter World')) {
                await btn.click();
                log('🌍 Clicked Enter World button');
                break;
            }
        }
        
        await waitMs(2000); // Wait for transition + game load
        await screenshot(page, 'game_start');

        // PHASE 3: Explore the World
        log('\n=== PHASE 3: World Exploration ===');
        
        // Get initial game state
        let state = await getGameState(page);
        if (state) {
            log(`📍 Starting position: (${state.player?.x?.toFixed(0)}, ${state.player?.y?.toFixed(0)})`);
            log(`🏠 Buildings nearby: ${state.buildings || 0}`);
        }
        
        // Move around to explore
        log('🚶 Testing movement...');
        
        // Move right
        await holdKey(page, 'd', 1000);
        await screenshot(page, 'moved_right');
        
        // Move down
        await holdKey(page, 's', 1000);
        await screenshot(page, 'moved_down');
        
        // Move left
        await holdKey(page, 'a', 500);
        
        // Move up
        await holdKey(page, 'w', 500);
        
        state = await getGameState(page);
        if (state) {
            log(`📍 Position after movement: (${state.player?.x?.toFixed(0)}, ${state.player?.y?.toFixed(0)})`);
            log(`   Moving: ${state.player?.moving}`);
            log(`   Direction: ${state.player?.direction}`);
        }

        // PHASE 4: Find and Enter a Building
        log('\n=== PHASE 4: Building Interaction ===');
        
        // The Inn is at tile (30,60) = pixel (480, 960)
        // Inn is 96x72, so bottom is at y=1032
        // Door X offset for Inn is 20, so door center is at x=500
        // Trigger zone extends below the building
        
        // Get current position
        state = await getGameState(page);
        const startX = state?.player?.x || 456;
        const startY = state?.player?.y || 1000;
        log(`📍 Current position: (${startX.toFixed(0)}, ${startY.toFixed(0)})`);
        
        // Inn door is around (500, 1032)
        // Navigate to position the player at the door
        const targetX = 500;
        const targetY = 1040; // Just below door
        
        const dx = targetX - startX;
        const dy = targetY - startY;
        
        log(`🎯 Navigating to Inn door at (${targetX}, ${targetY})`);
        
        // Move horizontally first
        if (dx > 0) {
            const moveTime = Math.abs(dx) * 10; // Roughly 100px/sec
            log(`   Moving right for ${moveTime}ms`);
            await holdKey(page, 'd', moveTime);
        } else if (dx < 0) {
            const moveTime = Math.abs(dx) * 10;
            log(`   Moving left for ${moveTime}ms`);
            await holdKey(page, 'a', moveTime);
        }
        await waitMs(200);
        
        // Move vertically
        if (dy > 0) {
            const moveTime = Math.abs(dy) * 10;
            log(`   Moving down for ${moveTime}ms`);
            await holdKey(page, 's', moveTime);
        } else if (dy < 0) {
            const moveTime = Math.abs(dy) * 10;
            log(`   Moving up for ${moveTime}ms`);
            await holdKey(page, 'w', moveTime);
        }
        await waitMs(200);
        
        // Check position
        state = await getGameState(page);
        log(`📍 Position after navigation: (${state?.player?.x?.toFixed(0)}, ${state?.player?.y?.toFixed(0)})`);
        
        // Now walk up into the door trigger zone
        log('🚶 Walking into door trigger...');
        await holdKey(page, 'w', 800);
        await waitMs(500);
        
        // Check if we entered
        state = await getGameState(page);
        if (state?.location !== 'interior') {
            // Try again - walk up more
            log('🔄 Retrying entry...');
            await holdKey(page, 'w', 600);
            await waitMs(500);
            state = await getGameState(page);
        }
        
        // Screenshot current state
        await screenshot(page, 'at_inn_door')
        
        // Check if we're inside
        state = await getGameState(page);
        if (state?.location === 'interior') {
            log('✅ Successfully entered building');
            
            // Try to talk to NPC
            log('💬 Attempting to interact with NPC (Space)...');
            await pressKey(page, ' ');
            await waitMs(500);
            await screenshot(page, 'npc_interaction');
            
            // Advance dialog
            for (let i = 0; i < 3; i++) {
                await pressKey(page, ' ');
                await waitMs(300);
            }
            
            // Exit building
            log('🚪 Attempting to exit building...');
            await holdKey(page, 's', 1500);
            await waitMs(500);
            await screenshot(page, 'exited_building');
            
            state = await getGameState(page);
            log(`   Location after exit: ${state?.location || 'unknown'}`);
        } else {
            log('⚠️ Could not find building entrance');
            await screenshot(page, 'searching_for_building');
        }

        // PHASE 5: Test Audio
        log('\n=== PHASE 5: Audio Controls ===');
        await pressKey(page, 'm');
        log('🔇 Pressed M to toggle mute');
        await waitMs(500);
        await pressKey(page, 'm');
        log('🔊 Pressed M to unmute');

        // PHASE 6: Debug Mode
        log('\n=== PHASE 6: Debug Mode ===');
        await pressKey(page, '`');
        await waitMs(500);
        await screenshot(page, 'debug_mode');
        log('🔧 Enabled debug mode (backtick)');
        
        state = await getGameState(page);
        if (state) {
            log(`   Debug state - Buildings: ${state.buildings}, NPCs: ${state.npcs}`);
        }
        
        await pressKey(page, '`');
        log('🔧 Disabled debug mode');

        // PHASE 7: Final Assessment
        log('\n=== PLAYTEST COMPLETE ===');
        await screenshot(page, 'final_state');
        
        // Write observations to file
        const report = `
# Claw World Playtest Report
Generated: ${new Date().toISOString()}

## Observations
${observations.map(o => `- ${o}`).join('\n')}

## Screenshots
${screenshotCount} screenshots saved to ${SCREENSHOT_DIR}/
        `;
        
        fs.writeFileSync('./playtest-report.md', report);
        log('📄 Report saved to playtest-report.md');

    } catch (error) {
        log(`❌ Error: ${error.message}`);
        await screenshot(page, 'error_state');
    }

    // Keep browser open for manual inspection
    log('\n👀 Browser left open for inspection. Close manually when done.');
    // await browser.close();
}

playtest().catch(console.error);
