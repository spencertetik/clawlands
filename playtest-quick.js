/**
 * Quick focused playtest - enter Inn, test NPC dialog, exit
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const GAME_URL = 'http://localhost:8080';
const SCREENSHOT_DIR = './playtest-screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

// Clear old screenshots
fs.readdirSync(SCREENSHOT_DIR).forEach(f => {
    if (f.endsWith('.png')) fs.unlinkSync(`${SCREENSHOT_DIR}/${f}`);
});

let shotCount = 0;
function log(msg) {
    console.log(`[${new Date().toISOString().substr(11, 8)}] ${msg}`);
}

async function shot(page, name) {
    shotCount++;
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${String(shotCount).padStart(2, '0')}_${name}.png` });
    log(`📸 ${name}`);
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

async function main() {
    log('🎮 Quick Playtest: Inn + NPC Dialog\n');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1024, height: 768 }
    });
    
    const page = await browser.newPage();
    
    page.on('console', msg => {
        const t = msg.text();
        if (t.includes('🏠') || t.includes('🚪') || t.includes('✅') || t.includes('💬')) {
            log(`[GAME] ${t}`);
        }
    });

    // Load game
    log('=== Loading Game ===');
    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await waitMs(2000);
    
    // Quick character creation
    log('=== Quick Character Creation ===');
    await page.click('button'); // Begin
    await waitMs(800);
    
    // Enter name and click enter world
    const nameInput = await page.$('input[type="text"]');
    if (nameInput) {
        await nameInput.click();
        await nameInput.type('Tester');
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
    await shot(page, 'game_start');
    
    let state = await getState(page);
    log(`📍 Start position: (${state?.player?.x?.toFixed(0)}, ${state?.player?.y?.toFixed(0)})`);
    log(`📍 Location: ${state?.location}`);
    
    // Navigate to Inn door
    // Inn at tile (30,60) = pixel (480, 960), size 96x72
    // Must go BELOW the Inn (y > 1032) then up to door
    log('\n=== Navigate to Inn ===');
    
    // Step 1: Go south first to get below building
    log('Step 1: Moving south to get below Inn...');
    await holdKey(page, 's', 1500); // Move down
    await waitMs(200);
    
    state = await getState(page);
    log(`📍 After south: (${state?.player?.x?.toFixed(0)}, ${state?.player?.y?.toFixed(0)})`);
    
    // Step 2: Move east to line up with door (door center x = 528)
    log('Step 2: Moving east to line up with door...');
    const TARGET_X = 520;
    for (let attempt = 0; attempt < 5; attempt++) {
        state = await getState(page);
        const px = state?.player?.x || 0;
        const dx = TARGET_X - px;
        
        if (Math.abs(dx) < 16) {
            log(`✅ Lined up with door at x=${px.toFixed(0)}`);
            break;
        }
        
        const key = dx > 0 ? 'd' : 'a';
        const time = Math.min(Math.abs(dx) * 15, 1500);
        await holdKey(page, key, time);
        await waitMs(100);
    }
    
    state = await getState(page);
    log(`📍 Lined up: (${state?.player?.x?.toFixed(0)}, ${state?.player?.y?.toFixed(0)})`)
    
    state = await getState(page);
    log(`📍 Final nav position: (${state?.player?.x?.toFixed(0)}, ${state?.player?.y?.toFixed(0)})`);
    await shot(page, 'at_door');
    
    // Walk UP into the door trigger
    log('Walking into Inn door (walking up)...');
    await holdKey(page, 'w', 1200);
    await waitMs(1000); // Wait for transition
    
    state = await getState(page);
    log(`📍 After walk - Location: ${state?.location}`);
    await shot(page, 'after_door_walk');
    
    if (state?.location === 'interior') {
        log('✅ ENTERED INN!');
        
        // Test NPC dialog
        log('\n=== Testing NPC Dialog ===');
        
        // Walk up toward NPC
        await holdKey(page, 'w', 400);
        await waitMs(300);
        
        await shot(page, 'near_npc');
        
        // Check if dialog prompt appears
        log('Pressing SPACE to talk...');
        await pressKey(page, ' ');
        await waitMs(500);
        
        state = await getState(page);
        if (state?.dialogOpen) {
            log('✅ DIALOG OPENED!');
            await shot(page, 'dialog_open');
            
            // Advance dialog
            for (let i = 0; i < 5; i++) {
                await pressKey(page, ' ');
                await waitMs(400);
                state = await getState(page);
                if (!state?.dialogOpen) {
                    log('✅ Dialog completed');
                    break;
                }
            }
        } else {
            log('⚠️ Dialog did not open - try moving closer');
            // Try walking closer and retrying
            await holdKey(page, 'w', 200);
            await waitMs(200);
            await pressKey(page, ' ');
            await waitMs(500);
            state = await getState(page);
            if (state?.dialogOpen) {
                log('✅ DIALOG OPENED (2nd try)!');
                await shot(page, 'dialog_open_2');
            } else {
                log('❌ Could not trigger NPC dialog');
            }
        }
        
        // Exit building
        log('\n=== Exiting Building ===');
        await holdKey(page, 's', 1500);
        await waitMs(800);
        
        state = await getState(page);
        log(`📍 After exit - Location: ${state?.location}`);
        await shot(page, 'after_exit');
        
        if (state?.location === 'outdoor') {
            log('✅ EXITED SUCCESSFULLY!');
        }
        
    } else {
        log('⚠️ Did not enter Inn, trying again...');
        
        // Try walking up more
        await holdKey(page, 'w', 500);
        await waitMs(800);
        
        state = await getState(page);
        log(`📍 Retry - Location: ${state?.location}`);
        await shot(page, 'retry_entry');
        
        if (state?.location === 'interior') {
            log('✅ ENTERED on retry!');
        } else {
            log('❌ Could not enter Inn');
        }
    }
    
    log('\n=== PLAYTEST COMPLETE ===');
    await shot(page, 'final');
    log(`📸 Total screenshots: ${shotCount}`);
    
    // Always close browser when done
    await browser.close();
    log('🧹 Browser closed');
}

// Ensure browser closes even on error
process.on('unhandledRejection', async () => {
    process.exit(1);
});

main().catch(console.error);
