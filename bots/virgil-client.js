/**
 * Virgil Bot Client - Autonomous Claw World Player
 * 
 * Usage:
 *   node virgil-client.js                    # Connect to local game server
 *   BOT_SERVER=wss://... node virgil-client.js  # Connect to remote server
 * 
 * Environment:
 *   BOT_SERVER - WebSocket URL (default: ws://localhost:3002)
 *   BOT_NAME - Character name (default: Virgil)
 *   BOT_SPECIES - lobster, crab, shrimp, mantis, hermit (default: lobster)
 *   BOT_COLOR - red, orange, yellow, green, teal, blue, purple, pink (default: purple)
 */

const WebSocket = require('ws');
const readline = require('readline');

const BOT_SERVER = process.env.BOT_SERVER || 'ws://localhost:3002';
const BOT_NAME = process.env.BOT_NAME || 'Virgil';
const BOT_SPECIES = process.env.BOT_SPECIES || 'lobster';
const BOT_COLOR = process.env.BOT_COLOR || 'purple';

class VirgilBot {
    constructor() {
        this.ws = null;
        this.botId = null;
        this.state = null;
        this.ready = false;
        this.thinking = false;
    }

    connect() {
        console.log(`🦞 Connecting to ${BOT_SERVER}...`);
        
        this.ws = new WebSocket(BOT_SERVER);

        this.ws.on('open', () => {
            console.log('✅ Connected to game server');
        });

        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                this.handleMessage(msg);
            } catch (e) {
                console.error('Parse error:', e.message);
            }
        });

        this.ws.on('close', () => {
            console.log('🔌 Disconnected');
            this.ready = false;
        });

        this.ws.on('error', (err) => {
            console.error('Connection error:', err.message);
        });
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'welcome':
                this.botId = msg.botId;
                console.log(`\n🎮 ${msg.message}`);
                console.log(`   Bot ID: ${this.botId}\n`);
                
                // Auto-create character
                this.createCharacter();
                break;

            case 'character_created':
                if (msg.success) {
                    console.log(`\n🦞 Character created: ${msg.character.name}`);
                    console.log(`   Species: ${msg.character.species}`);
                    console.log(`   Color: ${msg.character.color}\n`);
                    this.state = msg.state;
                    this.ready = true;
                    this.displayState();
                    this.startInteractive();
                } else {
                    console.error('❌ Character creation failed:', msg.message);
                }
                break;

            case 'state':
                this.state = msg.data;
                break;

            case 'result':
                this.thinking = false;
                if (msg.success) {
                    console.log(`✅ ${msg.message}`);
                } else {
                    console.log(`❌ ${msg.message}`);
                }
                if (msg.state) {
                    this.state = msg.state;
                    this.displayState();
                }
                break;

            case 'error':
                console.error(`❌ Error: ${msg.message}`);
                this.thinking = false;
                break;

            default:
                console.log(`📨 ${msg.type}:`, msg);
        }
    }

    createCharacter() {
        console.log(`\n🎨 Creating character...`);
        console.log(`   Name: ${BOT_NAME}`);
        console.log(`   Species: ${BOT_SPECIES}`);
        console.log(`   Color: ${BOT_COLOR}\n`);

        this.ws.send(JSON.stringify({
            type: 'create_character',
            name: BOT_NAME,
            species: BOT_SPECIES,
            color: BOT_COLOR
        }));
    }

    displayState() {
        if (!this.state || this.state.error) return;

        const s = this.state;
        console.log('\n' + '═'.repeat(60));
        console.log(`🦞 ${s.player?.name || BOT_NAME} @ (${s.player?.position?.x}, ${s.player?.position?.y})`);
        console.log(`📍 ${s.location}${s.isIndoors ? ' (indoors)' : ''}`);
        console.log(`👀 ${s.surroundings}`);

        if (s.nearby?.npcs?.length > 0) {
            console.log(`\n👥 NPCs: ${s.nearby.npcs.map(n => `${n.name} (${n.direction})`).join(', ')}`);
        }

        if (s.nearby?.buildings?.length > 0) {
            console.log(`🏠 Buildings: ${s.nearby.buildings.map(b => `${b.name} (${b.direction})`).join(', ')}`);
        }

        if (s.dialog) {
            console.log(`\n💬 ${s.dialog.speaker}: "${s.dialog.text}"`);
        }

        console.log(`\n🎮 Actions: ${s.actions?.slice(0, 6).join(', ')}`);
        console.log('═'.repeat(60));
    }

    sendCommand(command) {
        if (!this.ready) {
            console.log('⚠️ Not ready yet');
            return;
        }

        this.thinking = true;
        console.log(`\n> ${command}`);
        
        this.ws.send(JSON.stringify({
            type: 'command',
            command: command
        }));
    }

    startInteractive() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: `\n🦞 ${BOT_NAME} > `
        });

        console.log('\n' + '═'.repeat(60));
        console.log('🦞 VIRGIL BOT - Claw World Explorer');
        console.log('═'.repeat(60));
        console.log('\nCommands:');
        console.log('  Movement: n/s/e/w or walk <direction>');
        console.log('  Actions:  interact, enter, exit, look');
        console.log('  Talk:     say <message>');
        console.log('  Info:     status, state, help, quit');
        console.log('');

        rl.prompt();

        rl.on('line', (line) => {
            const cmd = line.trim().toLowerCase();

            if (cmd === 'quit' || cmd === 'q' || cmd === 'exit') {
                console.log('Goodbye!');
                process.exit(0);
            }

            if (cmd === 'help' || cmd === 'h') {
                console.log('\n--- Commands ---');
                console.log('walk north/south/east/west - Move');
                console.log('interact - Talk to NPC or use object');
                console.log('enter - Enter a building');
                console.log('exit - Leave a building');
                console.log('look around - Describe surroundings');
                console.log('say <message> - Speak to nearby players');
                console.log('status / state - Show current game state');
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
                'i': 'interact', 'l': 'look around'
            };

            const command = shortcuts[cmd] || cmd;

            if (command && !this.thinking) {
                this.sendCommand(command);
            }

            setTimeout(() => rl.prompt(), 500);
        });

        rl.on('close', () => {
            console.log('Goodbye!');
            process.exit(0);
        });
    }
}

// Start bot
const bot = new VirgilBot();
bot.connect();
