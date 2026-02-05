const { chromium } = require('playwright');
async function verify() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 750 } });
    await page.goto('https://claw-world-rpg.netlify.app?quickStart=true', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);
    
    // Screenshot at spawn - should see decorations
    await page.screenshot({ path: 'update-verify/01-spawn.png' });
    console.log('01 - spawn area with decorations');
    
    // Walk to find buildings and paths
    for (let i = 0; i < 40; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(25); }
    for (let i = 0; i < 30; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(25); }
    await page.screenshot({ path: 'update-verify/02-exploring.png' });
    console.log('02 - exploring with NPCs');
    
    // Find more area
    for (let i = 0; i < 50; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(25); }
    await page.screenshot({ path: 'update-verify/03-more-area.png' });
    console.log('03 - more area');
    
    await browser.close();
    console.log('Done! Check update-verify/');
}
verify().catch(e => console.error(e));
