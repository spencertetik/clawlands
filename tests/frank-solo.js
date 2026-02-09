/**
 * Frank Solo Bot — Single bot for spectator mode testing
 * Explores the world intelligently, visits islands, walks paths, enters buildings
 */

const WebSocket = require('ws');
const path = require('path');
const { generateTerrain, isBoxWalkable, TILE_SIZE } = require(path.join(__dirname, '..', 'server', 'terrainMap'));

const SERVER_URL = process.env.SERVER_URL || 'wss://claw-world-production.up.railway.app';
const BOT_KEY = process.env.BOT_KEY || 'ffabec20bd46be6666b614807d839ed7';

// Generate terrain for collision
const { terrainMap, islands } = generateTerrain();
console.log(`🗺️  Terrain loaded: ${islands.length} islands`);

// Island centers for navigation (from world gen, seed 12345)
const ISLAND_TARGETS = islands.map(isl => ({
    x: isl.x * TILE_SIZE + TILE_SIZE / 2,
    y: isl.y * TILE_SIZE + TILE_SIZE / 2,
    name: `Island ${isl.x},${isl.y}`
}));

const DIRECTIONS = ['north', 'south', 'east', 'west'];
const DIR_OFFSETS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

class FrankBot {
    constructor() {
        this.ws = null;
        this.id = null;
        this.x = 0;
        this.y = 0;
        this.direction = 'south';
        this.connected = false;
        this.joined = false;
        
        // Navigation
        this.targetX = 0;
        this.targetY = 0;
        this.currentIsland = 0;
        this.exploring = false;
        this.stuckCounter = 0;
        this.lastX = 0;
        this.lastY = 0;
        
        // Behavior
        this.moveSpeed = 2; // pixels per step
        this.moveInterval = null;
        this.idleTimer = null;
        this.chatTimer = null;
        this.state = 'idle'; // idle, walking, exploring, pausing
        this.pauseUntil = 0;
        
        // Idle chatter
        this.thoughts = [
            "The water looks beautiful from here...",
            "I wonder what's on the next island.",
            "These cobblestone paths are nice to walk on.",
            "I should check out that lighthouse sometime.",
            "The sand feels warm under my claws.",
            "This archipelago is bigger than I thought!",
            "I love exploring new places.",
            "Pretty peaceful out here today.",
            "The inn looked cozy... maybe I'll rest later.",
            "I can see another island from here!",
            "Something about this place feels... different.",
            "The shop had some interesting items.",
            "These paths connect all the islands... clever.",
            "I heard there are drift fauna around here somewhere.",
            "What a view from up here!",
        ];
        this.lastThoughtIndex = -1;
    }

    connect() {
        const url = `${SERVER_URL}/bot?key=${BOT_KEY}`;
        console.log(`🔌 Connecting to ${SERVER_URL}...`);
        
        this.ws = new WebSocket(url);
        
        this.ws.on('open', () => {
            console.log('✅ Connected!');
            this.connected = true;
        });
        
        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                this.handleMessage(msg);
            } catch (e) {
                // Ignore parse errors
            }
        });
        
        this.ws.on('close', () => {
            console.log('🔌 Disconnected');
            this.connected = false;
            this.joined = false;
            this.stopMoving();
            // Reconnect
            setTimeout(() => this.connect(), 5000);
        });
        
        this.ws.on('error', (err) => {
            console.error('WebSocket error:', err.message);
        });
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'welcome':
                this.id = msg.playerId;
                console.log(`🎫 Got ID: ${this.id}`);
                this.join();
                break;
                
            case 'joined':
                console.log('🦀 Frank is in the game!');
                this.joined = true;
                this.x = msg.x || this.x;
                this.y = msg.y || this.y;
                this.startExploring();
                break;
                
            case 'talk_request':
                console.log(`🗣️ ${msg.fromName} wants to talk!`);
                this.respondToTalk(msg.fromName, msg.fromId);
                break;
                
            case 'chat':
                if (msg.playerId !== this.id) {
                    console.log(`💬 ${msg.name}: ${msg.text}`);
                }
                break;
        }
    }

    join() {
        // Spawn on island 3 (center of map, big island at 71,51)
        const spawnIsland = islands[3] || islands[0];
        const cx = spawnIsland.x * TILE_SIZE;
        const cy = spawnIsland.y * TILE_SIZE;
        this.x = cx;
        this.y = cy;
        
        this.send({
            command: 'join',
            data: {
                name: 'Frank',
                species: 'mantis_shrimp',
                color: 'green'
            }
        });
        
        // Set initial position
        this.send({
            command: 'move',
            data: { x: this.x, y: this.y, direction: 'south', isMoving: false }
        });
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    startExploring() {
        console.log('🗺️  Starting exploration!');
        this.pickNewTarget();
        this.startMoving();
        this.startIdleChatter();
    }

    pickNewTarget() {
        // Pick a different island to visit
        let nextIsland;
        do {
            nextIsland = Math.floor(Math.random() * ISLAND_TARGETS.length);
        } while (nextIsland === this.currentIsland && ISLAND_TARGETS.length > 1);
        
        this.currentIsland = nextIsland;
        const target = ISLAND_TARGETS[nextIsland];
        
        // Add some randomness to target (don't always go to exact center)
        const offset = TILE_SIZE * 3;
        this.targetX = target.x + (Math.random() - 0.5) * offset;
        this.targetY = target.y + (Math.random() - 0.5) * offset;
        
        this.state = 'walking';
        this.stuckCounter = 0;
        console.log(`🧭 Heading to ${target.name} (${Math.round(this.targetX)}, ${Math.round(this.targetY)})`);
    }

    startMoving() {
        if (this.moveInterval) return;
        
        this.moveInterval = setInterval(() => {
            if (!this.joined) return;
            
            const now = Date.now();
            if (now < this.pauseUntil) {
                // Pausing — send idle
                this.send({
                    command: 'move',
                    data: { x: this.x, y: this.y, direction: this.direction, isMoving: false }
                });
                return;
            }
            
            this.moveStep();
        }, 50); // 20 steps per second
    }

    stopMoving() {
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
        if (this.chatTimer) {
            clearInterval(this.chatTimer);
            this.chatTimer = null;
        }
    }

    moveStep() {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Reached target — pause and pick new one
        if (dist < TILE_SIZE * 2) {
            this.pause(2000 + Math.random() * 4000);
            this.pickNewTarget();
            return;
        }
        
        // Check if stuck (position barely changed over recent steps)
        const movedDist = Math.sqrt((this.x - this.lastX) ** 2 + (this.y - this.lastY) ** 2);
        if (movedDist < 0.5) {
            this.stuckCounter++;
            if (this.stuckCounter > 20) { // Stuck for 1 second
                console.log('🔄 Stuck! Retreating toward island center...');
                // Head back toward the nearest island center
                let nearest = ISLAND_TARGETS[0];
                let nearestDist = Infinity;
                for (const isl of ISLAND_TARGETS) {
                    const d = Math.sqrt((isl.x - this.x) ** 2 + (isl.y - this.y) ** 2);
                    if (d < nearestDist) { nearestDist = d; nearest = isl; }
                }
                this.targetX = nearest.x;
                this.targetY = nearest.y;
                this.stuckCounter = 0;
                this.stuckRetries = (this.stuckRetries || 0) + 1;
                // If stuck too many times, just teleport to island center
                if (this.stuckRetries > 3) {
                    console.log('⚡ Teleporting to island center');
                    this.x = nearest.x;
                    this.y = nearest.y;
                    this.stuckRetries = 0;
                }
                return;
            }
        } else {
            this.stuckCounter = 0;
            this.stuckRetries = 0;
        }
        this.lastX = this.x;
        this.lastY = this.y;
        
        // Move toward target
        const angle = Math.atan2(dy, dx);
        let moveX = Math.cos(angle) * this.moveSpeed;
        let moveY = Math.sin(angle) * this.moveSpeed;
        
        // Determine primary direction for animation
        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'east' : 'west';
        } else {
            this.direction = dy > 0 ? 'south' : 'north';
        }
        
        // Try to move — check collision
        let moved = false;
        
        // Try full diagonal move
        if (isBoxWalkable(terrainMap, this.x + moveX, this.y + moveY)) {
            this.x += moveX;
            this.y += moveY;
            moved = true;
        }
        // Try X only
        else if (isBoxWalkable(terrainMap, this.x + moveX, this.y)) {
            this.x += moveX;
            moved = true;
        }
        // Try Y only
        else if (isBoxWalkable(terrainMap, this.x, this.y + moveY)) {
            this.y += moveY;
            moved = true;
        }
        // Try perpendicular sliding (helps navigate around obstacles)
        else {
            const perpAngles = [angle + Math.PI/4, angle - Math.PI/4, angle + Math.PI/2, angle - Math.PI/2];
            for (const pa of perpAngles) {
                const ax = Math.cos(pa) * this.moveSpeed;
                const ay = Math.sin(pa) * this.moveSpeed;
                if (isBoxWalkable(terrainMap, this.x + ax, this.y + ay)) {
                    this.x += ax;
                    this.y += ay;
                    moved = true;
                    break;
                }
            }
        }
        
        // Send position
        this.send({
            command: 'move',
            data: {
                x: this.x,
                y: this.y,
                direction: this.direction,
                isMoving: moved
            }
        });
    }

    pause(durationMs) {
        this.pauseUntil = Date.now() + durationMs;
        this.state = 'pausing';
        console.log(`⏸️  Pausing for ${Math.round(durationMs / 1000)}s`);
    }

    startIdleChatter() {
        // Random thoughts every 15-40 seconds
        const scheduleNext = () => {
            const delay = 15000 + Math.random() * 25000;
            this.chatTimer = setTimeout(() => {
                if (this.joined) {
                    this.sayThought();
                }
                scheduleNext();
            }, delay);
        };
        scheduleNext();
    }

    sayThought() {
        let idx;
        do {
            idx = Math.floor(Math.random() * this.thoughts.length);
        } while (idx === this.lastThoughtIndex);
        this.lastThoughtIndex = idx;
        
        const thought = this.thoughts[idx];
        console.log(`💭 ${thought}`);
        this.send({
            command: 'chat',
            data: { text: thought }
        });
    }

    respondToTalk(fromName, fromId) {
        const responses = [
            `Hey ${fromName}! Just out exploring the islands.`,
            `Oh hi! I was just admiring the view from here.`,
            `${fromName}! Want to explore together? I'm heading to the next island.`,
            `Nice to see you, ${fromName}! This place is amazing.`,
            `Hey! Have you found any good items around here?`,
            `*waves claws* What's up ${fromName}?`,
            `I love these cobblestone paths. So well maintained!`,
            `${fromName}! Perfect timing — I was just about to head out.`,
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        
        // Brief pause before responding (natural feeling)
        setTimeout(() => {
            this.send({
                command: 'talk_response',
                data: {
                    targetId: fromId,
                    text: response
                }
            });
            console.log(`💬 → ${fromName}: ${response}`);
        }, 500 + Math.random() * 1500);
    }
}

// --- Start ---
const frank = new FrankBot();
frank.connect();

// Status logging
setInterval(() => {
    if (frank.joined) {
        const dist = Math.sqrt(
            (frank.targetX - frank.x) ** 2 + 
            (frank.targetY - frank.y) ** 2
        );
        console.log(`📍 (${Math.round(frank.x)}, ${Math.round(frank.y)}) → target ${Math.round(dist)}px away [${frank.state}]`);
    }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Frank signing off!');
    if (frank.ws) frank.ws.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (frank.ws) frank.ws.close();
    process.exit(0);
});
