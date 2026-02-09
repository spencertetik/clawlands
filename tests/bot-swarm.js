/**
 * Clawlands Bot Swarm — Multiple AI players for visual multiplayer testing
 * 
 * Each bot gets a unique name, species, color, and movement personality.
 * They wander the map, follow paths, visit buildings, and chat occasionally.
 */

const WebSocket = require('ws');

const SERVER_URL = process.env.SERVER_URL || 'wss://claw-world-production.up.railway.app';
const BOT_KEY = process.env.BOT_KEY || 'ffabec20bd46be6666b614807d839ed7';
const NUM_BOTS = parseInt(process.env.NUM_BOTS) || 8;

// Bot characters with personality
// Valid species: lobster, crab, shrimp, mantis_shrimp, hermit_crab
// Valid colors: red, orange, yellow, green, teal, blue, purple, pink
const BOT_CONFIGS = [
    { name: 'Pinchy', species: 'lobster', color: 'red', style: 'explorer', startX: 760, startY: 700, chatLines: ['*snaps claws excitedly*', 'Anyone found the lighthouse?', 'This island is beautiful!', 'I can see the shop from here', 'Wonder whats in that chest', 'The sand feels warm today'] },
    { name: 'Shelly', species: 'hermit_crab', color: 'purple', style: 'wanderer', startX: 800, startY: 720, chatLines: ['Looking for a new shell...', 'The cobblestone paths are nice!', '*peeks out of shell*', 'This shell is getting heavy', 'Ooh a nice rock over there', 'The breeze is lovely'] },
    { name: 'Scuttle', species: 'crab', color: 'blue', style: 'pacer', startX: 720, startY: 680, chatLines: ['Scuttle scuttle scuttle!', 'Sideways is the only way!', 'Has anyone seen the shop?', 'Left right left right', 'These paths are well made', 'Nice weather for a walk'] },
    { name: 'Coral', species: 'shrimp', color: 'orange', style: 'explorer', startX: 840, startY: 740, chatLines: ['The water looks amazing here', 'I love this place!', 'Anyone want to explore together?', 'Found a starfish!', 'The islands are so diverse', 'I could swim all day'] },
    { name: 'Barnacle', species: 'mantis_shrimp', color: 'green', style: 'homebody', startX: 780, startY: 660, chatLines: ['Not moving from this spot.', 'Well maybe just a little walk...', 'Home sweet rock.', 'I can see 16 colors you cant', 'The mantis shrimp life is good', 'Anyone want to just chill?'] },
    { name: 'Tide', species: 'lobster', color: 'teal', style: 'runner', startX: 700, startY: 700, chatLines: ['ZOOM!', 'Catch me if you can!', 'Speed is everything!', 'Gotta go fast!', 'The wind in my antennae!', 'Racing to the lighthouse!'] },
    { name: 'Pearl', species: 'shrimp', color: 'pink', style: 'wanderer', startX: 820, startY: 680, chatLines: ['What a lovely day for a walk', 'The sunset tints are so pretty', 'Found some brine tokens!', 'This island has character', 'The ferns are so tall here', 'I wonder what that building is'] },
    { name: 'Rusty', species: 'crab', color: 'yellow', style: 'explorer', startX: 750, startY: 730, chatLines: ['These old docks have character', 'I wonder what that building is', 'Adventure awaits!', 'Whats over that hill?', 'The cobblestone roads go forever', 'Anyone been to the other islands?'] },
    { name: 'Bubbles', species: 'hermit_crab', color: 'orange', style: 'pacer', startX: 770, startY: 710, chatLines: ['*blows bubbles*', 'Bubble bubble!', 'The best things come in shells', 'My shell collection is growing', 'Found a great spot here', 'The palm trees are swaying'] },
    { name: 'Captain', species: 'lobster', color: 'blue', style: 'runner', startX: 810, startY: 690, chatLines: ['All hands on deck!', 'Ahoy there matey!', 'The sea calls to us all', 'Full speed ahead!', 'These waters are charted now', 'Anchors aweigh!'] },
];

const DIRECTIONS = ['north', 'south', 'east', 'west'];

class SwarmBot {
    constructor(config) {
        this.config = config;
        this.ws = null;
        this.playerId = null;
        this.x = config.startX;
        this.y = config.startY;
        this.connected = false;
        this.joined = false;
        this.moveInterval = null;
        this.chatInterval = null;
        this.currentDirection = DIRECTIONS[Math.floor(Math.random() * 4)];
        this.directionTimer = 0;
        this.directionChangeTicks = 5 + Math.floor(Math.random() * 15); // Change direction every 5-20 ticks
    }

    connect() {
        return new Promise((resolve) => {
            const url = `${SERVER_URL}/bot?key=${BOT_KEY}`;
            
            try {
                this.ws = new WebSocket(url);
            } catch (err) {
                console.log(`  ❌ ${this.config.name}: ${err.message}`);
                resolve(false);
                return;
            }

            const timeout = setTimeout(() => {
                if (!this.connected) {
                    console.log(`  ❌ ${this.config.name}: timeout`);
                    this.ws.terminate();
                    resolve(false);
                }
            }, 10000);

            this.ws.on('open', () => {
                clearTimeout(timeout);
                this.connected = true;
                resolve(true);
            });

            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.handleMessage(msg);
                } catch (e) {}
            });

            this.ws.on('close', () => {
                this.connected = false;
                this.joined = false;
                this.stop();
            });

            this.ws.on('error', (err) => {
                if (!this.connected) {
                    clearTimeout(timeout);
                    console.log(`  ❌ ${this.config.name}: ${err.message}`);
                    resolve(false);
                }
            });
        });
    }

    handleMessage(msg) {
        if (msg.type === 'welcome') {
            this.playerId = msg.playerId;
            this.join();
        } else if (msg.type === 'joined') {
            this.joined = true;
            console.log(`  🦀 ${this.config.name} (${this.config.species}, ${this.config.color}) is in the game!`);
            this.start();
        }
    }

    join() {
        this.send({
            command: 'join',
            data: {
                name: this.config.name,
                species: this.config.species,
                color: this.config.color
            }
        });
    }

    send(msg) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    chat(text) {
        this.send({ command: 'chat', data: { message: text } });
    }

    start() {
        // Movement based on personality
        let moveMs;
        switch (this.config.style) {
            case 'runner': moveMs = 200; break;     // Fast mover
            case 'explorer': moveMs = 400; break;   // Steady explorer
            case 'wanderer': moveMs = 600; break;   // Leisurely
            case 'pacer': moveMs = 350; break;      // Back and forth
            case 'homebody': moveMs = 1000; break;  // Barely moves
            default: moveMs = 500;
        }

        this.moveInterval = setInterval(() => {
            if (!this.joined) return;
            this.doMove();
        }, moveMs);

        // Chat occasionally (every 30-90 seconds) — pick randomly from lines, no repeats back-to-back
        this._lastChatIndex = -1;
        const chatBase = 30000 + Math.random() * 60000;
        this.chatInterval = setInterval(() => {
            if (!this.joined) return;
            const lines = this.config.chatLines;
            let idx;
            do {
                idx = Math.floor(Math.random() * lines.length);
            } while (idx === this._lastChatIndex && lines.length > 1);
            this._lastChatIndex = idx;
            this.chat(lines[idx]);
        }, chatBase);

        // Initial greeting after a few seconds
        setTimeout(() => {
            if (this.joined) {
                this.chat(`Hey everyone! ${this.config.name} here!`);
            }
        }, 3000 + Math.random() * 5000);
    }

    doMove() {
        this.directionTimer++;
        
        // Change direction periodically based on style
        if (this.directionTimer >= this.directionChangeTicks) {
            this.directionTimer = 0;
            
            switch (this.config.style) {
                case 'explorer':
                    // Pick a new random direction
                    this.currentDirection = DIRECTIONS[Math.floor(Math.random() * 4)];
                    this.directionChangeTicks = 8 + Math.floor(Math.random() * 20);
                    break;
                case 'wanderer':
                    // Gentle turns — prefer continuing or slight turns
                    if (Math.random() < 0.6) {
                        // Continue or slight adjust
                        const idx = DIRECTIONS.indexOf(this.currentDirection);
                        this.currentDirection = DIRECTIONS[(idx + (Math.random() < 0.5 ? 1 : 3)) % 4];
                    } else {
                        this.currentDirection = DIRECTIONS[Math.floor(Math.random() * 4)];
                    }
                    this.directionChangeTicks = 10 + Math.floor(Math.random() * 15);
                    break;
                case 'pacer':
                    // Reverse direction
                    const opposites = { north: 'south', south: 'north', east: 'west', west: 'east' };
                    this.currentDirection = opposites[this.currentDirection];
                    this.directionChangeTicks = 8 + Math.floor(Math.random() * 8);
                    break;
                case 'runner':
                    this.currentDirection = DIRECTIONS[Math.floor(Math.random() * 4)];
                    this.directionChangeTicks = 5 + Math.floor(Math.random() * 10);
                    break;
                case 'homebody':
                    // Move a tiny bit then stop for a while
                    this.currentDirection = DIRECTIONS[Math.floor(Math.random() * 4)];
                    this.directionChangeTicks = 1 + Math.floor(Math.random() * 3);
                    break;
            }
        }

        // Don't move every tick for homebodies
        if (this.config.style === 'homebody' && Math.random() < 0.7) return;

        // Keep bots roughly in the main island area (don't walk into ocean)
        const step = 16;
        let newX = this.x;
        let newY = this.y;
        
        switch (this.currentDirection) {
            case 'north': newY -= step; break;
            case 'south': newY += step; break;
            case 'east': newX += step; break;
            case 'west': newX -= step; break;
        }

        // Soft boundary — bounce back if going too far from center
        const centerX = 800, centerY = 900;
        const maxDist = 500;
        const dx = newX - centerX;
        const dy = newY - centerY;
        if (Math.sqrt(dx * dx + dy * dy) > maxDist) {
            // Head back toward center
            if (Math.abs(dx) > Math.abs(dy)) {
                this.currentDirection = dx > 0 ? 'west' : 'east';
            } else {
                this.currentDirection = dy > 0 ? 'north' : 'south';
            }
            return; // Skip this move, new direction will apply next tick
        }

        this.x = newX;
        this.y = newY;
        
        this.send({ command: 'move', data: { direction: this.currentDirection } });
    }

    stop() {
        if (this.moveInterval) clearInterval(this.moveInterval);
        if (this.chatInterval) clearInterval(this.chatInterval);
    }

    disconnect() {
        this.stop();
        if (this.ws) this.ws.close(1000, 'Swarm shutting down');
    }
}

// ============================================
// Main
// ============================================

async function main() {
    const count = Math.min(NUM_BOTS, BOT_CONFIGS.length);
    
    console.log(`
🦀 CLAWLANDS BOT SWARM
═══════════════════════
  Server: ${SERVER_URL}
  Bots:   ${count}
  
  Press Ctrl+C to disconnect all bots
`);

    const bots = [];

    for (let i = 0; i < count; i++) {
        const bot = new SwarmBot(BOT_CONFIGS[i]);
        const ok = await bot.connect();
        if (ok) {
            bots.push(bot);
        }
        // Small stagger
        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n✅ ${bots.length}/${count} bots active — they're in the game!\n`);
    console.log('They will wander, chat, and interact. Jump in at:');
    console.log('  https://claw-world.netlify.app\n');
    console.log('Press Ctrl+C to shut them all down.\n');

    // Status updates
    const statusInterval = setInterval(() => {
        const alive = bots.filter(b => b.connected).length;
        console.log(`  [${new Date().toLocaleTimeString()}] ${alive}/${bots.length} bots alive`);
    }, 30000);

    // Clean shutdown
    process.on('SIGINT', () => {
        console.log('\n🔌 Shutting down bot swarm...');
        clearInterval(statusInterval);
        for (const bot of bots) {
            bot.disconnect();
        }
        setTimeout(() => {
            console.log('👋 All bots disconnected.');
            process.exit(0);
        }, 2000);
    });
}

main().catch(console.error);
