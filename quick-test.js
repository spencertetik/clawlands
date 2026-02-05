const { chromium } = require('playwright');
async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 750 } });
    await page.goto('https://claw-world-rpg.netlify.app?quickStart=true', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Walk around to see paths
    for (let i = 0; i < 40; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(25); }
    await page.screenshot({ path: 'quick-test.png' });
    console.log('Screenshot saved');
    await browser.close();
}
test().catch(e => console.error(e));
