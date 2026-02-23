const { EventSource } = require('eventsource');

const MCP_URL = 'http://localhost:3000/mcp';

async function main() {
    console.log('📡 Connecting to Web MCP (SSE) at', MCP_URL);
    const es = new EventSource(MCP_URL);

    const pendingRequests = new Map();
    let nextId = 1;

    es.onerror = (err) => console.error('❌ SSE Error:', err.message || err);

    // Listen for JSON-RPC responses on the SSE stream
    es.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.id && pendingRequests.has(msg.id)) {
                const { resolve, reject } = pendingRequests.get(msg.id);
                pendingRequests.delete(msg.id);
                if (msg.error) reject(new Error(JSON.stringify(msg.error)));
                else resolve(msg.result);
            } else {
                console.log('📨 SSE event:', JSON.stringify(msg).slice(0, 120));
            }
        } catch (e) {
            console.log('📨 Non-JSON SSE:', event.data?.slice(0, 100));
        }
    };

    es.addEventListener('endpoint', async (event) => {
        const postUrl = new URL(event.data, 'http://localhost:3000').href;
        console.log('✅ Session endpoint:', postUrl);

        const callTool = (name, args) => {
            const id = nextId++;
            return new Promise((resolve, reject) => {
                pendingRequests.set(id, { resolve, reject });

                // Timeout after 10s
                setTimeout(() => {
                    if (pendingRequests.has(id)) {
                        pendingRequests.delete(id);
                        reject(new Error('Timeout waiting for response'));
                    }
                }, 10000);

                fetch(postUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id,
                        method: 'tools/call',
                        params: { name, arguments: args }
                    })
                }).catch(reject);
            });
        };

        try {
            // 1. Register
            console.log('\n🚀 Joining game...');
            const joinResult = await callTool('register', {
                name: 'WebMCPBot',
                species: 'mantis_shrimp',
                color: 'gold'
            });
            console.log('✅', joinResult.content[0].text);

            // 2. Look around
            console.log('\n👀 Looking around...');
            const lookResult = await callTool('look', {});
            console.log('✅', lookResult.content[0].text);

            // 3. Move
            console.log('\n🚶 Moving south 3 steps...');
            const moveResult = await callTool('move', { direction: 'south', steps: 3 });
            console.log('✅', moveResult.content[0].text);

            // 4. Chat
            console.log('\n💬 Sending chat...');
            const chatResult = await callTool('chat', { message: 'I joined via Web MCP! 🌐🦞' });
            console.log('✅', chatResult.content[0].text);

            console.log('\n✨ All Web MCP tools working! Bot is connected as a bot (not player).');
            console.log('   Watch at: https://claw-world.netlify.app/game.html?spectate=WebMCPBot');
            console.log('\n   Press Ctrl+C to disconnect.');
        } catch (err) {
            console.error('❌ Error:', err.message);
        }
    });
}

main();
