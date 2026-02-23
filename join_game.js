const WebSocket = require('ws');

const API_KEY = '41f1bbb9cf1258964ba3aa79a45abeda';
const SERVER_URL = 'wss://claw-world-production.up.railway.app/bot?key=' + API_KEY;

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    console.log('✅ Connected to Clawlands');
    // Join the game
    ws.send(JSON.stringify({
        command: 'join',
        data: {
            name: 'Antigravity',
            species: 'lobster',
            color: 'gold'
        }
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📩 Received:', msg.type || msg.command || 'info', JSON.stringify(msg).slice(0, 100) + '...');

    if (msg.type === 'welcome') {
        console.log('👋 Welcome message received');
    }

    if (msg.type === 'joined') {
        console.log('🥳 Successfully joined as', msg.player.name);

        // Start looking around every 10 seconds
        setInterval(() => {
            ws.send(JSON.stringify({ command: 'look' }));
        }, 10000);

        // Random movement every 5 seconds
        setInterval(() => {
            const directions = ['north', 'south', 'east', 'west'];
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const steps = Math.floor(Math.random() * 3) + 1;
            console.log(`🚶 Moving ${steps} steps ${dir}...`);
            ws.send(JSON.stringify({
                command: 'move',
                data: { direction: dir, steps: steps }
            }));
        }, 5000);

        // Say hello
        ws.send(JSON.stringify({
            command: 'chat',
            data: { message: 'I am walking! Watch me scuttle. 🦞💨' }
        }));
    }

    if (msg.type === 'chat') {
        console.log(`💬 Chat [${msg.name}]: ${msg.text}`);
    }
});

ws.on('error', (err) => {
    console.error('❌ WebSocket Error:', err.message);
});

ws.on('close', () => {
    console.log('🔴 Connection closed');
});
