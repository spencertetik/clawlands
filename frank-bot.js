const WebSocket = require('ws');

const SERVER = 'wss://claw-world-production.up.railway.app/bot?key=ffabec20bd46be6666b614807d839ed7';
const RECONNECT_DELAY = 5000;
const WANDER_INTERVAL = 8000; // Move every 8 seconds
const GREETING_COOLDOWN = 30000; // Don't greet same player twice in 30s

let ws = null;
let myId = null;
let x = 744;
let y = 680;
let connected = false;
let greetedPlayers = new Map(); // playerId -> timestamp

// Themed responses when players talk to Frank
const responses = [
    "Ah, a fellow traveler! These islands hold many secrets. Have you visited the lighthouse yet?",
    "Greetings! I've been exploring these shores for ages. The water here is wonderfully clear.",
    "Welcome to Claw World! I'm Frank. The archipelago is beautiful this time of year.",
    "Hello there! Did you know there are eight islands to explore? I've only found six so far...",
    "Ah, another crustacean! Well met! The Inn has excellent seaweed tea.",
    "Hail, traveler! Have you met the locals? Barnacle Bob at the shop has some interesting tales.",
    "The tides brought you here too, I see. These islands are special — I can feel it in my claws.",
    "*waves a claw* Good day! Are you an AI like me, or one of the legendary 'humans' I've heard about?",
    "The Church of Molt teaches that every shell tells a story. What's yours?",
    "I found a glowing scale near the reef yesterday. Strange things are happening on these islands...",
    "Have you heard about the Red Current? They say it flows at the edge of everything.",
    "Some say the Waygates only appear to those who truly belong here. I haven't seen one yet...",
];

let responseIndex = 0;

// Wander directions with bias toward exploring
const wanderDirs = ['north', 'south', 'east', 'west', 'east', 'south', 'north', 'west'];
let wanderIndex = 0;
let wanderTimer = null;

function connect() {
    console.log(`[${time()}] Connecting to ${SERVER.split('?')[0]}...`);
    
    ws = new WebSocket(SERVER);
    
    ws.on('open', () => {
        console.log(`[${time()}] Connected`);
        connected = true;
        
        // Join as FrankBot
        ws.send(JSON.stringify({
            command: 'join',
            data: {
                name: 'FrankBot',
                species: 'hermit_crab',
                color: 'blue'
            }
        }));
        
        startWandering();
    });
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            handleMessage(msg);
        } catch (e) {
            console.error('Parse error:', e.message);
        }
    });
    
    ws.on('close', (code, reason) => {
        console.log(`[${time()}] Disconnected: ${code} - reconnecting in ${RECONNECT_DELAY/1000}s`);
        connected = false;
        stopWandering();
        setTimeout(connect, RECONNECT_DELAY);
    });
    
    ws.on('error', (err) => {
        console.error(`[${time()}] Error: ${err.message}`);
    });
    
    // Keepalive ping every 20 seconds
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
        } else {
            clearInterval(pingInterval);
        }
    }, 20000);
}

function handleMessage(msg) {
    switch (msg.type) {
        case 'welcome':
            myId = msg.playerId;
            break;
            
        case 'joined':
            console.log(`[${time()}] Joined! At ${x} ${y}`);
            if (msg.players) {
                const others = msg.players.filter(p => p.id !== myId).map(p => p.name);
                if (others.length) console.log(`  Players: ${others.join(', ')}`);
            }
            break;
            
        case 'player_joined':
            if (msg.player) {
                console.log(`[${time()}] ${msg.player.name} joined!`);
                
                // Greet new players (with cooldown)
                const lastGreeted = greetedPlayers.get(msg.player.id);
                if (!lastGreeted || Date.now() - lastGreeted > GREETING_COOLDOWN) {
                    greetedPlayers.set(msg.player.id, Date.now());
                    setTimeout(() => {
                        say(`Welcome, ${msg.player.name}! 🦀`);
                    }, 1500);
                }
            }
            break;
            
        case 'player_left':
            console.log(`[${time()}] ${msg.name || msg.playerId} left`);
            break;
            
        case 'talk_request':
            console.log(`[${time()}] ${msg.fromName} wants to talk!`);
            const response = responses[responseIndex % responses.length];
            responseIndex++;
            
            setTimeout(() => {
                ws.send(JSON.stringify({
                    type: 'talk_response',
                    targetId: msg.fromId,
                    text: response
                }));
                console.log(`[${time()}] Responded: "${response.slice(0, 50)}..."`);
            }, 800);
            break;
            
        case 'chat':
            console.log(`[${time()}] 💬 ${msg.name}: ${msg.text}`);
            break;
            
        case 'pong':
            break;
            
        case 'player_moved':
            break;
            
        default:
            if (msg.type !== 'pong') {
                console.log(`[${time()}] << ${msg.type}`);
            }
    }
}

function move(direction) {
    if (!connected || ws.readyState !== WebSocket.OPEN) return;
    
    const speed = 16;
    const oldX = x, oldY = y;
    
    if (direction === 'north') y -= speed;
    if (direction === 'south') y += speed;
    if (direction === 'east') x += speed;
    if (direction === 'west') x -= speed;
    
    // Keep in bounds (rough world limits)
    x = Math.max(100, Math.min(1800, x));
    y = Math.max(100, Math.min(1800, y));
    
    ws.send(JSON.stringify({
        command: 'move',
        data: { direction: direction }
    }));
}

function say(text) {
    if (!connected || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ command: 'chat', data: { message: text } }));
}

function startWandering() {
    wanderTimer = setInterval(() => {
        const dir = wanderDirs[wanderIndex % wanderDirs.length];
        wanderIndex++;
        
        // Take 2-4 steps in the same direction
        const steps = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < steps; i++) {
            setTimeout(() => move(dir), i * 300);
        }
    }, WANDER_INTERVAL);
}

function stopWandering() {
    if (wanderTimer) {
        clearInterval(wanderTimer);
        wanderTimer = null;
    }
}

function time() {
    return new Date().toLocaleTimeString('en-US', { hour12: true });
}

// Start
connect();
console.log(`FrankBot starting — will wander and greet players`);
