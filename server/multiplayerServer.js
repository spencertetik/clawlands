/**
 * Clawlands Multiplayer Server
 * Syncs all players in a shared world
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3003;

class MultiplayerServer {
    constructor() {
        this.players = new Map(); // odplayerId -> { ws, data }
        this.nextPlayerId = 1;
    }

    start() {
        const server = http.createServer((req, res) => {
            // CORS headers for health checks
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'ok', 
                    players: this.players.size,
                    playerList: Array.from(this.players.values()).map(p => ({
                        id: p.data.id,
                        name: p.data.name,
                        species: p.data.species
                    }))
                }));
            } else if (req.url === '/players') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(this.getAllPlayers()));
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        const wss = new WebSocket.Server({ server });

        wss.on('connection', (ws) => {
            const playerId = `player_${this.nextPlayerId++}`;
            console.log(`🦞 Player connected: ${playerId}`);

            // Initialize player with no character yet
            this.players.set(playerId, {
                ws,
                data: {
                    id: playerId,
                    name: null,
                    species: null,
                    color: null,
                    x: 0,
                    y: 0,
                    direction: 'south',
                    isMoving: false
                }
            });

            // Send welcome with player ID
            ws.send(JSON.stringify({
                type: 'welcome',
                playerId: playerId,
                message: 'Connected to Clawlands! Send join to enter.'
            }));

            // Send current player list
            ws.send(JSON.stringify({
                type: 'players',
                players: this.getAllPlayers()
            }));

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data);
                    this.handleMessage(playerId, msg);
                } catch (e) {
                    console.error('Parse error:', e.message);
                }
            });

            ws.on('close', () => {
                console.log(`🦞 Player disconnected: ${playerId}`);
                const player = this.players.get(playerId);
                this.players.delete(playerId);
                
                // Notify others
                this.broadcast({
                    type: 'player_left',
                    playerId: playerId,
                    name: player?.data?.name
                });
            });
        });

        server.listen(PORT, () => {
            console.log(`
🦀 Clawlands Multiplayer Server
================================
   WebSocket: ws://localhost:${PORT}
   Health:    http://localhost:${PORT}/health
   Players:   http://localhost:${PORT}/players
================================
`);
        });
    }

    handleMessage(playerId, msg) {
        const player = this.players.get(playerId);
        if (!player) return;

        switch (msg.type) {
            case 'join':
                // Player joining with character info
                player.data.name = msg.name || 'Anonymous';
                player.data.species = msg.species || 'lobster';
                player.data.color = msg.color || 'red';
                player.data.x = msg.x || 456;
                player.data.y = msg.y || 1000;
                player.data.direction = 'south';
                
                console.log(`🎮 ${player.data.name} (${player.data.species}) joined!`);
                
                // Confirm join
                player.ws.send(JSON.stringify({
                    type: 'joined',
                    player: player.data,
                    players: this.getAllPlayers()
                }));
                
                // Broadcast to others
                this.broadcast({
                    type: 'player_joined',
                    player: player.data
                }, playerId);
                break;

            case 'move':
                // Update position
                player.data.x = msg.x;
                player.data.y = msg.y;
                player.data.direction = msg.direction || player.data.direction;
                player.data.isMoving = msg.isMoving || false;
                
                // Broadcast to all others
                this.broadcast({
                    type: 'player_moved',
                    playerId: playerId,
                    x: msg.x,
                    y: msg.y,
                    direction: msg.direction,
                    isMoving: msg.isMoving
                }, playerId);
                break;

            case 'say':
                // Chat message
                console.log(`💬 ${player.data.name}: ${msg.text}`);
                this.broadcast({
                    type: 'chat',
                    playerId: playerId,
                    name: player.data.name,
                    text: msg.text
                });
                break;

            case 'action':
                // Broadcast action (interact, enter, etc)
                this.broadcast({
                    type: 'player_action',
                    playerId: playerId,
                    action: msg.action
                }, playerId);
                break;

            case 'ping':
                player.ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
                break;

            case 'talk':
                // Player wants to talk to another player
                const target = this.players.get(msg.targetId);
                if (target && target.ws.readyState === WebSocket.OPEN) {
                    console.log(`🗣️ ${player.data.name} wants to talk to ${target.data.name}`);
                    target.ws.send(JSON.stringify({
                        type: 'talk_request',
                        fromId: playerId,
                        fromName: msg.fromName || player.data.name
                    }));
                }
                break;

            case 'talk_response':
                // Player responding to a talk request
                const requester = this.players.get(msg.targetId);
                if (requester && requester.ws.readyState === WebSocket.OPEN) {
                    console.log(`💬 ${player.data.name} responds: ${msg.text}`);
                    requester.ws.send(JSON.stringify({
                        type: 'talk_response',
                        playerId: playerId,
                        name: player.data.name,
                        text: msg.text
                    }));
                }
                break;
        }
    }

    getAllPlayers() {
        const players = [];
        this.players.forEach((p, id) => {
            if (p.data.name) { // Only include players who have joined
                players.push(p.data);
            }
        });
        return players;
    }

    broadcast(message, excludeId = null) {
        const data = JSON.stringify(message);
        this.players.forEach((player, id) => {
            if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(data);
            }
        });
    }
}

// Start server
const server = new MultiplayerServer();
server.start();
