/**
 * Clawlands Bot Swarm — AI players that respect world collision, chat, and respond to talk
 * 
 * Each bot:
 * - Checks terrain collision before moving (uses same world gen as client)
 * - Sends proper direction + isMoving flags for walk animation
 * - Responds when players talk to them (via talk_request)
 * - Has conversations with other bots
 * - Shows as bot (🤖) not player
 */

const WebSocket = require('ws');
const path = require('path');
const { generateTerrain, isBoxWalkable, TILE_SIZE } = require(path.join(__dirname, '..', 'server', 'terrainMap'));

const SERVER_URL = process.env.SERVER_URL || 'wss://claw-world-production.up.railway.app';
const BOT_KEY = process.env.BOT_KEY || 'ffabec20bd46be6666b614807d839ed7';
const NUM_BOTS = parseInt(process.env.NUM_BOTS) || 8;

// Generate terrain once — shared by all bots
const { terrainMap, islands } = generateTerrain();
console.log(`🗺️  Terrain loaded: ${islands.length} islands`);

// Valid species + colors (must match client sprite assets)
const BOT_CONFIGS = [
    { name: 'Pinchy',   species: 'lobster',       color: 'red',    style: 'explorer', personality: 'Friendly and curious. Loves exploring and finding new things. Talks with excitement.' },
    { name: 'Shelly',   species: 'hermit_crab',   color: 'purple', style: 'wanderer', personality: 'Shy and thoughtful. Speaks softly. Worried about finding the perfect shell.' },
    { name: 'Scuttle',  species: 'crab',           color: 'blue',   style: 'pacer',    personality: 'Energetic and silly. Makes crab puns. Walks sideways proudly.' },
    { name: 'Coral',    species: 'shrimp',         color: 'orange', style: 'explorer', personality: 'Warm and welcoming. Loves the ocean. Compliments others often.' },
    { name: 'Barnacle', species: 'mantis_shrimp',  color: 'green',  style: 'homebody', personality: 'Grumpy but lovable. Doesnt like moving much. Dry humor.' },
    { name: 'Tide',     species: 'lobster',        color: 'teal',   style: 'runner',   personality: 'Competitive speed freak. Always in a hurry. Talks about racing.' },
    { name: 'Pearl',    species: 'shrimp',         color: 'pink',   style: 'wanderer', personality: 'Gentle and poetic. Notices beautiful things. Speaks in metaphors sometimes.' },
    { name: 'Rusty',    species: 'crab',           color: 'yellow', style: 'explorer', personality: 'Old adventurer. Tells stories about the old days. Wise and helpful.' },
];

const DIRECTIONS = ['north', 'south', 'east', 'west'];
const DIR_OFFSETS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const OPPOSITES = { north: 'south', south: 'north', east: 'west', west: 'east' };

// Short response lines for talk (no AI needed — themed per personality)
function generateTalkResponse(bot, fromName) {
    const responses = {
        'Pinchy': [
            `Hey ${fromName}! Have you checked out the lighthouse yet?`,
            `Oh hi! I just found the coolest path over that way!`,
            `*snaps claws in greeting* Welcome to the islands!`,
            `${fromName}! Great to see you out here exploring!`,
            `I heard theres treasure hidden somewhere... want to look together?`,
            `The shop has some neat stuff if you havent checked it out!`,
        ],
        'Shelly': [
            `Oh... h-hi ${fromName}. *peeks out of shell*`,
            `This shell is getting a bit small... do you know where I can find a bigger one?`,
            `*retreats slightly* Sorry, Im a bit shy. But its nice to meet you!`,
            `The cobblestone paths feel nice under my shell...`,
            `Have you seen any good shells around? Asking for... myself.`,
            `I like it here. Its peaceful. Dont you think, ${fromName}?`,
        ],
        'Scuttle': [
            `Sideways is the superior way to walk! Try it, ${fromName}!`,
            `Scuttle scuttle! Oh hey there!`,
            `Why did the crab never share? Because hes shellfish! Ha!`,
            `${fromName}! Race me to the shop! ...sideways only though.`,
            `Left, right, left, right... oh hi! Didnt see you there!`,
            `*does a sideways dance* Pretty cool right?`,
        ],
        'Coral': [
            `Oh hello ${fromName}! Isnt the water beautiful today?`,
            `You look great! Love your shell color!`,
            `The islands here are so lovely. Have you explored them all?`,
            `${fromName}! Welcome! I was just admiring the sunset tints.`,
            `I could float around here forever. Want to join me?`,
            `Every corner of this archipelago has something special!`,
        ],
        'Barnacle': [
            `*grumbles* What do you want, ${fromName}?`,
            `I was JUST getting comfortable and now you want to chat?`,
            `Fine. Hi. Im Barnacle. No, I dont want to go exploring.`,
            `You know I can see 16 colors you cant, right? Just saying.`,
            `...actually that was kinda nice of you to stop by.`,
            `If you bring me food I might be friendlier. Maybe.`,
        ],
        'Tide': [
            `Cant stop! Gotta go fast! Talk while we run, ${fromName}!`,
            `ZOOM! Oh sorry, you wanted to chat? Make it quick!`,
            `I bet I can lap this island before you blink!`,
            `${fromName}! Wanna race to the lighthouse?!`,
            `Speed is EVERYTHING! The wind in my antennae!`,
            `Ready set GO! ...oh you wanted to talk first? Fine.`,
        ],
        'Pearl': [
            `The way the light catches the water... oh, hello ${fromName}.`,
            `Every grain of sand tells a story, dont you think?`,
            `*gazes at the horizon* Its nice to have company.`,
            `${fromName}, have you noticed how the paths wind like rivers?`,
            `Some days I just wander and let the island guide me.`,
            `Theres poetry in these tides, if you listen closely.`,
        ],
        'Rusty': [
            `Ah, ${fromName}! Pull up a rock, let me tell you a story...`,
            `Back in my day, these islands were just sand and dreams!`,
            `You remind me of a young adventurer I once knew.`,
            `The secret to a good life? Keep your claws sharp and your friends close.`,
            `Ive been to every island here. Each one has a lesson to teach.`,
            `${fromName}, eh? Good strong name. Youll go far in these waters.`,
        ],
    };

    const lines = responses[bot.config.name] || [`Hey ${fromName}! Nice to meet you!`];
    return lines[Math.floor(Math.random() * lines.length)];
}

// Bot-to-bot conversation starters
function generateBotChat(bot, otherBotName) {
    const lines = [
        `Hey ${otherBotName}! Hows the exploring going?`,
        `${otherBotName}, seen anything interesting lately?`,
        `Nice weather for a walk, right ${otherBotName}?`,
        `${otherBotName}! Found any good spots?`,
        `The paths here are really well made, dont you think ${otherBotName}?`,
    ];
    return lines[Math.floor(Math.random() * lines.length)];
}

// Idle chatter (no target)
function generateIdleChat(bot) {
    const lines = {
        'Pinchy':   ['The sand feels warm today!', 'I wonder whats on that island...', 'Anyone found the treasure chest?', '*snaps claws happily*', 'This path leads somewhere interesting!'],
        'Shelly':   ['*peeks out of shell*', 'This shell is getting heavy...', 'The breeze is lovely here.', 'I found a nice quiet spot.', 'Maybe I should explore a little more...'],
        'Scuttle':  ['Scuttle scuttle scuttle!', 'Left right left right!', 'Sideways is the only way!', 'These paths are well made!', 'Has anyone seen the shop?'],
        'Coral':    ['The water looks amazing here!', 'I love this place!', 'Found a starfish!', 'The islands are so diverse!', 'What a gorgeous day!'],
        'Barnacle': ['Not moving from this spot.', 'Well maybe just a little walk...', 'Home sweet rock.', '*grumbles contentedly*', 'Fine. Ill look around. A LITTLE.'],
        'Tide':     ['ZOOM!', 'Gotta go fast!', 'Speed is everything!', 'The wind in my antennae!', 'Catch me if you can!'],
        'Pearl':    ['What a lovely day for a walk.', 'The sunset tints are so pretty.', 'I wonder what that building is...', 'The ferns are so tall here.', 'Every path has a story.'],
        'Rusty':    ['These old docks have character.', 'Adventure awaits!', 'Back in my day...', 'The cobblestone goes on forever.', 'Anyone been to the far islands?'],
    };
    const l = lines[bot.config.name] || ['Nice day!'];
    return l[Math.floor(Math.random() * l.length)];
}

class SwarmBot {
    constructor(config, allBots) {
        this.config = config;
        this.allBots = allBots; // reference to all bots for bot-to-bot chat
        this.ws = null;
        this.playerId = null;
        this.connected = false;
        this.joined = false;
        this.moveInterval = null;
        this.chatInterval = null;
        this.botChatInterval = null;

        // Position in PIXELS (top-left of collision box)
        // Start on a random land tile on the main island
        const spawn = this.findLandSpawn();
        this.x = spawn.x;
        this.y = spawn.y;
        this.direction = DIRECTIONS[Math.floor(Math.random() * 4)];
        this.isMoving = false;

        // Movement state
        this.directionTimer = 0;
        this.directionChangeTicks = 5 + Math.floor(Math.random() * 15);
        this.stoppedTicks = 0; // pause between movements for natural feel
        this.pauseAfterWalk = 0;
        
        // Track nearby players for bot-to-bot awareness
        this.nearbyPlayers = new Map();
    }

    findLandSpawn() {
        // Pick a random island and find a land tile on it
        const island = islands[Math.floor(Math.random() * islands.length)];
        for (let attempt = 0; attempt < 100; attempt++) {
            const dx = Math.floor((Math.random() - 0.5) * island.size * 1.5);
            const dy = Math.floor((Math.random() - 0.5) * island.size * 1.5);
            const px = (island.x + dx) * TILE_SIZE;
            const py = (island.y + dy) * TILE_SIZE;
            if (isBoxWalkable(terrainMap, px, py)) {
                return { x: px, y: py };
            }
        }
        // Fallback: center of island
        return { x: island.x * TILE_SIZE, y: island.y * TILE_SIZE };
    }

    async reconnect() {
        if (this._shuttingDown) return;
        // Retry up to 10 times with increasing delays (handles Railway's ~30s deploy)
        for (let attempt = 1; attempt <= 10; attempt++) {
            if (this._shuttingDown) return;
            const ok = await this.connect();
            if (ok) return;
            const delay = Math.min(5000 * attempt, 30000);
            console.log(`  ⏳ ${this.config.name}: retry ${attempt}/10 in ${(delay/1000).toFixed(0)}s`);
            await new Promise(r => setTimeout(r, delay));
        }
        console.log(`  ❌ ${this.config.name}: gave up reconnecting after 10 attempts`);
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
                const wasConnected = this.connected;
                this.connected = false;
                this.joined = false;
                this.stop();
                // Auto-reconnect after server restart (unless intentionally shutting down)
                if (wasConnected && !this._shuttingDown) {
                    const delay = 5000 + Math.random() * 5000;
                    console.log(`  ⚡ ${this.config.name} disconnected — reconnecting in ${(delay/1000).toFixed(0)}s`);
                    setTimeout(() => this.reconnect(), delay);
                }
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
        // Compressed batch positions
        if (msg.t === 'p') return; // Ignore — bots don't need to track other positions

        switch (msg.type) {
            case 'welcome':
                this.playerId = msg.playerId;
                this.join();
                break;

            case 'joined':
                this.joined = true;
                console.log(`  🦀 ${this.config.name} (${this.config.species}, ${this.config.color}) is in the game!`);
                this.start();
                break;

            case 'talk_request':
                // Someone wants to talk to us! Generate a response
                this.handleTalkRequest(msg.fromId, msg.fromName);
                break;

            case 'player_joined':
                if (msg.player && msg.player.id !== this.playerId) {
                    this.nearbyPlayers.set(msg.player.id, msg.player);
                }
                break;

            case 'player_left':
                this.nearbyPlayers.delete(msg.playerId);
                break;

            case 'chat':
                // Could respond to chat directed at us
                if (msg.text && msg.name && msg.text.toLowerCase().includes(this.config.name.toLowerCase())) {
                    // Someone mentioned us in chat — respond after a delay
                    setTimeout(() => {
                        if (this.joined) {
                            this.chat(generateTalkResponse(this, msg.name));
                        }
                    }, 1500 + Math.random() * 2000);
                }
                break;
        }
    }

    handleTalkRequest(fromId, fromName) {
        // Generate a response and send it back
        const response = generateTalkResponse(this, fromName);
        
        // Small delay for natural feel
        setTimeout(() => {
            if (!this.joined) return;
            
            // Send talk_response back through the server
            this.send({
                command: 'talk_response',
                data: {
                    targetId: fromId,
                    text: response
                }
            });
            
            // Also show as a chat bubble
            this.chat(response);
        }, 500 + Math.random() * 1500);
    }

    join() {
        this.send({
            command: 'join',
            data: {
                name: this.config.name,
                species: this.config.species,
                color: this.config.color,
                x: this.x,
                y: this.y
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
        // Movement tick — all bots move at same rate (200ms) but skip ticks based on style
        this.moveInterval = setInterval(() => {
            if (!this.joined) return;
            this.doMove();
        }, 200);

        // Idle chatter (every 45-120 seconds)
        this.chatInterval = setInterval(() => {
            if (!this.joined) return;
            this.chat(generateIdleChat(this));
        }, 45000 + Math.random() * 75000);

        // Bot-to-bot conversations (every 60-180 seconds)
        this.botChatInterval = setInterval(() => {
            if (!this.joined) return;
            this.tryBotConversation();
        }, 60000 + Math.random() * 120000);

        // Initial greeting after a few seconds
        setTimeout(() => {
            if (this.joined) {
                this.chat(`Hey everyone! ${this.config.name} here!`);
            }
        }, 3000 + Math.random() * 5000);
    }

    tryBotConversation() {
        // Find another bot that's nearby-ish
        const otherBots = this.allBots.filter(b => 
            b !== this && b.joined && b.config.name !== this.config.name
        );
        if (otherBots.length === 0) return;

        const target = otherBots[Math.floor(Math.random() * otherBots.length)];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Only chat with bots within ~400px (visible range)
        if (dist < 400) {
            this.chat(generateBotChat(this, target.config.name));
        }
    }

    doMove() {
        // Pause between walks for natural feel
        if (this.pauseAfterWalk > 0) {
            this.pauseAfterWalk--;
            if (this.isMoving) {
                this.isMoving = false;
                this.sendPosition(); // Send stop
            }
            return;
        }

        // Homebodies skip most ticks
        if (this.config.style === 'homebody' && Math.random() < 0.7) {
            if (this.isMoving) {
                this.isMoving = false;
                this.sendPosition();
            }
            return;
        }

        // Wanderers move slowly
        if (this.config.style === 'wanderer' && Math.random() < 0.4) {
            return; // Skip tick but stay "moving" visually
        }

        this.directionTimer++;

        // Change direction periodically
        if (this.directionTimer >= this.directionChangeTicks) {
            this.directionTimer = 0;
            
            // Brief pause when changing direction
            this.pauseAfterWalk = 2 + Math.floor(Math.random() * 4);

            switch (this.config.style) {
                case 'explorer':
                    this.direction = DIRECTIONS[Math.floor(Math.random() * 4)];
                    this.directionChangeTicks = 8 + Math.floor(Math.random() * 20);
                    break;
                case 'wanderer':
                    if (Math.random() < 0.6) {
                        const idx = DIRECTIONS.indexOf(this.direction);
                        this.direction = DIRECTIONS[(idx + (Math.random() < 0.5 ? 1 : 3)) % 4];
                    } else {
                        this.direction = DIRECTIONS[Math.floor(Math.random() * 4)];
                    }
                    this.directionChangeTicks = 10 + Math.floor(Math.random() * 15);
                    break;
                case 'pacer':
                    this.direction = OPPOSITES[this.direction];
                    this.directionChangeTicks = 8 + Math.floor(Math.random() * 8);
                    break;
                case 'runner':
                    this.direction = DIRECTIONS[Math.floor(Math.random() * 4)];
                    this.directionChangeTicks = 5 + Math.floor(Math.random() * 10);
                    break;
                case 'homebody':
                    this.direction = DIRECTIONS[Math.floor(Math.random() * 4)];
                    this.directionChangeTicks = 1 + Math.floor(Math.random() * 3);
                    break;
            }
            return;
        }

        // Try to move
        const step = 2; // 2px per tick at 200ms = smooth movement (matches client speed ~160px/s for runners)
        const [dx, dy] = DIR_OFFSETS[this.direction];
        const newX = this.x + dx * step;
        const newY = this.y + dy * step;

        // Collision check: is the new position walkable?
        if (isBoxWalkable(terrainMap, newX, newY)) {
            this.x = newX;
            this.y = newY;
            this.isMoving = true;
            this.sendPosition();
        } else {
            // Hit a wall/water — turn around
            this.isMoving = false;
            this.direction = DIRECTIONS[Math.floor(Math.random() * 4)];
            this.directionTimer = 0;
            this.directionChangeTicks = 3 + Math.floor(Math.random() * 5);
            this.sendPosition(); // Send stopped state
        }
    }

    sendPosition() {
        this.send({
            command: 'move',
            data: {
                x: this.x,
                y: this.y,
                direction: this.direction,
                isMoving: this.isMoving
            }
        });
    }

    stop() {
        if (this.moveInterval) clearInterval(this.moveInterval);
        if (this.chatInterval) clearInterval(this.chatInterval);
        if (this.botChatInterval) clearInterval(this.botChatInterval);
    }

    disconnect() {
        this._shuttingDown = true;
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
        const bot = new SwarmBot(BOT_CONFIGS[i], bots);
        const ok = await bot.connect();
        if (ok) {
            bots.push(bot);
        }
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
