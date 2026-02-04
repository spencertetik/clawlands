const { chromium } = require('playwright');

async function finalCheck() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
    
    console.log('Loading game with debug=true...');
    await page.goto('https://claw-world-rpg.netlify.app?quickStart=true&debug=true', { 
        waitUntil: 'networkidle', 
        timeout: 30000 
    });
    await page.waitForTimeout(3000);
    
    // Take spawn screenshot
    await page.screenshot({ path: 'final-check/01-spawn.png' });
    console.log('01 - spawn');
    
    // Go find buildings
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(20);
    }
    for (let i = 0; i < 30; i++) {
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(20);
    }
    await page.screenshot({ path: 'final-check/02-northwest.png' });
    console.log('02 - northwest');
    
    // Continue searching
    for (let i = 0; i < 60; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(20);
    }
    await page.screenshot({ path: 'final-check/03-north.png' });
    console.log('03 - north');
    
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(20);
    }
    await page.screenshot({ path: 'final-check/04-east.png' });
    console.log('04 - east');
    
    // South to find buildings
    for (let i = 0; i < 50; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(20);
    }
    await page.screenshot({ path: 'final-check/05-south.png' });
    console.log('05 - south');
    
    await browser.close();
    console.log('Done!');
}

finalCheck().catch(e => console.error(e));
