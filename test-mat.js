const { chromium } = require('playwright');
async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
    await page.goto('https://claw-world-rpg.netlify.app?quickStart=true', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    // Find the inn
    for (let i = 0; i < 40; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(20); }
    for (let i = 0; i < 20; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(20); }
    for (let i = 0; i < 30; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(20); }
    await page.screenshot({ path: 'test-mat.png' });
    console.log('Screenshot saved');
    await browser.close();
}
test().catch(e => console.error(e));
