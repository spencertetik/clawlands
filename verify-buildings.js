const { chromium } = require('playwright');

async function verifyBuildings() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
    
    console.log('Loading game with quickStart...');
    await page.goto('https://claw-world-rpg.netlify.app?quickStart=true&debug=true', { 
        waitUntil: 'networkidle', 
        timeout: 30000 
    });
    
    // Wait for game to load
    await page.waitForTimeout(3000);
    
    // Take spawn screenshot with debug mode
    await page.screenshot({ path: 'verify-screenshots/01-spawn-debug.png' });
    console.log('01 - Spawn with debug');
    
    // Walk to find buildings - north
    for (let i = 0; i < 60; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(25);
    }
    await page.screenshot({ path: 'verify-screenshots/02-north.png' });
    console.log('02 - North');
    
    // West to find buildings
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(25);
    }
    await page.screenshot({ path: 'verify-screenshots/03-west.png' });
    console.log('03 - West');
    
    // More north
    for (let i = 0; i < 50; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(25);
    }
    await page.screenshot({ path: 'verify-screenshots/04-more-north.png' });
    console.log('04 - More north');
    
    // East to explore
    for (let i = 0; i < 80; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(25);
    }
    await page.screenshot({ path: 'verify-screenshots/05-east.png' });
    console.log('05 - East');
    
    // South
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(25);
    }
    await page.screenshot({ path: 'verify-screenshots/06-south.png' });
    console.log('06 - South');
    
    await browser.close();
    console.log('Done! Check verify-screenshots/');
}

verifyBuildings().catch(e => console.error(e));
