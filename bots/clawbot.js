/**
 * ClawBot - AI player for Claw World
 * Connects via WebSocket and plays the game through text commands
 * 
 * Usage: 
 *   node clawbot.js                    # Interactive mode
 *   node clawbot.js --explore          # Autonomous exploration
 *   node clawbot.js --name "Pinchy"    # Set bot name
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const BOT_SERVER = process.env.BOT_SERVER || 'ws://localhost:3001';
const BOT_NAME = process.env.BOT_NAME || `Bot_${Math.random().toString(36).substr(2, 5)}`;

// Load instructions
const INSTRUCTIONS_PATH = path.join(__dirname, 'BOT_INSTRUCTIONS.md');
let INSTRUCTIONS = '';
try {
    INSTRUCTIONS = fs.readFileSync(INSTRUCTIONS_PATH, 'utf-8');
} catch (e) {
    INSTRUCTIONS = 'Explore the island and talk to anyone you meet!';
}

class ClawBot {
    constructor(name = BOT_NAME) {
        this.name = name;
        this.ws = null;
        this.state = null;
        this.connected = false;
        this.actionQueue = [];
        this.thinking = false;
        this.conversationMode = false;
        this.lastHeardTime = 0;
        this.pendingResponses = [];
    }

    connect() {
        console.log(`🦞 ${this.name} connecting to ${BOT_SERVER}...`);
        
        this.ws = new WebSocket(BOT_SERVER);

        this.ws.on('open', () => {
            console.log(`✅ ${this.name} connected!`);
            this.connected = true;
            
            // Identify ourselves to the server
            this.send({ type: 'identify', name: this.name, position: { x: 0, y: 0 } });
        });

        this.ws.on('message', (data) => {
            const msg = JSON.parse(data);
            this.handleMessage(msg);
        });

        this.ws.on('close', () => {
            console.log(`🔌 ${this.name} disconnected`);
            this.connected = false;
            setTimeout(() => this.connect(), 3000);
        });

        this.ws.on('error', (err) => {
            console.error('Connection error:', err.message);
        });
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'state':
                this.state = msg.data;
                // Update position on server
                if (this.state?.player?.position) {
                    this.send({ 
                        type: 'identify', 
                        name: this.name, 
                        position: {
                            x: this.state.player.position.pixelX,
                            y: this.state.player.position.pixelY
                        }
                    });
                }
                this.onStateUpdate();
                break;
                
            case 'result':
                console.log(`📨 ${msg.message}`);
                this.thinking = false;
                break;
                
            case 'heard':
                // Someone spoke to us!
                this.onHeardSpeech(msg.speaker, msg.message, msg.distance);
                break;
                
            case 'waiting':
                console.log(`⏳ ${msg.message}`);
                break;
                
            case 'game_disconnected':
                console.log('🎮 Game disconnected, waiting...');
                break;
                
            case 'error':
                console.error(`❌ ${msg.message}`);
                this.thinking = false;
                break;
        }
    }

    onHeardSpeech(speaker, message, distance) {
        console.log(`\n👂 [heard] ${speaker}: "${message}" (${distance}px away)`);
        this.lastHeardTime = Date.now();
        
        // Queue a response (in autonomous mode, the AI would generate this)
        this.pendingResponses.push({ speaker, message, distance });
        
        // In interactive mode, just display it
        // In autonomous mode, this would trigger AI response generation
    }

    onStateUpdate() {
        if (!this.state || this.thinking) return;
        
        // Check for nearby players to potentially talk to
        const nearbyPlayers = this.state.nearby?.players || [];
        if (nearbyPlayers.length > 0 && !this.conversationMode) {
            console.log(`\n👀 Spotted: ${nearbyPlayers.map(p => p.name).join(', ')}`);
        }
        
        // Check heard messages
        const heard = this.state.heard || [];
        if (heard.length > 0) {
            for (const msg of heard) {
                console.log(`💬 [${msg.ago}s ago] ${msg.speaker}: "${msg.message}"`);
            }
        }
        
        // Process queued actions
        if (this.actionQueue.length > 0 && !this.thinking) {
            const nextAction = this.actionQueue.shift();
            this.sendCommand(nextAction);
        }
    }

    displayState() {
        const s = this.state;
        if (!s || s.error) return;

        console.log('\n' + '='.repeat(60));
        console.log(`🦞 ${this.name} | ${s.player?.name || '?'} @ (${s.player?.position?.x}, ${s.player?.position?.y})`);
        console.log(`📍 ${s.location}${s.isIndoors ? ' (indoors)' : ''}`);
        console.log(`👀 ${s.surroundings}`);
        
        // Show nearby players
        const players = s.nearby?.players || [];
        if (players.length > 0) {
            console.log(`👥 Nearby players: ${players.map(p => `${p.name} (${p.direction})`).join(', ')}`);
        }
        
        if (s.dialog) {
            console.log(`\n💬 ${s.dialog.speaker}: "${s.dialog.text}"`);
        }
        
        console.log(`\n🎮 Actions: ${s.actions?.join(', ') || 'none'}`);
        console.log('='.repeat(60));
    }

    sendCommand(command) {
        if (!this.connected) {
            console.log('Not connected!');
            return;
        }
        
        console.log(`\n🤖 ${this.name} > ${command}`);
        this.thinking = true;
        
        this.ws.send(JSON.stringify({
            type: 'command',
            command: command
        }));
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    // Interactive REPL mode
    startInteractive() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: `🦞 ${this.name} > `
        });

        console.log('\n' + '='.repeat(60));
        console.log(`🦞 ${this.name} - Claw World Bot`);
        console.log('='.repeat(60));
        console.log('\nCommands:');
        console.log('  Movement: n/s/e/w or walk <direction>');
        console.log('  Actions:  i (interact), enter, exit, look');
        console.log('  Talk:     say <message>');
        console.log('  Info:     status, help, quit');
        console.log('\n💡 When you see [heard], someone is talking to you!');
        console.log('   Use "say <message>" to respond.\n');

        rl.prompt();

        rl.on('line', (line) => {
            const cmd = line.trim();
            
            if (cmd === 'quit' || cmd === 'q') {
                console.log('Goodbye!');
                process.exit(0);
            }
            
            if (cmd === 'help') {
                console.log('\n--- How to Play ---');
                console.log(INSTRUCTIONS.slice(0, 1500) + '...\n');
                rl.prompt();
                return;
            }
            
            if (cmd === 'status' || cmd === 'state') {
                this.displayState();
                rl.prompt();
                return;
            }
            
            // Direction shortcuts
            const shortcuts = {
                'n': 'walk north', 's': 'walk south', 
                'e': 'walk east', 'w': 'walk west',
                'i': 'interact', 'l': 'look around',
                'x': 'exit'
            };
            
            const command = shortcuts[cmd] || cmd;
            
            if (command) {
                this.sendCommand(command);
            }
            
            setTimeout(() => rl.prompt(), 300);
        });

        rl.on('close', () => {
            console.log('Goodbye!');
            process.exit(0);
        });
    }

    // AI decision making for autonomous mode
    makeDecision() {
        if (!this.state || this.thinking) return null;
        
        const s = this.state;
        
        // Priority 1: Respond to pending speech
        if (this.pendingResponses.length > 0) {
            const response = this.pendingResponses.shift();
            // Simple response - in real use, this would be AI-generated
            const greetings = [
                `Hey ${response.speaker}! Nice to meet you!`,
                `Oh hello there! What brings you here?`,
                `Hi! Beautiful day on the island, isn't it?`,
                `Greetings, fellow crustacean!`
            ];
            return `say ${greetings[Math.floor(Math.random() * greetings.length)]}`;
        }
        
        // Priority 2: Dialog active - continue it
        if (s.dialog) {
            return 'interact';
        }
        
        // Priority 3: Nearby player - greet them
        const nearbyPlayers = s.nearby?.players || [];
        if (nearbyPlayers.length > 0 && Math.random() < 0.3) {
            const player = nearbyPlayers[0];
            return `say Hello ${player.name}! How's it going?`;
        }
        
        // Priority 4: Nearby NPC - interact
        const interactableNPC = s.nearby?.npcs?.find(n => n.canInteract);
        if (interactableNPC && Math.random() < 0.5) {
            return 'interact';
        }
        
        // Priority 5: Can enter building
        const canEnterBuilding = s.nearby?.buildings?.find(b => b.canEnter);
        if (canEnterBuilding && !s.isIndoors && Math.random() < 0.2) {
            return 'enter';
        }
        
        // Priority 6: Exit building occasionally
        if (s.isIndoors && Math.random() < 0.15) {
            return 'exit';
        }
        
        // Default: Random exploration
        const directions = ['north', 'south', 'east', 'west'];
        return `walk ${directions[Math.floor(Math.random() * directions.length)]}`;
    }

    // Start autonomous exploration
    startExploring(intervalMs = 2500) {
        console.log(`\n🤖 ${this.name} starting autonomous exploration...`);
        console.log('Press Ctrl+C to stop\n');
        
        setInterval(() => {
            if (this.connected && !this.thinking && this.state) {
                const action = this.makeDecision();
                if (action) {
                    this.sendCommand(action);
                }
            }
        }, intervalMs);
    }
}

// CLI handling
const args = process.argv.slice(2);

// Parse --name argument
let botName = BOT_NAME;
const nameIdx = args.indexOf('--name');
if (nameIdx !== -1 && args[nameIdx + 1]) {
    botName = args[nameIdx + 1];
}

const bot = new ClawBot(botName);
bot.connect();

// Wait for connection then start mode
setTimeout(() => {
    if (args.includes('--explore') || args.includes('-e')) {
        bot.startExploring();
    } else {
        bot.startInteractive();
    }
}, 1000);
