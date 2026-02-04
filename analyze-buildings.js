const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function analyzeBuildings() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
    
    // Create screenshots directory
    const screenshotDir = path.join(__dirname, 'analysis-screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    console.log('🎮 Loading game...');
    await page.goto('http://localhost:9001?mp=false&debug=true', { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log('⏳ Waiting for game to load...');
    await page.waitForTimeout(3000);
    
    // Click the PLAY button
    console.log('📍 Clicking Play button...');
    try {
        await page.click('button:has-text("PLAY")');
        console.log('✅ Clicked Play');
        await page.waitForTimeout(2000);
    } catch (e) {
        console.log('⚠️ Could not find Play button, trying to click by position');
        // The Play button appears to be in the center of the screen
        await page.mouse.click(559, 361);
        await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: path.join(screenshotDir, '01-after-play.png'), fullPage: true });

    // Now we should be on character creation or in game
    // Keep pressing Enter to get through character creation
    console.log('📍 Pressing Enter to skip character creation...');
    for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(400);
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(screenshotDir, '02-in-game.png'), fullPage: true });

    // Enable debug mode with backtick
    console.log('🔧 Enabling debug mode...');
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '03-debug-mode.png'), fullPage: true });

    // Walk around to find buildings
    console.log('🚶 Walking north to find buildings...');
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(40);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '04-north.png'), fullPage: true });

    // Walk west
    console.log('🚶 Walking west...');
    for (let i = 0; i < 25; i++) {
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(40);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '05-west.png'), fullPage: true });

    // Walk more north
    for (let i = 0; i < 30; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(40);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '06-more-north.png'), fullPage: true });

    // Walk east to explore more
    for (let i = 0; i < 50; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(40);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '07-east.png'), fullPage: true });

    // Walk south
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(40);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, '08-south.png'), fullPage: true });

    console.log('✅ Screenshots saved to analysis-screenshots/');
    await browser.close();
}

analyzeBuildings().catch(console.error);
