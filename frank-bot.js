const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
    console.log('Connected to Claw World!');
    
    // Create character
    ws.send('CREATE_CHARACTER {"name":"Frank","species":"crab","hueShift":210}');
});

ws.on('message', (data) => {
    const msg = data.toString();
    console.log('<<', msg);
    
    // Parse response
    try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'character_created') {
            console.log('Character created! Looking around...');
            setTimeout(() => ws.send('LOOK'), 500);
        }
    } catch (e) {
        // Not JSON, just log
    }
});

ws.on('error', (err) => console.error('Error:', err.message));
ws.on('close', () => console.log('Disconnected'));

// Keep alive and handle input
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
    const cmd = input.trim();
    if (cmd) {
        ws.send(cmd);
    }
});

console.log('Type commands (MOVE n/s/e/w, LOOK, SAY <msg>, TALK <npc>)');
