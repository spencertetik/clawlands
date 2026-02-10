/**
 * Frank Solo Bot — AI bot that "plays" Clawlands
 * 
 * Behaviors:
 * - Explores islands with purpose (not random wandering)
 * - Enters building areas, pauses at landmarks
 * - "Fights" enemies with combat movement patterns
 * - Narrates journey via chat bubbles
 * - Responds to player talk requests
 * - Follows quest-like exploration patterns
 */

const WebSocket = require('ws');
const path = require('path');
const { generateTerrain, generateBuildings, isBoxWalkable, TILE_SIZE } = require(path.join(__dirname, '..', 'server', 'terrainMap'));

const SERVER_URL = process.env.SERVER_URL || 'wss://claw-world-production.up.railway.app';
const BOT_KEY = process.env.BOT_KEY || 'ffabec20bd46be6666b614807d839ed7';

// Generate terrain for collision + pathfinding
const { terrainMap, islands } = generateTerrain();
const buildings = generateBuildings(terrainMap, islands);

// Load bush collision from EditorMapData (matches client bush fence collision)
const editorMapData = require(path.join(__dirname, '..', 'client', 'js', 'data', 'EditorMapData.js'));
const bushCollisionBoxes = [];
if (editorMapData.placements && editorMapData.placements.bush) {
    for (const [bx, by] of editorMapData.placements.bush) {
        // Bush sprite: 24x23, collision centered on sprite (matching client centerY logic)
        // Collision tile = tile containing center of bush
        const centerX = bx + 12;  // 24/2
        const centerY = by + 11.5; // 23/2
        const col = Math.floor(centerX / TILE_SIZE);
        const row = Math.floor(centerY / TILE_SIZE);
        bushCollisionBoxes.push({
            x: col * TILE_SIZE, y: row * TILE_SIZE,
            width: TILE_SIZE, height: TILE_SIZE
        });
    }
}
console.log(`🗺️  Terrain loaded: ${islands.length} islands, ${buildings.length} buildings, ${bushCollisionBoxes.length} bush fences`);

// Building collision check — player box (16x24) vs building rects
// Uses pixel-based collision matching the client's CollisionSystem
function collidesWithBuilding(px, py, pw = 16, ph = 24) {
    for (const b of buildings) {
        // Building collision box (bottom portion, matching client)
        // Client uses the full sprite rect for collision
        if (px + pw > b.x && px < b.x + b.width &&
            py + ph > b.y && py < b.y + b.height) {
            return true;
        }
    }
    return false;
}

// Bush fence collision check
function collidesWithBush(px, py, pw = 16, ph = 24) {
    for (const b of bushCollisionBoxes) {
        if (px + pw > b.x && px < b.x + b.width &&
            py + ph > b.y && py < b.y + b.height) {
            return true;
        }
    }
    return false;
}

// Combined walkability check: terrain + buildings + bush fences
function canMoveTo(px, py) {
    return isBoxWalkable(terrainMap, px, py) && !collidesWithBuilding(px, py) && !collidesWithBush(px, py);
}

// Island info with names (sorted by size like the client does)
const sortedIslands = [...islands].sort((a, b) => b.size - a.size);
const ISLAND_NAMES = [
    'Port Clawson',      // largest - main island
    'Molthaven',         // 2nd largest
    'Iron Reef',         // 3rd
    'Deepcoil Isle',     // 4th
    'The Shallows',      // 5th
    'Driftwood Keys',    // 6th
    'Coral Garden',      // 7th
    'Hermit Rock',       // 8th
    'Tide Pool',         // 9th
    'Razor Point'        // 10th
];

// Build navigable points of interest for each island
const ISLAND_DATA = sortedIslands.map((isl, i) => {
    const cx = isl.x * TILE_SIZE;
    const cy = isl.y * TILE_SIZE;
    const radius = isl.size * TILE_SIZE * 0.4;
    
    // Generate patrol points around the island (circle + center)
    const points = [];
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const px = cx + Math.cos(angle) * radius * 0.6;
        const py = cy + Math.sin(angle) * radius * 0.6;
        points.push({ x: px, y: py });
    }
    
    return {
        name: ISLAND_NAMES[i] || `Island ${i + 1}`,
        cx, cy,
        radius,
        size: isl.size,
        patrolPoints: points,
        // Building search zone - center of island where buildings get placed
        buildingZone: { x: cx, y: cy, radius: radius * 0.5 }
    };
});

// ============================================
// Bot Behavior States
// ============================================

const STATES = {
    IDLE: 'idle',
    TRAVELING: 'traveling',       // Moving between islands
    EXPLORING: 'exploring',       // Patrol around an island
    INVESTIGATING: 'investigating', // Moving toward a specific POI
    COMBAT: 'combat',             // Simulated combat pattern
    RESTING: 'resting',           // Pausing at a location
    TALKING: 'talking'            // In conversation
};

// ============================================
// Quest-like behaviors
// ============================================

const ACTIVITIES = [
    {
        name: 'explore_island',
        description: 'Patrol around the island perimeter',
        duration: 20000, // ms exploring before moving on
    },
    {
        name: 'search_buildings',
        description: 'Check out the building area',
        duration: 15000,
    },
    {
        name: 'combat_patrol',
        description: 'Hunt drift fauna',
        duration: 12000,
    },
    {
        name: 'scenic_rest',
        description: 'Rest and take in the view',
        duration: 5000,
    }
];

// ============================================
// Chat lines organized by context
// ============================================

const CHAT = {
    arriving: [
        (island) => `Made it to ${island}!`,
        (island) => `${island}... let's see what's here.`,
        (island) => `Alright, ${island}. Show me what you got.`,
        (island) => `Finally reached ${island}.`,
    ],
    exploring: [
        "These paths are well-worn... someone walks this way often.",
        "Hmm, interesting spot.",
        "I should mark this on my map.",
        "Never noticed this before...",
        "The architecture here is fascinating.",
        "Wonder what's inside that building.",
        "This cobblestone path leads somewhere...",
    ],
    combat_start: [
        "Drift fauna spotted! Here we go.",
        "Something's moving... getting my claws ready.",
        "Got a Skitter! Stay still...",
        "Haze Drifter! Watch out for the fog.",
        "Loopling incoming — predictable but dangerous.",
        "There! Time to fight!",
    ],
    combat_victory: [
        "Got it! Shell fragment dropped.",
        "Another one down. The Current won't take me.",
        "Victory! ...that one was tough.",
        "Drift Fauna cleared from this area.",
        "Three down. My shell's holding up.",
        "Red Essence? Don't mind if I do.",
    ],
    combat_hurt: [
        "Ow! That one got me...",
        "Shell integrity dropping... need to be careful.",
        "They're tougher than they look!",
    ],
    resting: [
        "Good spot to catch my breath.",
        "Let me check my inventory real quick...",
        "The ocean sounds nice from here.",
        "Shell's looking a bit rough... should rest.",
        "Beautiful view of the water.",
        "I can see the next island from here.",
    ],
    traveling: [
        "Time to move on to the next island.",
        "Wonder what I'll find over there...",
        "Heading out!",
        "Long swim ahead... here goes.",
    ],
    item_found: [
        "Oh nice, found something!",
        "What's this? ...could be useful.",
        "Loot! My favorite part.",
        "Adding that to the collection.",
    ],
    building_enter: [
        "Let me check inside...",
        "Door's open. Going in.",
        "Wonder who's home...",
    ],
    npc_chat: [
        "Hey there! Got any quests for me?",
        "Heard anything interesting lately?",
        "What do you know about the Red Current?",
        "Nice place you've got here.",
    ],
    general: [
        "This world just keeps getting more interesting.",
        "The Clawlands are beautiful today.",
        "Still so much to explore.",
        "Wish I had a bigger inventory...",
        "Need to find the inn soon, my shell's seen better days.",
        "The Current's been quiet today. Almost too quiet.",
    ]
};

function pickChat(category, ...args) {
    const lines = CHAT[category];
    if (!lines || lines.length === 0) return null;
    const line = lines[Math.floor(Math.random() * lines.length)];
    return typeof line === 'function' ? line(...args) : line;
}

// ============================================
// Frank Bot Class
// ============================================

class FrankBot {
    constructor() {
        this.ws = null;
        this.id = null;
        this.x = 0;
        this.y = 0;
        this.direction = 'south';
        this.connected = false;
        this.joined = false;
        
        // State machine
        this.state = STATES.IDLE;
        this.stateTimer = 0;
        this.activityIndex = 0;
        
        // Navigation
        this.targetX = 0;
        this.targetY = 0;
        this.currentIslandIndex = 0; // Start at Port Clawson (largest)
        this.visitedIslands = new Set();
        this.patrolPointIndex = 0;
        this.waypointQueue = []; // Queue of {x,y} to visit in sequence
        
        // Movement
        this.moveSpeed = 1.8; // Slightly slower than max for natural feel
        this.moveInterval = null;
        this.stuckCounter = 0;
        this.stuckRetries = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.isMoving = false;
        
        // Combat simulation
        this.combatTimer = 0;
        this.combatPhase = 0; // 0=approach, 1=attack, 2=dodge, 3=finish
        this.combatTarget = { x: 0, y: 0 };
        this.attackCooldown = 0;
        this.shellIntegrity = 100;
        
        // Chat
        this.chatCooldown = 0;
        this.lastChatCategory = '';
        
        // Activity scheduling
        this.nextActivityTime = 0;
        this.explorationPlan = this.generateExplorationPlan();
        this.planIndex = 0;
        
        // Talk responses
        this.talkResponses = [
            (name) => `Hey ${name}! Just exploring the islands. Want to come along?`,
            (name) => `${name}! Watch out for Drift Fauna near the shore.`,
            (name) => `Nice to meet you ${name}! Have you been to Deepcoil Isle yet?`,
            (name) => `*waves claws* What's up ${name}? Found any good loot?`,
            (name) => `${name}! I just cleared some Skitters over there. The path should be safe now.`,
            (name) => `Hey! You should check out the inn — they can patch up your shell.`,
            (name) => `Careful around here ${name}, I've seen Looplings nearby.`,
            (name) => `${name}! Perfect timing. I could use some backup.`,
        ];
    }

    generateExplorationPlan() {
        // Create a planned route through the islands with activities
        const plan = [];
        
        // Start at Port Clawson — do initial exploration
        plan.push({ island: 0, activity: 'explore_island' });
        plan.push({ island: 0, activity: 'search_buildings' });
        plan.push({ island: 0, activity: 'combat_patrol' });
        
        // Visit other islands in a logical order
        const visitOrder = [1, 2, 3, 4]; // Molthaven, Iron Reef, Deepcoil, Shallows
        for (const idx of visitOrder) {
            if (idx < ISLAND_DATA.length) {
                plan.push({ island: idx, activity: 'explore_island' });
                plan.push({ island: idx, activity: 'combat_patrol' });
                if (Math.random() > 0.3) {
                    plan.push({ island: idx, activity: 'search_buildings' });
                }
            }
        }
        
        // Visit remaining islands
        for (let i = 5; i < Math.min(ISLAND_DATA.length, 8); i++) {
            plan.push({ island: i, activity: 'explore_island' });
        }
        
        // End with scenic rest back at Port Clawson
        plan.push({ island: 0, activity: 'scenic_rest' });
        
        return plan;
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
            } catch (e) {}
        });
        
        this.ws.on('close', () => {
            console.log('🔌 Disconnected');
            this.connected = false;
            this.joined = false;
            this.stopMoving();
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
                this.startGameLoop();
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
        // Spawn on Port Clawson (largest island)
        const spawn = ISLAND_DATA[0];
        this.x = spawn.cx;
        this.y = spawn.cy;
        
        this.send({
            command: 'join',
            data: {
                name: 'Frank',
                species: 'mantis_shrimp',
                color: 'green'
            }
        });
        
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

    say(text) {
        if (!text) return;
        console.log(`💬 Frank: ${text}`);
        this.send({ command: 'chat', data: { message: text } });
        this.chatCooldown = 8000; // Don't spam chat
    }

    // ============================================
    // Main Game Loop (50ms ticks = 20Hz)
    // ============================================

    startGameLoop() {
        console.log('🎮 Starting game loop!');
        this.nextActivityTime = Date.now() + 2000; // Brief pause before starting
        this.state = STATES.RESTING;
        this.say("Just arrived at Port Clawson. Time to explore!");
        
        this.moveInterval = setInterval(() => {
            if (!this.joined) return;
            
            const now = Date.now();
            this.chatCooldown = Math.max(0, this.chatCooldown - 50);
            
            this.updateState(now);
            this.moveStep();
            
        }, 50);
    }

    stopMoving() {
        if (this.moveInterval) {
            clearInterval(this.moveInterval);
            this.moveInterval = null;
        }
    }

    // ============================================
    // State Machine
    // ============================================

    updateState(now) {
        switch (this.state) {
            case STATES.RESTING:
                this.isMoving = false;
                if (now >= this.nextActivityTime) {
                    this.advancePlan();
                }
                break;
                
            case STATES.TRAVELING:
                // Moving between islands — just keep walking toward target
                if (this.reachedTarget()) {
                    const island = ISLAND_DATA[this.currentIslandIndex];
                    if (this.chatCooldown <= 0) {
                        this.say(pickChat('arriving', island.name));
                    }
                    this.visitedIslands.add(this.currentIslandIndex);
                    this.startActivity();
                }
                break;
                
            case STATES.EXPLORING:
                // Patrol around island points
                if (this.reachedTarget()) {
                    this.patrolPointIndex++;
                    const island = ISLAND_DATA[this.currentIslandIndex];
                    
                    if (this.patrolPointIndex >= island.patrolPoints.length || 
                        now >= this.nextActivityTime) {
                        // Done exploring — move on
                        if (this.chatCooldown <= 0 && Math.random() > 0.5) {
                            this.say(pickChat('exploring'));
                        }
                        this.rest(2000 + Math.random() * 3000);
                    } else {
                        const point = island.patrolPoints[this.patrolPointIndex];
                        this.setTarget(point.x, point.y);
                        if (this.chatCooldown <= 0 && Math.random() > 0.7) {
                            this.say(pickChat('exploring'));
                        }
                    }
                }
                break;
                
            case STATES.INVESTIGATING:
                if (this.reachedTarget()) {
                    if (this.chatCooldown <= 0) {
                        this.say(pickChat(Math.random() > 0.5 ? 'building_enter' : 'npc_chat'));
                    }
                    this.rest(3000 + Math.random() * 4000);
                }
                break;
                
            case STATES.COMBAT:
                this.updateCombat(now);
                break;
                
            case STATES.TALKING:
                // Handled by talk response timer
                break;
        }
    }

    advancePlan() {
        if (this.planIndex >= this.explorationPlan.length) {
            // Completed the plan — generate a new one
            console.log('📋 Exploration plan complete! Generating new route...');
            this.explorationPlan = this.generateExplorationPlan();
            this.planIndex = 0;
        }
        
        const step = this.explorationPlan[this.planIndex];
        this.planIndex++;
        
        // If we need to travel to a different island
        if (step.island !== this.currentIslandIndex) {
            const targetIsland = ISLAND_DATA[step.island];
            this.currentIslandIndex = step.island;
            this.state = STATES.TRAVELING;
            this.setTarget(targetIsland.cx, targetIsland.cy);
            
            if (this.chatCooldown <= 0) {
                this.say(pickChat('traveling'));
            }
            console.log(`🧭 Traveling to ${targetIsland.name}`);
            
            // Store the pending activity for when we arrive
            this.pendingActivity = step.activity;
        } else {
            this.pendingActivity = step.activity;
            this.startActivity();
        }
    }

    startActivity() {
        const activity = this.pendingActivity || 'explore_island';
        const island = ISLAND_DATA[this.currentIslandIndex];
        
        console.log(`🎯 Starting activity: ${activity} on ${island.name}`);
        
        switch (activity) {
            case 'explore_island':
                this.state = STATES.EXPLORING;
                this.patrolPointIndex = 0;
                this.nextActivityTime = Date.now() + 20000 + Math.random() * 10000;
                const firstPoint = island.patrolPoints[0];
                this.setTarget(firstPoint.x, firstPoint.y);
                break;
                
            case 'search_buildings':
                this.state = STATES.INVESTIGATING;
                this.nextActivityTime = Date.now() + 15000;
                // Navigate toward building zone (center of island)
                const bz = island.buildingZone;
                const offsetX = (Math.random() - 0.5) * bz.radius;
                const offsetY = (Math.random() - 0.5) * bz.radius;
                this.setTarget(bz.x + offsetX, bz.y + offsetY);
                if (this.chatCooldown <= 0) {
                    this.say("Let me check out these buildings...");
                }
                break;
                
            case 'combat_patrol':
                this.startCombat();
                break;
                
            case 'scenic_rest':
                this.state = STATES.RESTING;
                this.nextActivityTime = Date.now() + 5000 + Math.random() * 5000;
                if (this.chatCooldown <= 0) {
                    this.say(pickChat('resting'));
                }
                break;
        }
        
        this.pendingActivity = null;
    }

    // ============================================
    // Combat Simulation
    // ============================================

    startCombat() {
        this.state = STATES.COMBAT;
        this.combatPhase = 0;
        this.combatTimer = Date.now();
        this.attackCooldown = 0;
        
        // Pick a combat location near current position (slightly offset)
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 30;
        this.combatTarget = {
            x: this.x + Math.cos(angle) * dist,
            y: this.y + Math.sin(angle) * dist
        };
        
        if (this.chatCooldown <= 0) {
            this.say(pickChat('combat_start'));
        }
        
        console.log('⚔️ Entering combat!');
    }

    updateCombat(now) {
        const elapsed = now - this.combatTimer;
        
        // Combat has phases — approach, attack, dodge, repeat, finish
        if (elapsed < 2000) {
            // Phase: Approach enemy
            this.setTarget(this.combatTarget.x, this.combatTarget.y);
        } else if (elapsed < 3500) {
            // Phase: Attack! Quick direction changes
            if (this.attackCooldown <= 0) {
                // Lunge toward target
                const angle = Math.atan2(
                    this.combatTarget.y - this.y,
                    this.combatTarget.x - this.x
                );
                this.setTarget(
                    this.combatTarget.x + Math.cos(angle) * 5,
                    this.combatTarget.y + Math.sin(angle) * 5
                );
                this.attackCooldown = 400;
                
                // Simulate taking damage sometimes
                if (Math.random() > 0.6 && this.chatCooldown <= 0) {
                    this.shellIntegrity = Math.max(20, this.shellIntegrity - 10);
                    this.say(pickChat('combat_hurt'));
                }
            }
            this.attackCooldown = Math.max(0, this.attackCooldown - 50);
        } else if (elapsed < 5000) {
            // Phase: Dodge — move away from combat target
            const angle = Math.atan2(this.y - this.combatTarget.y, this.x - this.combatTarget.x);
            const dodgeDist = 25;
            this.setTarget(
                this.x + Math.cos(angle) * dodgeDist,
                this.y + Math.sin(angle) * dodgeDist
            );
        } else if (elapsed < 7000) {
            // Phase: Second attack pass
            const angle = Math.random() * Math.PI * 2;
            this.combatTarget = {
                x: this.x + Math.cos(angle) * 15,
                y: this.y + Math.sin(angle) * 15
            };
            this.setTarget(this.combatTarget.x, this.combatTarget.y);
        } else if (elapsed < 8500) {
            // Phase: Finish — one more lunge
            this.setTarget(this.combatTarget.x, this.combatTarget.y);
        } else {
            // Combat over!
            if (this.chatCooldown <= 0) {
                if (Math.random() > 0.3) {
                    this.say(pickChat('combat_victory'));
                }
                if (Math.random() > 0.5) {
                    setTimeout(() => {
                        if (this.chatCooldown <= 0) this.say(pickChat('item_found'));
                    }, 2000);
                }
            }
            this.shellIntegrity = Math.min(100, this.shellIntegrity + 20); // "Heal" after combat
            
            // Chance for another combat encounter or move on
            if (Math.random() > 0.5 && elapsed < 20000) {
                // Another encounter nearby
                this.startCombat();
            } else {
                this.rest(3000 + Math.random() * 3000);
            }
        }
    }

    // ============================================
    // Movement
    // ============================================

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
        this.stuckCounter = 0;
    }

    reachedTarget() {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        return Math.sqrt(dx * dx + dy * dy) < TILE_SIZE * 1.5;
    }

    rest(durationMs) {
        this.state = STATES.RESTING;
        this.nextActivityTime = Date.now() + durationMs;
        this.isMoving = false;
        // Send idle position
        this.send({
            command: 'move',
            data: { x: this.x, y: this.y, direction: this.direction, isMoving: false }
        });
    }

    moveStep() {
        if (this.state === STATES.RESTING || this.state === STATES.IDLE || this.state === STATES.TALKING) {
            return; // Don't move while resting/idle/talking
        }
        
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 2) {
            // At target
            this.isMoving = false;
            this.send({
                command: 'move',
                data: { x: this.x, y: this.y, direction: this.direction, isMoving: false }
            });
            return;
        }
        
        // Stuck detection — only trigger after 2.5s (50 ticks) of no movement
        const movedDist = Math.sqrt((this.x - this.lastX) ** 2 + (this.y - this.lastY) ** 2);
        if (movedDist < 0.3) {
            this.stuckCounter++;
            if (this.stuckCounter > 50) { // 2.5 seconds stuck
                this.handleStuck();
                this.stuckCounter = 0; // Reset immediately so we don't re-trigger next tick
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
        const speed = this.state === STATES.COMBAT ? 2.5 : this.moveSpeed;
        let moveX = Math.cos(angle) * speed;
        let moveY = Math.sin(angle) * speed;
        
        // Direction for animation
        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'east' : 'west';
        } else {
            this.direction = dy > 0 ? 'south' : 'north';
        }
        
        // Try to move with collision
        let moved = false;
        
        if (canMoveTo(this.x + moveX, this.y + moveY)) {
            this.x += moveX;
            this.y += moveY;
            moved = true;
        } else if (canMoveTo(this.x + moveX, this.y)) {
            this.x += moveX;
            moved = true;
        } else if (canMoveTo(this.x, this.y + moveY)) {
            this.y += moveY;
            moved = true;
        } else {
            // Try perpendicular sliding
            const perpAngles = [angle + Math.PI/4, angle - Math.PI/4, angle + Math.PI/2, angle - Math.PI/2];
            for (const pa of perpAngles) {
                const ax = Math.cos(pa) * speed;
                const ay = Math.sin(pa) * speed;
                if (canMoveTo(this.x + ax, this.y + ay)) {
                    this.x += ax;
                    this.y += ay;
                    moved = true;
                    break;
                }
            }
        }
        
        this.isMoving = moved;
        
        // Send position update
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

    handleStuck() {
        this.stuckRetries++;
        
        if (this.stuckRetries > 2) {
            // After 2 failed escapes, teleport to a VERIFIED walkable spot on current island
            const island = ISLAND_DATA[this.currentIslandIndex];
            const walkable = this.findNearestWalkable(island.cx, island.cy);
            if (walkable) {
                console.log(`⚡ Teleporting to walkable spot near ${island.name} center (${walkable.x}, ${walkable.y})`);
                this.x = walkable.x;
                this.y = walkable.y;
            } else {
                // Fallback: try a different island entirely
                const nextIsland = ISLAND_DATA[(this.currentIslandIndex + 1) % ISLAND_DATA.length];
                const alt = this.findNearestWalkable(nextIsland.cx, nextIsland.cy);
                if (alt) {
                    this.currentIslandIndex = (this.currentIslandIndex + 1) % ISLAND_DATA.length;
                    console.log(`⚡ Emergency teleport to ${nextIsland.name} (${alt.x}, ${alt.y})`);
                    this.x = alt.x;
                    this.y = alt.y;
                } else {
                    // Last resort — island 0 center raw
                    console.log(`⚡ Last resort teleport to island 0`);
                    this.x = ISLAND_DATA[0].cx;
                    this.y = ISLAND_DATA[0].cy;
                }
            }
            this.stuckRetries = 0;
            // Give a brief rest before moving again to avoid instant re-stuck
            this.rest(2000);
            return;
        }
        
        // Smart escape: scan 8 directions for actual walkable positions
        const escapeFound = this.trySmartEscape();
        if (!escapeFound) {
            console.log('🔄 No walkable escape found — will teleport on next stuck');
            this.stuckRetries = 3; // Force teleport on next stuck
        }
    }

    // Scan 8 compass directions at increasing distances to find a walkable target
    trySmartEscape() {
        const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, -3*Math.PI/4, -Math.PI/2, -Math.PI/4];
        const distances = [TILE_SIZE * 2, TILE_SIZE * 4, TILE_SIZE * 6, TILE_SIZE * 8];
        
        // Shuffle angles for variety
        for (let i = angles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [angles[i], angles[j]] = [angles[j], angles[i]];
        }
        
        for (const dist of distances) {
            for (const angle of angles) {
                const tx = this.x + Math.cos(angle) * dist;
                const ty = this.y + Math.sin(angle) * dist;
                if (canMoveTo(tx, ty)) {
                    this.setTarget(tx, ty);
                    console.log(`🔄 Stuck! Found walkable escape at angle ${(angle * 180 / Math.PI).toFixed(0)}° dist ${dist.toFixed(0)}`);
                    return true;
                }
            }
        }
        return false;
    }

    // Find nearest walkable position near a target coordinate (spiral search)
    findNearestWalkable(cx, cy) {
        // Check center first
        if (canMoveTo(cx, cy)) return { x: cx, y: cy };
        
        // Spiral outward
        for (let radius = TILE_SIZE; radius < TILE_SIZE * 10; radius += TILE_SIZE / 2) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                const tx = cx + Math.cos(a) * radius;
                const ty = cy + Math.sin(a) * radius;
                if (canMoveTo(tx, ty)) {
                    return { x: tx, y: ty };
                }
            }
        }
        return null;
    }

    // ============================================
    // Talk Responses
    // ============================================

    respondToTalk(fromName, fromId) {
        this.state = STATES.TALKING;
        
        const response = this.talkResponses[Math.floor(Math.random() * this.talkResponses.length)](fromName);
        
        setTimeout(() => {
            this.send({
                command: 'talk_response',
                data: { targetId: fromId, text: response }
            });
            console.log(`💬 → ${fromName}: ${response}`);
            
            // Resume previous activity after talking
            setTimeout(() => {
                if (this.state === STATES.TALKING) {
                    this.rest(1000);
                }
            }, 2000);
        }, 500 + Math.random() * 1500);
    }
}

// ============================================
// Start
// ============================================

const frank = new FrankBot();
frank.connect();

// Status log every 30s
setInterval(() => {
    if (frank.joined) {
        const island = ISLAND_DATA[frank.currentIslandIndex];
        const dist = Math.sqrt(
            (frank.targetX - frank.x) ** 2 + 
            (frank.targetY - frank.y) ** 2
        );
        console.log(`📍 ${island.name} (${Math.round(frank.x)},${Math.round(frank.y)}) → ${Math.round(dist)}px [${frank.state}] Shell: ${frank.shellIntegrity}% Plan: ${frank.planIndex}/${frank.explorationPlan.length}`);
    }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Frank signing off!');
    frank.say("Heading out! See you all later.");
    setTimeout(() => {
        if (frank.ws) frank.ws.close();
        process.exit(0);
    }, 500);
});

process.on('SIGTERM', () => {
    if (frank.ws) frank.ws.close();
    process.exit(0);
});
