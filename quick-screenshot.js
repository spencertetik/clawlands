const { chromium } = require('playwright');

async function screenshot() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
    
    console.log('Loading game...');
    await page.goto('https://claw-world-rpg.netlify.app', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Click Play button
    await page.click('button:has-text("PLAY")').catch(() => {});
    await page.waitForTimeout(1500);
    
    // Spam Enter/Space to get through character creation
    for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2000);
    
    // Enable debug mode
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(300);
    
    // Take spawn screenshot
    await page.screenshot({ path: 'debug-screenshots/01-spawn.png' });
    console.log('Saved 01-spawn.png');
    
    // Walk north to find buildings
    for (let i = 0; i < 50; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(30);
    }
    await page.screenshot({ path: 'debug-screenshots/02-north.png' });
    console.log('Saved 02-north.png');
    
    // Walk west
    for (let i = 0; i < 30; i++) {
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(30);
    }
    await page.screenshot({ path: 'debug-screenshots/03-west.png' });
    console.log('Saved 03-west.png');
    
    // Walk more north
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(30);
    }
    await page.screenshot({ path: 'debug-screenshots/04-more-north.png' });
    console.log('Saved 04-more-north.png');
    
    // Walk east
    for (let i = 0; i < 60; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(30);
    }
    await page.screenshot({ path: 'debug-screenshots/05-east.png' });
    console.log('Saved 05-east.png');
    
    // South
    for (let i = 0; i < 30; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(30);
    }
    await page.screenshot({ path: 'debug-screenshots/06-south.png' });
    console.log('Saved 06-south.png');
    
    await browser.close();
    console.log('Done!');
}

screenshot().catch(e => console.error(e));
