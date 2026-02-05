const { chromium } = require('playwright');
async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 750 } });
    
    // Capture console logs
    const logs = [];
    page.on('console', msg => {
        if (msg.text().includes('🛤️') || msg.text().includes('🚶') || msg.text().includes('🌉') || msg.text().includes('🌊')) {
            logs.push(msg.text());
        }
    });
    
    console.log('Loading game...');
    await page.goto('https://claw-world-rpg.netlify.app?quickStart=true', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);
    
    console.log('\n--- Console Logs ---');
    logs.forEach(log => console.log(log));
    console.log('--- End Logs ---\n');
    
    // Take screenshots
    await page.screenshot({ path: 'full-test/01-spawn.png' });
    console.log('01 - spawn');
    
    // Walk to buildings area
    for (let i = 0; i < 50; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(20); }
    for (let i = 0; i < 20; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(20); }
    await page.screenshot({ path: 'full-test/02-near-buildings.png' });
    console.log('02 - near buildings');
    
    // Look for paths around buildings
    for (let i = 0; i < 30; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(20); }
    await page.screenshot({ path: 'full-test/03-searching.png' });
    console.log('03 - searching');
    
    await browser.close();
    console.log('Done!');
}
test().catch(e => console.error(e));
