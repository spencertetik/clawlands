/**
 * Clawlands Game Server
 * Runs a headless browser instance that bots can connect to
 * Handles character creation and game state for multiple bot players
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');
const http = require('http');

const GAME_PORT = process.env.GAME_PORT || 3002;
const GAME_URL = process.env.GAME_URL || 'http://localhost:9000';

class GameServer {
    constructor() {
        this.browser = null;
        this.page = null;
        this.clients = new Map(); // botId -> { ws, character, ready }
        this.gameReady = false;
        this.pendingCharacters = []; // Queue of characters to create
    }

    async start() {
        console.log('🎮 Starting Clawlands Game Server...');
        
        // Launch browser (visible so humans can watch!)
        const isHeadless = process.env.HEADLESS === 'true';
        this.browser = await chromium.launch({ 
            headless: isHeadless,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log(isHeadless ? '👻 Running headless' : '👀 Running visible - watch the browser!');
        
        this.page = await this.browser.newPage();
        
        // Listen for console messages from the game
        this.page.on('console', msg => {
            const text = msg.text();
            if (text.includes('🦀') || text.includes('✅') || text.includes('🤖')) {
                console.log(`[Game] ${text}`);
            }
        });

        // Navigate to game
        console.log(`📡 Loading game from ${GAME_URL}...`);
        await this.page.goto(GAME_URL + '?botMode=true');
        
        // Wait for the game to initialize (either welcome screen or canvas)
        await this.page.waitForFunction(() => {
            return document.getElementById('game-canvas') || 
                   document.querySelector('[class*="welcome"]') ||
                   document.getElementById('screen-overlay')?.children.length > 0;
        }, { timeout: 30000 });
        console.log('✅ Game page loaded');
        
        // Start WebSocket server for bots
        this.startServer();
    }

    startServer() {
        const httpServer = http.createServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'ok', 
                    gameReady: this.gameReady,
                    clients: this.clients.size
                }));
            } else if (req.url === '/state') {
                this.getGameState().then(state => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(state));
                });
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        this.wss = new WebSocket.Server({ server: httpServer });

        this.wss.on('connection', (ws) => {
            const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            console.log(`🤖 Bot connected: ${botId}`);
            
            this.clients.set(botId, { ws, character: null, ready: false });

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'welcome',
                botId: botId,
                message: 'Connected to Clawlands. Send create_character to begin.',
                example: {
                    type: 'create_character',
                    name: 'Virgil',
                    species: 'lobster',
                    color: 'red'
                }
            }));

            ws.on('message', async (data) => {
                try {
                    const msg = JSON.parse(data);
                    await this.handleMessage(botId, msg);
                } catch (e) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
                }
            });

            ws.on('close', () => {
                console.log(`🤖 Bot disconnected: ${botId}`);
                this.clients.delete(botId);
            });
        });

        httpServer.listen(GAME_PORT, () => {
            console.log(`\n🦀 Clawlands Game Server started!`);
            console.log(`   Bot WebSocket: ws://localhost:${GAME_PORT}`);
            console.log(`   Health check: http://localhost:${GAME_PORT}/health`);
            console.log(`   Game state: http://localhost:${GAME_PORT}/state\n`);
        });
    }

    async handleMessage(botId, msg) {
        const client = this.clients.get(botId);
        if (!client) return;

        const { ws } = client;

        switch (msg.type) {
            case 'create_character':
                await this.createCharacter(botId, msg);
                break;

            case 'command':
                if (!client.ready) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Character not created yet. Send create_character first.'
                    }));
                    return;
                }
                await this.executeCommand(botId, msg.command);
                break;

            case 'get_state':
                const state = await this.getGameState();
                ws.send(JSON.stringify({ type: 'state', data: state }));
                break;

            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;

            default:
                ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
        }
    }

    async createCharacter(botId, config) {
        const client = this.clients.get(botId);
        if (!client) return;

        const { ws } = client;
        const { name, species, color } = config;

        console.log(`🦞 Creating character for ${botId}: ${name} (${species}, ${color})`);

        try {
            // Check if we're at the character creation screen
            const isAtWelcome = await this.page.evaluate(() => {
                const overlay = document.getElementById('screen-overlay');
                return overlay && overlay.children.length > 0;
            });

            if (isAtWelcome) {
                // We're at the welcome screen - create character via UI
                await this.createCharacterViaUI(name, species, color);
            } else {
                // Game already started - need to handle differently
                // For now, we'll work with the existing character
                console.log('⚠️ Game already started, using existing character');
            }

            // Wait for game to be ready
            await this.page.waitForFunction(() => {
                return window.game && window.game.player;
            }, { timeout: 10000 });

            // Enable bot mode
            await this.page.evaluate(() => {
                if (window.game && !window.game.botModeEnabled) {
                    window.game.enableBotMode();
                }
            });

            client.character = { name, species, color };
            client.ready = true;
            this.gameReady = true;

            // Send success and initial state
            const state = await this.getGameState();
            ws.send(JSON.stringify({
                type: 'character_created',
                success: true,
                character: { name, species, color },
                state: state
            }));

            console.log(`✅ Character ${name} ready to play!`);

        } catch (error) {
            console.error('❌ Character creation failed:', error.message);
            ws.send(JSON.stringify({
                type: 'error',
                message: `Character creation failed: ${error.message}`
            }));
        }
    }

    async createCharacterViaUI(name, species, color) {
        console.log('🎨 Starting character creation UI flow...');
        
        // Map color names to button titles
        const colorNames = ['Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Pink'];
        const colorIndex = colorNames.findIndex(c => c.toLowerCase() === color?.toLowerCase());
        const colorTitle = colorNames[Math.max(0, colorIndex)];

        // Map species names
        const speciesMap = {
            'lobster': 'Lobster', 'crab': 'Crab', 'shrimp': 'Shrimp',
            'mantis shrimp': 'Mantis Shrimp', 'mantis': 'Mantis Shrimp',
            'hermit crab': 'Hermit Crab', 'hermit': 'Hermit Crab'
        };
        const speciesName = speciesMap[species?.toLowerCase()] || 'Lobster';

        // Wait for intro screen and click through it
        console.log('   Waiting for intro screen...');
        await this.page.waitForTimeout(3000);
        
        // Try to click "Press Start" button
        try {
            await this.page.click('button:has-text("Press Start")', { timeout: 5000 });
            console.log('   Clicked Press Start');
            await this.page.waitForTimeout(1000);
        } catch (e) {
            console.log('   No Press Start button, continuing...');
        }

        // Wait for character creation UI to appear
        await this.page.waitForTimeout(1000);
        
        // Select species by clicking button with species name
        console.log(`   Selecting species: ${speciesName}`);
        try {
            await this.page.click(`button:has-text("${speciesName}")`, { timeout: 3000 });
            await this.page.waitForTimeout(300);
        } catch (e) {
            console.log(`   Species button not found, using default`);
        }

        // Select color by clicking button with color title
        console.log(`   Selecting color: ${colorTitle}`);
        try {
            await this.page.click(`button[title="${colorTitle}"], button:has-text("${colorTitle}")`, { timeout: 3000 });
            await this.page.waitForTimeout(300);
        } catch (e) {
            // Try clicking nth color button
            try {
                const colorBtns = await this.page.$$('button');
                const colorBtn = colorBtns.find(async b => {
                    const title = await b.getAttribute('title');
                    return title === colorTitle;
                });
                if (colorBtn) await colorBtn.click();
            } catch (e2) {
                console.log(`   Color selection failed, using default`);
            }
        }

        // Enter name in text input
        console.log(`   Entering name: ${name}`);
        try {
            const input = await this.page.$('input[type="text"], input[placeholder*="name" i]');
            if (input) {
                await input.fill('');
                await input.fill(name || 'Bot');
                await this.page.waitForTimeout(300);
            }
        } catch (e) {
            console.log(`   Name input not found`);
        }

        // Click "Enter World" button
        console.log('   Clicking Enter World...');
        await this.page.waitForTimeout(500);
        try {
            await this.page.click('button:has-text("Enter World")', { timeout: 5000 });
        } catch (e) {
            try {
                await this.page.click('button:has-text("Start")', { timeout: 2000 });
            } catch (e2) {
                // Try pressing Enter as fallback
                await this.page.keyboard.press('Enter');
            }
        }

        // Wait for game world to load
        console.log('   Waiting for game world...');
        await this.page.waitForTimeout(3000);
        
        // Force enable bot mode directly
        console.log('   Enabling bot mode...');
        await this.page.evaluate(() => {
            if (window.game && !window.game.botEnabled) {
                window.game.enableBotMode();
            }
        });
        
        await this.page.waitForTimeout(1000);
        
        // Wait for player AND world to be ready
        console.log('   Waiting for world...');
        const worldReady = await this.page.waitForFunction(() => {
            return window.game && window.game.player && window.game.worldMap;
        }, { timeout: 10000 }).then(() => true).catch(() => false);
        
        if (!worldReady) {
            console.log('   ⚠️ World not ready');
            return;
        }
        
        // Verify BotAPI is ready
        const botReady = await this.page.evaluate(() => {
            return !!(window.game && window.game.botBridge && window.game.botBridge.botAPI);
        });
        
        console.log(botReady ? '   ✅ BotAPI ready' : '   ⚠️ BotAPI not ready');
    }

    async executeCommand(botId, command) {
        const client = this.clients.get(botId);
        if (!client) return;

        console.log(`🎮 [${botId}] ${command}`);

        // For movement commands, use keyboard input for visual feedback
        const keyMap = {
            'walk north': 'w', 'walk south': 's', 
            'walk east': 'd', 'walk west': 'a',
            'n': 'w', 's': 's', 'e': 'd', 'w': 'a',
            'north': 'w', 'south': 's', 'east': 'd', 'west': 'a'
        };
        
        const cmdLower = command.toLowerCase().trim();
        const key = keyMap[cmdLower];
        
        if (key) {
            // Use keyboard for visual movement
            await this.page.keyboard.down(key);
            await this.page.waitForTimeout(300);
            await this.page.keyboard.up(key);
            await this.page.waitForTimeout(100);
        } else if (cmdLower === 'interact' || cmdLower === 'enter' || cmdLower === 'exit') {
            await this.page.keyboard.press('e');
            await this.page.waitForTimeout(200);
        } else if (cmdLower === 'space' || cmdLower === 'action') {
            await this.page.keyboard.press(' ');
            await this.page.waitForTimeout(200);
        }

        try {
            // Also use BotAPI for state info
            const result = await this.page.evaluate(async (cmd) => {
                if (window.game && window.game.botBridge && window.game.botBridge.botAPI) {
                    return await window.game.botBridge.botAPI.executeCommand(cmd);
                }
                return { success: false, message: 'Bot API not ready' };
            }, command);

            client.ws.send(JSON.stringify({
                type: 'result',
                command: command,
                ...result
            }));
        } catch (error) {
            client.ws.send(JSON.stringify({
                type: 'error',
                command: command,
                message: error.message
            }));
        }
    }

    async getGameState() {
        try {
            return await this.page.evaluate(() => {
                const g = window.game;
                if (!g) return { error: 'No game object' };
                if (!g.botBridge) return { error: 'No botBridge', hasPlayer: !!g.player, hasWorld: !!g.world };
                if (!g.botBridge.botAPI) return { error: 'No botAPI' };
                return g.botBridge.botAPI.getState();
            });
        } catch (error) {
            return { error: error.message };
        }
    }

    async stop() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Start server
const server = new GameServer();
server.start().catch(console.error);

// Handle shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
});
