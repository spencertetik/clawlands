const { chromium } = require('playwright');

async function checkBuildings() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
    
    console.log('Loading game...');
    await page.goto('https://claw-world-rpg.netlify.app?quickStart=true', { 
        waitUntil: 'networkidle', 
        timeout: 30000 
    });
    await page.waitForTimeout(3000);
    
    // Enable debug mode (press backtick multiple times to make sure)
    console.log('Enabling debug mode...');
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(200);
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(200);
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(500);
    
    // Screenshot at spawn
    await page.screenshot({ path: 'building-check/01-spawn.png' });
    console.log('01 - spawn');
    
    // Go find buildings - head to center of main island
    // North first
    for (let i = 0; i < 30; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(20);
    }
    await page.screenshot({ path: 'building-check/02-north.png' });
    console.log('02 - north');
    
    // Northwest - where buildings often spawn
    for (let i = 0; i < 25; i++) {
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(20);
    }
    for (let i = 0; i < 25; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(20);
    }
    await page.screenshot({ path: 'building-check/03-northwest.png' });
    console.log('03 - northwest');
    
    // Look for more buildings
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(20);
    }
    await page.screenshot({ path: 'building-check/04-east.png' });
    console.log('04 - east');
    
    // More north
    for (let i = 0; i < 30; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(20);
    }
    await page.screenshot({ path: 'building-check/05-more-north.png' });
    console.log('05 - more north');
    
    // West again
    for (let i = 0; i < 50; i++) {
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(20);
    }
    await page.screenshot({ path: 'building-check/06-west.png' });
    console.log('06 - west');
    
    await browser.close();
    console.log('Done! Screenshots in building-check/');
}

checkBuildings().catch(e => console.error(e));
