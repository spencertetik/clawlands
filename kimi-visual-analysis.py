#!/usr/bin/env python3
"""
Kimi K2.5 Visual Analysis for Claw World
Captures game screenshots and sends them to Kimi for visual bug detection
"""

import openai
import base64
import os
import sys
import subprocess
import time
import json
from pathlib import Path

# Config
NVIDIA_API_KEY = os.environ.get('NVIDIA_API_KEY')
MODEL_NAME = 'moonshotai/kimi-k2.5'
SCREENSHOT_DIR = Path('./kimi-screenshots')
GAME_URL = 'http://localhost:8080'

def setup_client():
    """Setup OpenAI client for NVIDIA NIM"""
    if not NVIDIA_API_KEY:
        print("❌ NVIDIA_API_KEY environment variable not set")
        print("   Get your key from: https://build.nvidia.com/moonshotai/kimi-k2.5")
        print("   Then run: export NVIDIA_API_KEY='your-key-here'")
        sys.exit(1)
    
    return openai.OpenAI(
        api_key=NVIDIA_API_KEY,
        base_url="https://integrate.api.nvidia.com/v1"
    )

def encode_image(image_path):
    """Encode image to base64"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def analyze_image(client, image_path, prompt, use_thinking=True):
    """Send image to Kimi for analysis"""
    print(f"\n🔍 Analyzing: {image_path}")
    print(f"   Prompt: {prompt[:80]}...")
    
    base64_image = encode_image(image_path)
    
    messages = [
        {
            'role': 'system',
            'content': '''You are a pixel art game visual debugger. Analyze game screenshots for:
- Sprite alignment issues (misaligned characters, buildings, UI elements)
- Scaling problems (sprites too big/small, inconsistent sizes)
- Z-ordering issues (things drawn in wrong order)
- Collision box mismatches (visual vs actual)
- Animation frame issues (wrong frames, jerky movement)
- Color/palette problems
- Layout issues (overlapping elements, poor spacing)
- Missing or broken visual elements

Be specific about pixel coordinates and measurements when possible.
Focus on actionable issues a developer can fix.'''
        },
        {
            'role': 'user',
            'content': [
                {'type': 'text', 'text': prompt},
                {
                    'type': 'image_url',
                    'image_url': {
                        'url': f'data:image/png;base64,{base64_image}'
                    }
                }
            ]
        }
    ]
    
    extra_body = {} if use_thinking else {'thinking': {'type': 'disabled'}}
    
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            stream=False,
            max_tokens=4096,
            **({'extra_body': extra_body} if extra_body else {})
        )
        
        result = {
            'content': response.choices[0].message.content,
            'reasoning': getattr(response.choices[0].message, 'reasoning_content', None)
        }
        
        if result['reasoning']:
            print("\n📝 Reasoning:")
            print(result['reasoning'][:500] + "..." if len(result['reasoning']) > 500 else result['reasoning'])
        
        print("\n💡 Analysis:")
        print(result['content'])
        
        return result
        
    except Exception as e:
        print(f"❌ API Error: {e}")
        return None

def capture_screenshots():
    """Use Puppeteer to capture game screenshots"""
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    
    # Node.js script to capture screenshots
    capture_script = '''
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: { width: 800, height: 600 }
    });
    const page = await browser.newPage();
    
    console.log('Loading game...');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Screenshot 1: Welcome screen
    console.log('📸 Capturing welcome screen...');
    await page.screenshot({ path: './kimi-screenshots/01_welcome.png' });
    
    // Quick character creation
    try {
        await page.click('button');
        await new Promise(r => setTimeout(r, 500));
        
        const nameInput = await page.$('input[type="text"]');
        if (nameInput) {
            await nameInput.type('TestCrab');
        }
        
        // Find and click Enter World
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await btn.evaluate(el => el.textContent);
            if (text.includes('Enter World')) {
                await btn.click();
                break;
            }
        }
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
        console.log('Character creation skipped (may be returning player)');
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Screenshot 2: Initial game view
    console.log('📸 Capturing game view...');
    await page.screenshot({ path: './kimi-screenshots/02_game_view.png' });
    
    // Walk around to show character animation
    const holdKey = async (key, ms) => {
        await page.keyboard.down(key);
        await new Promise(r => setTimeout(r, ms));
        await page.keyboard.up(key);
    };
    
    // Screenshot 3: Walking (try to capture mid-animation)
    console.log('📸 Capturing character walking...');
    await page.keyboard.down('d');
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: './kimi-screenshots/03_walking_right.png' });
    await new Promise(r => setTimeout(r, 300));
    await page.keyboard.up('d');
    
    // Screenshot 4: Near a building
    console.log('📸 Navigating near buildings...');
    await holdKey('s', 1500);
    await holdKey('d', 1000);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: './kimi-screenshots/04_near_building.png' });
    
    // Try to enter a building
    console.log('📸 Attempting building entry...');
    await holdKey('w', 1500);
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: './kimi-screenshots/05_building_attempt.png' });
    
    // Check if we're inside
    const state = await page.evaluate(() => window.game?.currentLocation);
    if (state === 'interior') {
        console.log('📸 Inside building!');
        await page.screenshot({ path: './kimi-screenshots/06_interior.png' });
    }
    
    // Enable debug mode and screenshot
    console.log('📸 Enabling debug mode...');
    await page.keyboard.press('Backquote');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: './kimi-screenshots/07_debug_mode.png' });
    
    console.log('✅ Screenshots captured!');
    await browser.close();
})();
'''
    
    script_path = SCREENSHOT_DIR / 'capture.js'
    script_path.write_text(capture_script)
    
    print("📷 Capturing game screenshots...")
    result = subprocess.run(
        ['node', str(script_path)],
        cwd=str(Path('.').absolute()),
        capture_output=True,
        text=True,
        timeout=60
    )
    
    if result.returncode != 0:
        print(f"⚠️ Capture warnings: {result.stderr}")
    
    print(result.stdout)
    
    # Return list of captured screenshots
    screenshots = sorted(SCREENSHOT_DIR.glob('*.png'))
    print(f"📸 Captured {len(screenshots)} screenshots")
    return screenshots

def main():
    print("🦀 Kimi K2.5 Visual Analysis for Claw World")
    print("=" * 50)
    
    client = setup_client()
    
    # Check if screenshots already exist or capture new ones
    existing = list(SCREENSHOT_DIR.glob('*.png')) if SCREENSHOT_DIR.exists() else []
    
    if existing and len(existing) >= 3:
        print(f"Found {len(existing)} existing screenshots. Use these? (y/n/capture)")
        choice = input().strip().lower()
        if choice == 'capture' or choice == 'n':
            screenshots = capture_screenshots()
        else:
            screenshots = sorted(existing)
    else:
        screenshots = capture_screenshots()
    
    if not screenshots:
        print("❌ No screenshots to analyze")
        return
    
    # Analysis prompts for different screenshot types
    prompts = {
        'welcome': "Analyze this game welcome/title screen. Check for: text readability, button alignment, visual balance, any pixel art issues, overall UI layout quality.",
        'game_view': "Analyze this top-down pixel art game view. Check for: character sprite quality and scaling, tile alignment, building placement, any visual glitches or misalignments.",
        'walking': "Analyze this character walking animation frame. Check for: sprite scaling consistency, animation smoothness indicators, direction sprite correctness, any visual artifacts.",
        'building': "Analyze this view showing buildings. Check for: building sprite alignment, door positions, doormat placement, collision indicator alignment (if visible), z-ordering of sprites.",
        'interior': "Analyze this building interior view. Check for: wall alignment, floor tile consistency, furniture placement, exit marker visibility, overall room layout.",
        'debug': "Analyze this debug view showing collision boxes/triggers. Check for: alignment between visual sprites and collision boxes, trigger zone sizes, any obvious mismatches between visuals and hitboxes."
    }
    
    # Analyze each screenshot
    results = []
    for screenshot in screenshots:
        name = screenshot.stem.lower()
        
        # Pick appropriate prompt
        if 'welcome' in name:
            prompt = prompts['welcome']
        elif 'walking' in name:
            prompt = prompts['walking']
        elif 'interior' in name:
            prompt = prompts['interior']
        elif 'debug' in name:
            prompt = prompts['debug']
        elif 'building' in name or 'door' in name:
            prompt = prompts['building']
        else:
            prompt = prompts['game_view']
        
        result = analyze_image(client, screenshot, prompt, use_thinking=True)
        if result:
            results.append({
                'screenshot': str(screenshot),
                'analysis': result
            })
        
        # Small delay between API calls
        time.sleep(1)
    
    # Save results
    report_path = SCREENSHOT_DIR / 'analysis_report.json'
    with open(report_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Analysis complete! Report saved to: {report_path}")
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 SUMMARY")
    print("=" * 50)
    for r in results:
        print(f"\n📸 {Path(r['screenshot']).name}:")
        content = r['analysis']['content']
        # Print first 300 chars of each analysis
        print(f"   {content[:300]}..." if len(content) > 300 else f"   {content}")

if __name__ == '__main__':
    main()
