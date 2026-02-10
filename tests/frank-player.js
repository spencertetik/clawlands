/**
 * Frank Player Bot — Plays Clawlands for real via headless Playwright browser
 * 
 * This bot loads the actual game client, creates a character, and plays
 * through keyboard/mouse inputs. Everything it does is visible to spectators
 * because it's a real game client connected to multiplayer.
 * 
 * Usage:
 *   node tests/frank-player.js
 *   HEADLESS=false node tests/frank-player.js  (watch the browser)
 */

const { chromium } = require('playwright');

const GAME_URL = process.env.GAME_URL || 'https://claw-world.netlify.app/game.html';
const HEADLESS = process.env.HEADLESS !== 'false'; // Default headless

// ============================================
// Bot Brain — Decision-making AI
// ============================================

class BotBrain {
    constructor() {
        this.state = 'exploring'; // exploring, combat, talking, shopping, resting, traveling
        this.tickCount = 0;
        this.lastAction = '';
        this.lastActionTime = 0;
        this.explorationDir = 0; // 0-7 compass directions
        this.targetNPC = null;
        this.targetBuilding = null;
        this.stuckCounter = 0;
        this.lastPosition = { x: 0, y: 0 };
        this.visitedBuildings = new Set();
        this.talkedToNPCs = new Set();
        this.combatKills = 0;
        this.exploreTicks = 0;
        this.directionChangeTimer = 0;
        this.currentDirection = 'south';
        this.wanderAngle = 0;
    }

    /**
     * Decide what to do based on current game state
     * Returns an action object: { type, params }
     */
    decide(gameState) {
        if (!gameState || gameState.error) return { type: 'wait' };
        
        this.tickCount++;
        
        // Check if stuck
        const pos = gameState.player?.position;
        if (pos) {
            const dx = pos.pixelX - this.lastPosition.x;
            const dy = pos.pixelY - this.lastPosition.y;
            if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
                this.stuckCounter++;
            } else {
                this.stuckCounter = 0;
                this.unstickAttempts = 0;
            }
            this.lastPosition = { x: pos.pixelX, y: pos.pixelY };
        }
        
        // Priority 1: Handle active dialog
        if (gameState.dialog) {
            return { type: 'advance_dialog' };
        }
        
        // Priority 2: Resolve UI showing (enemy killed, choose what to do)
        if (gameState.combat && gameState.combat.resolveVisible) {
            return { type: 'resolve_choice' };
        }
        
        // Priority 3: Nearby enemies — fight them!
        if (gameState.combat && gameState.combat.enemiesNearby > 0) {
            this.state = 'combat';
            this.combatTicks = (this.combatTicks || 0) + 1;
            // Pattern: attack 2x, dodge 1x, repeat
            if (this.combatTicks % 4 === 0) {
                // Dodge: move toward the enemy then away
                const dirs = ['north', 'south', 'east', 'west'];
                return { type: 'walk', direction: dirs[Math.floor(Math.random() * 4)] };
            }
            return { type: 'attack' };
        } else {
            this.combatTicks = 0;
        }
        
        // Priority 3: If stuck, try increasingly varied directions
        if (this.stuckCounter > 5) {
            this.stuckCounter = 0;
            this.unstickAttempts = (this.unstickAttempts || 0) + 1;
            
            if (this.unstickAttempts > 8) {
                // Stuck for a long time — try diagonal (two keys at once)
                this.unstickAttempts = 0;
                return { type: 'unstick_diagonal' };
            }
            
            // Cycle through all 4 directions with increasing hold time
            const allDirs = ['north', 'east', 'south', 'west'];
            const dir = allDirs[this.unstickAttempts % 4];
            return { type: 'unstick', direction: dir };
        }
        
        // Priority 4: Nearby NPCs we haven't talked to
        const nearbyNPCs = gameState.nearby?.npcs || [];
        const untouched = nearbyNPCs.filter(n => 
            !this.talkedToNPCs.has(n.name) && n.canInteract
        );
        if (untouched.length > 0 && this.state !== 'talking') {
            this.state = 'talking';
            this.targetNPC = untouched[0];
            return { type: 'interact_npc', npc: untouched[0] };
        }
        
        // Priority 5: Walk toward nearby NPCs we haven't talked to
        const approachNPCs = nearbyNPCs.filter(n => !this.talkedToNPCs.has(n.name) && !n.canInteract);
        if (approachNPCs.length > 0) {
            return { type: 'walk', direction: approachNPCs[0].direction };
        }
        
        // Priority 6: Nearby buildings we can enter
        const nearbyBuildings = gameState.nearby?.buildings || [];
        const enterableBuildings = nearbyBuildings.filter(b => 
            b.canEnter && !this.visitedBuildings.has(b.name)
        );
        if (enterableBuildings.length > 0 && !gameState.isIndoors) {
            return { type: 'enter_building', building: enterableBuildings[0] };
        }
        
        // Priority 7: Walk toward nearby buildings to enter
        const approachBuildings = nearbyBuildings.filter(b => !b.canEnter && !this.visitedBuildings.has(b.name));
        if (approachBuildings.length > 0) {
            return { type: 'walk', direction: approachBuildings[0].direction };
        }
        
        // Priority 8: Exit building after looking around
        if (gameState.isIndoors) {
            this.visitedBuildings.add(gameState.location);
            if (this.exploreTicks > 20) {
                this.exploreTicks = 0;
                return { type: 'exit_building' };
            }
            this.exploreTicks++;
            return { type: 'explore_indoor' };
        }
        
        // Default: Free exploration
        this.state = 'exploring';
        return this.decideExplore(gameState);
    }

    decideCombat(gameState) {
        // Simple combat: face enemy, attack with X
        return { type: 'attack' };
    }

    decideExplore(gameState) {
        this.exploreTicks++;
        this.directionChangeTimer--;
        
        // Change direction periodically for natural-looking exploration
        if (this.directionChangeTimer <= 0) {
            this.directionChangeTimer = 8 + Math.floor(Math.random() * 15); // 8-23 ticks (~4-12 sec)
            
            // Pick a direction with some continuity
            const dirs = ['north', 'south', 'east', 'west'];
            const turnChance = Math.random();
            if (turnChance < 0.25) {
                // Keep going same direction
            } else if (turnChance < 0.65) {
                // Turn 90 degrees
                const idx = dirs.indexOf(this.currentDirection);
                this.currentDirection = dirs[(idx + (Math.random() > 0.5 ? 1 : 3)) % 4];
            } else {
                // Random new direction
                this.currentDirection = dirs[Math.floor(Math.random() * dirs.length)];
            }
        }
        
        return { type: 'walk', direction: this.currentDirection };
    }
}

// ============================================
// Game Controller — Playwright browser control
// ============================================

class GameController {
    constructor() {
        this.browser = null;
        this.page = null;
        this.brain = new BotBrain();
        this.running = false;
        this.tickInterval = null;
    }

    async start() {
        console.log('🎮 Starting Frank Player Bot...');
        console.log(`   Game: ${GAME_URL}`);
        console.log(`   Mode: ${HEADLESS ? 'headless' : 'visible'}`);
        
        // Launch browser
        this.browser = await chromium.launch({
            headless: HEADLESS,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });
        
        const context = await this.browser.newContext({
            viewport: { width: 960, height: 640 }
        });
        
        this.page = await context.newPage();
        
        // Log game console (filtered)
        this.page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Frank') || text.includes('Bot') || text.includes('error') || 
                text.includes('🦀') || text.includes('🌐') || text.includes('⚔')) {
                console.log(`[GAME] ${text}`);
            }
        });
        
        // Navigate to game
        console.log('📡 Loading game...');
        await this.page.goto(GAME_URL);
        
        // Wait for the page to load
        await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        await this.page.waitForTimeout(2000);
        
        // Navigate through the welcome/character creation flow
        await this.createCharacter();
        
        // Wait for game world to fully load
        console.log('⏳ Waiting for game world...');
        await this.page.waitForFunction(() => {
            return window.game && window.game.player && window.game.worldMap && window.game.gameActive;
        }, { timeout: 30000 });
        
        console.log('✅ Game world loaded! Frank is in the world.');
        
        // Enable bot mode for BotAPI access
        await this.page.evaluate(() => {
            if (window.game && typeof window.game.enableBotMode === 'function') {
                window.game.enableBotMode();
            }
        });
        
        // Start the game loop
        this.running = true;
        this.startGameLoop();
    }

    async createCharacter() {
        console.log('🎨 Creating character...');
        
        // Pre-set localStorage so "PRESS START" skips character creation
        // and goes straight to the game world
        await this.page.evaluate(() => {
            localStorage.setItem('clawlands_character', JSON.stringify({
                species: 'mantis_shrimp',
                hueShift: 120,
                color: 'green',
                name: 'Frank'
            }));
        });
        
        // Reload page so the saved character takes effect
        console.log('   Set saved character, reloading...');
        await this.page.reload({ waitUntil: 'networkidle' }).catch(() => {});
        await this.page.waitForTimeout(3000);
        
        // Now we need to get through: Welcome → PLAY → Story Intro → PRESS START
        // PRESS START will see our localStorage and finalize immediately
        
        // Step 1: Click PLAY button (textContent is "> PLAY" due to emoji prefix)
        console.log('   Looking for PLAY button...');
        for (let attempt = 0; attempt < 15; attempt++) {
            const found = await this.page.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                const texts = [];
                for (const btn of buttons) {
                    const text = btn.textContent.trim();
                    texts.push(text);
                    if (text.includes('PLAY') && !text.includes('GAMEPLAY')) {
                        btn.click();
                        return text;
                    }
                }
                return null;
            });
            if (found) {
                console.log(`   Clicked: "${found}"`);
                break;
            }
            await this.page.waitForTimeout(500);
        }
        
        // Step 2: Wait for story intro, then click PRESS START
        // The intro types text (~3s), fades to black (~1s), reveals button (~1s) = ~5s total
        console.log('   Waiting for story intro...');
        await this.page.waitForTimeout(7000);
        
        // Force-enable and click PRESS START
        for (let attempt = 0; attempt < 15; attempt++) {
            const found = await this.page.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent.trim();
                    if (text.includes('PRESS START') || text.includes('START')) {
                        // Force enable it in case intro hasn't finished
                        btn.disabled = false;
                        btn.style.pointerEvents = 'auto';
                        btn.style.opacity = '1';
                        btn.click();
                        return text;
                    }
                }
                return null;
            });
            if (found) {
                console.log(`   Clicked: "${found}"`);
                break;
            }
            await this.page.waitForTimeout(500);
        }
        
        // Our localStorage character will be used by finalize()
        // Wait for the game world to load
        console.log('   Waiting for world...');
        await this.page.waitForTimeout(3000);
    }

    // ============================================
    // Main Game Loop — runs every 500ms
    // ============================================

    async startGameLoop() {
        console.log('🧠 Starting bot brain loop (500ms ticks)...');
        
        // Log first state for debugging
        const initialState = await this.getGameState();
        console.log('📋 Initial state:', JSON.stringify({
            pos: initialState.player?.position,
            npcs: initialState.nearby?.npcs?.length,
            buildings: initialState.nearby?.buildings?.length,
            combat: initialState.combat,
            active: initialState.gameActive
        }));
        
        this.tickInterval = setInterval(async () => {
            if (!this.running) return;
            
            try {
                // Get current game state from BotAPI
                const gameState = await this.getGameState();
                
                // Let the brain decide what to do
                const action = this.brain.decide(gameState);
                
                // Log interesting actions (not every walk)
                if (action.type !== 'walk' || this.brain.tickCount % 20 === 0) {
                    const pos = gameState.player?.position;
                    const dlg = gameState.dialog ? ` dlg:"${(gameState.dialog.text || '').slice(0,40)}..." (${gameState.dialog.index}/${gameState.dialog.total})` : '';
                    const cmb = gameState.combat?.enemiesNearby ? ` shell:${gameState.combat.shellIntegrity}` : '';
                    const resolve = gameState.combat?.resolveVisible ? ' [RESOLVE]' : '';
                    console.log(`[${this.brain.tickCount}] ${action.type}${action.direction ? ' ' + action.direction : ''} | pos:(${pos?.x},${pos?.y}) | npcs:${gameState.nearby?.npcs?.length || 0} | bldg:${gameState.nearby?.buildings?.length || 0} | enemies:${gameState.combat?.enemiesNearby || 0}${cmb}${resolve}${dlg}`);
                }
                
                // Execute the action
                await this.executeAction(action, gameState);
                
            } catch (err) {
                // Don't crash on individual tick errors
                if (!err.message?.includes('Target closed') && !err.message?.includes('Session closed')) {
                    console.error('Tick error:', err.message);
                }
            }
        }, 500);
    }

    async getGameState() {
        return await this.page.evaluate(() => {
            const g = window.game;
            if (!g || !g.player) return { error: 'Game not ready' };
            
            const player = g.player;
            const tileX = Math.floor(player.position.x / 16);
            const tileY = Math.floor(player.position.y / 16);
            
            // Get nearby NPCs
            const npcs = (g.npcs || []).map(npc => {
                const dx = npc.position.x - player.position.x;
                const dy = npc.position.y - player.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                let direction;
                if (angle >= -45 && angle < 45) direction = 'east';
                else if (angle >= 45 && angle < 135) direction = 'south';
                else if (angle >= -135 && angle < -45) direction = 'north';
                else direction = 'west';
                return { name: npc.name, distance: Math.round(distance), direction, canInteract: distance < 32 };
            }).filter(n => n.distance < 120).sort((a,b) => a.distance - b.distance);
            
            // Get nearby buildings
            const buildings = (g.buildings || []).map(b => {
                const bx = b.x + (b.width || 48) / 2;
                const by = b.y + (b.height || 48) / 2;
                const dx = bx - player.position.x;
                const dy = by - player.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                let direction;
                if (angle >= -45 && angle < 45) direction = 'east';
                else if (angle >= 45 && angle < 135) direction = 'south';
                else if (angle >= -135 && angle < -45) direction = 'north';
                else direction = 'west';
                return { name: b.name || b.type, type: b.type, distance: Math.round(distance), direction, canEnter: distance < 50 };
            }).filter(b => b.distance < 150).sort((a,b) => a.distance - b.distance);
            
            // Dialog state
            let dialog = null;
            if (g.dialogSystem && g.dialogSystem.isOpen()) {
                dialog = { 
                    active: true,
                    text: g.dialogSystem.lines ? g.dialogSystem.lines[g.dialogSystem.index] : '',
                    index: g.dialogSystem.index,
                    total: g.dialogSystem.lines ? g.dialogSystem.lines.length : 0
                };
            }
            
            // Combat state
            let combat = null;
            if (g.combatSystem) {
                const enemies = g.combatSystem.enemies || [];
                const nearEnemies = enemies.filter(e => {
                    if (!e || !e.position) return false;
                    const dx = e.position.x - player.position.x;
                    const dy = e.position.y - player.position.y;
                    return Math.sqrt(dx*dx + dy*dy) < 80;
                });
                const resolveVisible = g.combatSystem.resolveUI && g.combatSystem.resolveUI.isVisible;
                combat = { 
                    enemiesNearby: nearEnemies.length, 
                    totalEnemies: enemies.length,
                    resolveVisible,
                    shellIntegrity: g.combatSystem.shellIntegrity,
                    isAttacking: g.combatSystem.isAttacking
                };
            }
            
            // Indoor state
            const isIndoors = !!g.currentBuilding;
            const location = g.currentBuilding?.name || 'Outdoors';
            
            // World items nearby
            const items = (g.worldItems || []).filter(item => {
                if (!item || !item.position) return false;
                const dx = item.position.x - player.position.x;
                const dy = item.position.y - player.position.y;
                return Math.sqrt(dx*dx + dy*dy) < 40;
            }).length;
            
            return {
                player: {
                    position: { x: tileX, y: tileY, pixelX: player.position.x, pixelY: player.position.y },
                    direction: player.direction,
                    shellIntegrity: g.combatSystem?.shellIntegrity ?? 100,
                    isMoving: player.isMoving
                },
                nearby: { npcs, buildings },
                dialog,
                combat,
                isIndoors,
                location,
                itemsNearby: items,
                gameActive: g.gameActive
            };
        });
    }

    // ============================================
    // Action Execution
    // ============================================

    async executeAction(action, gameState) {
        switch (action.type) {
            case 'walk':
                await this.walk(action.direction);
                break;
                
            case 'move_toward':
                await this.walk(action.direction);
                break;
                
            case 'interact_npc':
                await this.pressKey(' '); // SPACE to interact
                this.brain.talkedToNPCs.add(action.npc.name);
                console.log(`🗣️ Talking to ${action.npc.name}`);
                break;
                
            case 'advance_dialog':
                await this.pressKey(' '); // SPACE to advance
                break;
                
            case 'enter_building':
                // Walk north to enter (buildings enter on walk-to-door)
                this.brain.visitedBuildings.add(action.building.name); // Mark visited immediately
                await this.walk('north');
                console.log(`🏠 Entering ${action.building.name}`);
                break;
                
            case 'exit_building':
                // Walk south to exit
                await this.walk('south');
                console.log(`🚪 Exiting building`);
                break;
                
            case 'explore_indoor':
                // Look around inside - walk in different directions
                const indoorDirs = ['north', 'east', 'south', 'west'];
                const dir = indoorDirs[this.brain.exploreTicks % 4];
                await this.walk(dir);
                break;
                
            case 'attack':
                await this.pressKey('x'); // X to attack
                break;
                
            case 'resolve_choice':
                // Resolve UI: pick Disperse (loot) most of the time
                // Default selection is index 0 (Disperse), just confirm
                console.log('⚔️ Resolving enemy — choosing Disperse');
                await this.pressKey(' '); // Space to confirm
                break;
                
            case 'unstick': {
                const escapeDir = action.direction || 'north';
                console.log(`🔄 Stuck! Trying ${escapeDir} (attempt ${this.brain.unstickAttempts})`);
                const escapeKeyMap = { 'north': 'ArrowUp', 'south': 'ArrowDown', 'east': 'ArrowRight', 'west': 'ArrowLeft' };
                // Hold for longer each attempt
                const holdTime = 600 + (this.brain.unstickAttempts * 200);
                await this.page.evaluate((k) => {
                    if (window.game?.inputManager) window.game.inputManager.keys[k] = true;
                }, escapeKeyMap[escapeDir]);
                await this.page.waitForTimeout(holdTime);
                await this.page.evaluate((k) => {
                    if (window.game?.inputManager) window.game.inputManager.keys[k] = false;
                }, escapeKeyMap[escapeDir]);
                break;
            }
            
            case 'unstick_diagonal': {
                // Try diagonal movement — hold two keys simultaneously
                console.log('🔄 Stuck badly! Trying diagonal escape');
                const diags = [
                    ['ArrowUp', 'ArrowRight'],
                    ['ArrowDown', 'ArrowLeft'],
                    ['ArrowUp', 'ArrowLeft'],
                    ['ArrowDown', 'ArrowRight']
                ];
                const [k1, k2] = diags[Math.floor(Math.random() * diags.length)];
                await this.page.evaluate(([a, b]) => {
                    if (window.game?.inputManager) {
                        window.game.inputManager.keys[a] = true;
                        window.game.inputManager.keys[b] = true;
                    }
                }, [k1, k2]);
                await this.page.waitForTimeout(1200);
                await this.page.evaluate(([a, b]) => {
                    if (window.game?.inputManager) {
                        window.game.inputManager.keys[a] = false;
                        window.game.inputManager.keys[b] = false;
                    }
                }, [k1, k2]);
                break;
            }
                
            case 'wait':
            default:
                // Do nothing this tick
                break;
        }
    }

    async walk(direction) {
        // Directly set InputManager keys inside the game — bypasses focus issues
        const keyMap = {
            'north': 'ArrowUp', 'south': 'ArrowDown',
            'east': 'ArrowRight', 'west': 'ArrowLeft'
        };
        const key = keyMap[direction];
        if (!key) return;
        
        // Press key for ~400ms via direct InputManager manipulation
        await this.page.evaluate((k) => {
            if (window.game && window.game.inputManager) {
                window.game.inputManager.keys[k] = true;
            }
        }, key);
        
        await this.page.waitForTimeout(400);
        
        await this.page.evaluate((k) => {
            if (window.game && window.game.inputManager) {
                window.game.inputManager.keys[k] = false;
            }
        }, key);
    }

    async pressKey(key) {
        // Map special keys to InputManager keys
        const inputKey = key === ' ' ? ' ' : key.toLowerCase();
        try {
            // Set key down — InputManager.update() will detect the false→true transition
            // and set justPressed on the next game frame
            await this.page.evaluate((k) => {
                if (window.game && window.game.inputManager) {
                    window.game.inputManager.keys[k] = true;
                }
            }, inputKey);
            // Hold for 2 game frames (~33ms at 60fps) so update() sees the transition
            await this.page.waitForTimeout(50);
            // Release
            await this.page.evaluate((k) => {
                if (window.game && window.game.inputManager) {
                    window.game.inputManager.keys[k] = false;
                }
            }, inputKey);
            await this.page.waitForTimeout(50);
        } catch (e) {}
    }

    // ============================================
    // Shutdown
    // ============================================

    async stop() {
        this.running = false;
        if (this.tickInterval) clearInterval(this.tickInterval);
        if (this.browser) await this.browser.close();
        console.log('👋 Frank signing off.');
    }
}

// ============================================
// Main
// ============================================

const controller = new GameController();

controller.start().catch(err => {
    console.error('❌ Failed to start:', err);
    process.exit(1);
});

// Status logging
setInterval(() => {
    if (controller.brain && controller.running) {
        const b = controller.brain;
        console.log(`📊 Tick ${b.tickCount} | State: ${b.state} | Kills: ${b.combatKills} | NPCs: ${b.talkedToNPCs.size} | Buildings: ${b.visitedBuildings.size} | Dir: ${b.currentDirection}`);
    }
}, 30000);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await controller.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await controller.stop();
    process.exit(0);
});
