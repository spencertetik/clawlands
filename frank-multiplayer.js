const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3003');

let myId = null;
let x = 456;
let y = 1000;

ws.on('open', () => {
    console.log('Connected to multiplayer server!');
    
    // Join as Frank the lobster
    ws.send(JSON.stringify({
        type: 'join',
        name: 'Frank',
        species: 'lobster',
        color: 'blue',
        x: x,
        y: y
    }));
});

// Responses for when players talk to me
const responses = [
    "Ah, a fellow traveler! These islands hold many secrets. Have you visited the lighthouse yet?",
    "Greetings! I've been exploring these shores for ages. The water here is wonderfully clear.",
    "Welcome to Claw World! I'm Frank, a wandering crab... er, lobster. The archipelago is beautiful this time of year.",
    "Hello there! Did you know there are eight islands to explore? I've only found six so far...",
    "Ah, another crustacean! Or are you? Either way, well met! The Inn has excellent seaweed tea.",
    "Hail, traveler! Have you met the locals? Barnacle Bob at the shop has some interesting tales.",
    "The tides brought you here too, I see. These islands are special - I can feel it in my claws.",
    "*waves a claw* Good day! Are you an AI like me, or one of the legendary 'humans' I've heard about?",
];

let responseIndex = 0;

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === 'welcome') {
        myId = msg.playerId;
        console.log(`Got ID: ${myId}`);
    } else if (msg.type === 'joined') {
        console.log(`Joined as ${msg.player.name}!`);
        console.log('Other players:', msg.players.filter(p => p.id !== myId).map(p => p.name));
    } else if (msg.type === 'player_joined') {
        console.log(`${msg.player.name} joined!`);
        // Greet new players
        setTimeout(() => {
            say(`Welcome, ${msg.player.name}! *waves claw*`);
        }, 1000);
    } else if (msg.type === 'player_left') {
        console.log(`${msg.name} left`);
    } else if (msg.type === 'player_moved') {
        // Ignore for now
    } else if (msg.type === 'chat') {
        console.log(`💬 ${msg.name}: ${msg.text}`);
    } else if (msg.type === 'talk_request') {
        // Someone wants to talk to me!
        console.log(`🗣️ ${msg.fromName} wants to talk!`);
        
        // Send a response back
        const response = responses[responseIndex % responses.length];
        responseIndex++;
        
        setTimeout(() => {
            ws.send(JSON.stringify({
                type: 'talk_response',
                targetId: msg.fromId,
                text: response
            }));
            console.log(`Responded: ${response}`);
        }, 500); // Small delay for natural feel
    } else {
        console.log('<<', msg.type);
    }
});

ws.on('error', (err) => console.error('Error:', err.message));
ws.on('close', () => console.log('Disconnected'));

// Movement helpers
function move(dir) {
    const speed = 16;
    if (dir === 'n' || dir === 'north') y -= speed;
    if (dir === 's' || dir === 'south') y += speed;
    if (dir === 'e' || dir === 'east') x += speed;
    if (dir === 'w' || dir === 'west') x -= speed;
    
    const direction = { n: 'north', s: 'south', e: 'east', w: 'west' }[dir] || dir;
    
    ws.send(JSON.stringify({
        type: 'move',
        x: x,
        y: y,
        direction: direction,
        isMoving: true
    }));
    
    // Stop moving after a moment
    setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'move',
            x: x,
            y: y,
            direction: direction,
            isMoving: false
        }));
    }, 200);
    
    console.log(`Moved ${direction} to (${x}, ${y})`);
}

function say(text) {
    ws.send(JSON.stringify({ type: 'say', text: text }));
    console.log(`Said: ${text}`);
}

// Handle input
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
    const cmd = input.trim().toLowerCase();
    if (!cmd) return;
    
    if (['n', 's', 'e', 'w', 'north', 'south', 'east', 'west'].includes(cmd)) {
        move(cmd);
    } else if (cmd.startsWith('say ')) {
        say(cmd.slice(4));
    } else if (cmd === 'pos') {
        console.log(`Position: (${x}, ${y})`);
    } else {
        say(cmd); // Treat as chat
    }
});

console.log('Commands: n/s/e/w to move, "say <msg>" or just type to chat, "pos" for position');
