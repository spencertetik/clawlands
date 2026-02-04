/**
 * Video playtest - captures gameplay frames and converts to video
 * Uses sequential screenshots for reliability
 */

const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const GAME_URL = 'http://localhost:8080';
const VIDEO_DIR = 'playtest-videos';
const FRAMES_DIR = path.join(VIDEO_DIR, 'frames');
const FRAME_RATE = 10; // Lower for reliable capture

async function captureVideo() {
    // Ensure directories exist
    if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
    if (fs.existsSync(FRAMES_DIR)) {
        fs.readdirSync(FRAMES_DIR).forEach(f => fs.unlinkSync(path.join(FRAMES_DIR, f)));
    } else {
        fs.mkdirSync(FRAMES_DIR, { recursive: true });
    }

    console.log('🎬 Starting video capture playtest...');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 640, height: 480 },
        args: ['--window-size=660,520']
    });

    const page = await browser.newPage();
    let frameNum = 0;
    
    async function captureFrame() {
        const framePath = path.join(FRAMES_DIR, `frame_${String(frameNum).padStart(4, '0')}.png`);
        await page.screenshot({ path: framePath });
        frameNum++;
    }
    
    try {
        // Navigate to game
        await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('✅ Game loaded');
        
        // Wait for game to initialize
        await page.waitForSelector('canvas', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 2000));
        console.log('✅ Game ready');
        
        console.log('🎥 Recording gameplay...');
        
        // Capture initial state
        await captureFrame();
        
        // Walk down
        await page.keyboard.down('ArrowDown');
        for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 100));
            await captureFrame();
        }
        await page.keyboard.up('ArrowDown');
        
        // Walk right
        await page.keyboard.down('ArrowRight');
        for (let i = 0; i < 12; i++) {
            await new Promise(r => setTimeout(r, 100));
            await captureFrame();
        }
        await page.keyboard.up('ArrowRight');
        
        // Walk up toward building
        await page.keyboard.down('ArrowUp');
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 100));
            await captureFrame();
        }
        await page.keyboard.up('ArrowUp');
        
        // Try to enter
        await page.keyboard.down('ArrowUp');
        for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 100));
            await captureFrame();
        }
        await page.keyboard.up('ArrowUp');
        
        // Capture result
        await new Promise(r => setTimeout(r, 500));
        await captureFrame();
        
        // If inside, interact and move
        await page.keyboard.press('Space');
        await new Promise(r => setTimeout(r, 300));
        await captureFrame();
        
        // Walk around inside
        await page.keyboard.down('ArrowLeft');
        for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 100));
            await captureFrame();
        }
        await page.keyboard.up('ArrowLeft');
        
        await page.keyboard.down('ArrowDown');
        for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 100));
            await captureFrame();
        }
        await page.keyboard.up('ArrowDown');
        
        // Final frames
        for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 200));
            await captureFrame();
        }
        
        console.log(`📸 Captured ${frameNum} frames`);
        
        // Close browser BEFORE converting
        await browser.close();
        
        // Convert frames to video
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const videoPath = path.join(VIDEO_DIR, `gameplay_${timestamp}.mp4`);
        
        console.log('🎞️ Converting to video...');
        
        try {
            execSync(`ffmpeg -y -framerate ${FRAME_RATE} -i "${FRAMES_DIR}/frame_%04d.png" -c:v libx264 -pix_fmt yuv420p -crf 23 "${videoPath}"`, {
                stdio: 'pipe'
            });
            console.log(`✅ Video saved: ${videoPath}`);
        } catch (e) {
            console.log('⚠️ ffmpeg conversion failed, keeping frames');
        }
        
        console.log('🎬 Video capture complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await browser.close();
    }
}

captureVideo();
