const { chromium } = require('playwright');
async function check() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 750 } });
    await page.goto('https://claw-world-rpg.netlify.app?quickStart=true', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait longer for NPCs to start moving
    
    await page.screenshot({ path: 'fix-check/01-initial.png' });
    console.log('01 - initial (NPCs should be moving)');
    
    // Walk around to see paths and bridges
    for (let i = 0; i < 30; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(30); }
    await page.waitForTimeout(2000); // Watch for NPC movement
    await page.screenshot({ path: 'fix-check/02-after-wait.png' });
    console.log('02 - after waiting (check NPC positions changed)');
    
    // Try to find a bridge - go to edge of island
    for (let i = 0; i < 60; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(25); }
    await page.screenshot({ path: 'fix-check/03-looking-for-bridge.png' });
    console.log('03 - looking for bridge');
    
    await browser.close();
    console.log('Done!');
}
check().catch(e => console.error(e));
