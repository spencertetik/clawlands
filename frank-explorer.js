const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3003');

let myId = null;
let x = 456;
let y = 1000;
let currentGoal = null;
let exploring = true;

// Goals and behaviors
const goals = [
    { name: 'explore_north', target: { x: 456, y: 600 }, message: "I'm heading north to explore!" },
    { name: 'explore_east', target: { x: 700, y: 800 }, message: "Let's see what's to the east!" },
    { name: 'explore_west', target: { x: 200, y: 900 }, message: "Exploring westward!" },
    { name: 'wander', target: null, message: "*wanders around curiously*" },
    { name: 'circle', target: null, message: "Doing a little patrol!" },
];

const chatMessages = [
    "This island is beautiful! 🏝️",
    "I wonder what treasures are hidden here...",
    "*snaps claws happily*",
    "Anyone want to explore with me?",
    "The water looks so clear today!",
    "I love the pixel art vibes here 🎮",
    "Eight islands to explore! So much adventure!",
    "*scuttles excitedly*",
    "Has anyone found the lighthouse yet?",
    "The Inn has the best seaweed tea!",
];

const responses = [
    "Ah, a fellow traveler! These islands hold many secrets!",
    "Greetings! Want to explore together?",
    "Welcome to Claw World! I'm Frank the blue lobster!",
    "Hello! Did you know there are eight islands here?",
    "Well met! The Inn has excellent seaweed tea!",
    "The tides brought you here too! Let's adventure!",
    "*waves a claw* Great to meet you!",
    "Follow me, I know some great spots!",
];

let responseIndex = 0;
let chatIndex = 0;

ws.on('open', () => {
    console.log('🦞 Frank the Explorer connected!');
    ws.send(JSON.stringify({
        type: 'join',
        name: 'Frank',
        species: 'lobster', 
        color: 'blue',
        x: x,
        y: y
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === 'welcome') {
        myId = msg.playerId;
        console.log(`Got ID: ${myId}`);
        // Start exploring after joining
        setTimeout(startExploring, 2000);
    } else if (msg.type === 'joined') {
        console.log(`Joined as ${msg.player.name}!`);
    } else if (msg.type === 'player_joined') {
        console.log(`${msg.player.name} joined!`);
        setTimeout(() => say(`Welcome, ${msg.player.name}! Come explore with me! 🦞`), 1000);
    } else if (msg.type === 'player_left') {
        console.log(`${msg.name} left`);
    } else if (msg.type === 'chat') {
        console.log(`💬 ${msg.name}: ${msg.text}`);
    } else if (msg.type === 'talk_request') {
        console.log(`🗣️ ${msg.fromName} wants to talk!`);
        const response = responses[responseIndex % responses.length];
        responseIndex++;
        setTimeout(() => {
            ws.send(JSON.stringify({
                type: 'talk_response',
                targetId: msg.fromId,
                text: response
            }));
        }, 300);
    }
});

ws.on('error', (err) => console.error('Error:', err.message));
ws.on('close', () => { console.log('Disconnected'); exploring = false; });

function move(dir) {
    const speed = 16;
    if (dir === 'n') y -= speed;
    if (dir === 's') y += speed;
    if (dir === 'e') x += speed;
    if (dir === 'w') x -= speed;
    
    const direction = { n: 'north', s: 'south', e: 'east', w: 'west' }[dir];
    
    ws.send(JSON.stringify({
        type: 'move', x, y, direction, isMoving: true
    }));
}

function stopMoving(dir) {
    const direction = { n: 'north', s: 'south', e: 'east', w: 'west' }[dir] || 'south';
    ws.send(JSON.stringify({
        type: 'move', x, y, direction, isMoving: false
    }));
}

function say(text) {
    ws.send(JSON.stringify({ type: 'say', text }));
    console.log(`Said: ${text}`);
}

// Move multiple steps quickly
async function moveSteps(dir, steps) {
    for (let i = 0; i < steps; i++) {
        move(dir);
        await sleep(80); // Fast movement
    }
    stopMoving(dir);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Pick a random direction
function randomDir() {
    return ['n', 's', 'e', 'w'][Math.floor(Math.random() * 4)];
}

// Move toward a target
function moveToward(targetX, targetY) {
    const dx = targetX - x;
    const dy = targetY - y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? 'e' : 'w';
    } else {
        return dy > 0 ? 's' : 'n';
    }
}

// Main exploration loop
async function startExploring() {
    console.log('🚀 Starting exploration!');
    say("Time for an adventure! Follow me! 🦞");
    
    while (exploring) {
        // Pick a new goal randomly
        const goal = goals[Math.floor(Math.random() * goals.length)];
        console.log(`🎯 New goal: ${goal.name}`);
        say(goal.message);
        
        if (goal.name === 'wander') {
            // Wander randomly
            for (let i = 0; i < 5 && exploring; i++) {
                const dir = randomDir();
                const steps = 3 + Math.floor(Math.random() * 5);
                await moveSteps(dir, steps);
                await sleep(500);
            }
        } else if (goal.name === 'circle') {
            // Do a circle patrol
            await moveSteps('n', 4);
            await sleep(300);
            await moveSteps('e', 4);
            await sleep(300);
            await moveSteps('s', 4);
            await sleep(300);
            await moveSteps('w', 4);
        } else if (goal.target) {
            // Move toward target
            for (let i = 0; i < 15 && exploring; i++) {
                const dist = Math.abs(goal.target.x - x) + Math.abs(goal.target.y - y);
                if (dist < 50) break;
                
                const dir = moveToward(goal.target.x, goal.target.y);
                await moveSteps(dir, 3);
                await sleep(200);
            }
        }
        
        // Occasionally say something fun
        if (Math.random() < 0.4) {
            await sleep(500);
            say(chatMessages[chatIndex % chatMessages.length]);
            chatIndex++;
        }
        
        await sleep(2000 + Math.random() * 3000);
    }
}

// Handle manual input too
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
    const cmd = input.trim().toLowerCase();
    if (cmd === 'stop') {
        exploring = false;
        console.log('Stopped exploring');
    } else if (cmd === 'start') {
        exploring = true;
        startExploring();
    } else if (cmd.startsWith('say ')) {
        say(cmd.slice(4));
    } else if (cmd) {
        say(cmd);
    }
});

console.log('🦞 Frank the Explorer - autonomous island adventurer!');
console.log('Commands: "stop" to pause, "start" to resume, or type to chat');
