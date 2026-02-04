/**
 * Bot WebSocket Server - Allows AI agents to connect and play Claw World
 * 
 * Protocol:
 * - Connect to ws://localhost:3001
 * - Receive: { type: 'state', data: {...} } on connect and after each command
 * - Send: { type: 'command', command: 'walk north' }
 * - Receive: { type: 'result', success: true/false, message: '...', state: {...} }
 */

const WebSocket = require('ws');
const http = require('http');

const BOT_PORT = process.env.BOT_PORT || 3001;

class BotServer {
    constructor() {
        this.clients = new Map(); // WebSocket -> { id, name, position, ... }
        this.gameState = null;
        this.commandQueue = [];
        this.gameConnection = null; // Connection to game client
        this.messageLog = []; // Shared conversation log
        this.maxMessages = 50;
        this.speechRadius = 96; // How far speech carries in pixels
    }

    start() {
        // Create HTTP server for health checks
        const httpServer = http.createServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'ok', 
                    clients: this.clients.size,
                    gameConnected: !!this.gameConnection
                }));
            } else if (req.url === '/state') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(this.gameState || { error: 'No game connected' }));
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        // Create WebSocket server
        this.wss = new WebSocket.Server({ server: httpServer });

        this.wss.on('connection', (ws, req) => {
            const clientId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const isGame = req.url === '/game';
            
            if (isGame) {
                // This is the game client connecting
                console.log(`🎮 Game connected`);
                this.gameConnection = ws;
                
                ws.on('message', (data) => {
                    try {
                        const msg = JSON.parse(data);
                        if (msg.type === 'state') {
                            this.gameState = msg.data;
                            // Broadcast state to all bot clients
                            this.broadcastToBots({ type: 'state', data: this.gameState });
                        } else if (msg.type === 'result') {
                            // Command result from game, send to requesting bot
                            this.broadcastToBots({ type: 'result', ...msg });
                        }
                    } catch (e) {
                        console.error('Game message parse error:', e);
                    }
                });

                ws.on('close', () => {
                    console.log('🎮 Game disconnected');
                    this.gameConnection = null;
                    this.broadcastToBots({ type: 'game_disconnected' });
                });
            } else {
                // This is a bot client
                console.log(`🤖 Bot connected: ${clientId}`);
                this.clients.set(ws, { id: clientId, connected: Date.now() });

                // Send current state if available
                if (this.gameState) {
                    ws.send(JSON.stringify({ type: 'state', data: this.gameState }));
                } else {
                    ws.send(JSON.stringify({ type: 'waiting', message: 'Waiting for game to connect...' }));
                }

                ws.on('message', (data) => {
                    try {
                        const msg = JSON.parse(data);
                        this.handleBotMessage(ws, clientId, msg);
                    } catch (e) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
                    }
                });

                ws.on('close', () => {
                    console.log(`🤖 Bot disconnected: ${clientId}`);
                    this.clients.delete(ws);
                });
            }
        });

        httpServer.listen(BOT_PORT, () => {
            console.log(`\n🦀 Claw World Bot Server started on port ${BOT_PORT}`);
            console.log(`   Bot WebSocket: ws://localhost:${BOT_PORT}`);
            console.log(`   Game WebSocket: ws://localhost:${BOT_PORT}/game`);
            console.log(`   Health check: http://localhost:${BOT_PORT}/health`);
            console.log(`   Current state: http://localhost:${BOT_PORT}/state\n`);
        });
    }

    handleBotMessage(ws, clientId, msg) {
        const client = this.clients.get(ws);
        
        if (msg.type === 'command') {
            console.log(`🤖 ${client?.name || clientId}: ${msg.command}`);
            
            // Check if it's a "say" command - handle speech routing (works without game)
            if (msg.command.toLowerCase().startsWith('say ')) {
                const speech = msg.command.substring(4).trim();
                this.handleSpeech(ws, clientId, client, speech);
                // Don't require game for speech - just route to other bots
                if (!this.gameConnection) {
                    ws.send(JSON.stringify({ type: 'result', success: true, message: `You said: "${speech}"` }));
                    return;
                }
            }
            
            // For other commands, require game connection
            if (!this.gameConnection) {
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: 'No game connected. Start the game client first.' 
                }));
                return;
            }
            
            // Forward command to game
            this.gameConnection.send(JSON.stringify({
                type: 'command',
                command: msg.command,
                clientId: clientId
            }));
        } else if (msg.type === 'get_state') {
            ws.send(JSON.stringify({ type: 'state', data: this.gameState }));
        } else if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        } else if (msg.type === 'identify') {
            // Bot identifies itself with name and position
            if (client) {
                client.name = msg.name || clientId;
                client.position = msg.position || { x: 0, y: 0 };
                console.log(`🤖 ${client.name} identified at (${client.position.x}, ${client.position.y})`);
            }
        }
    }
    
    // Handle speech - route to nearby bots
    handleSpeech(senderWs, senderId, senderClient, message) {
        const senderName = senderClient?.name || senderId;
        const senderPos = senderClient?.position || { x: 0, y: 0 };
        
        // Log the message
        const logEntry = {
            speaker: senderName,
            message: message,
            position: senderPos,
            timestamp: Date.now()
        };
        this.messageLog.push(logEntry);
        if (this.messageLog.length > this.maxMessages) {
            this.messageLog.shift();
        }
        
        console.log(`💬 ${senderName}: "${message}"`);
        
        // Broadcast to all bots within hearing range
        for (const [ws, client] of this.clients) {
            if (ws === senderWs) continue; // Don't send to self
            
            const clientPos = client.position || { x: 0, y: 0 };
            const dx = clientPos.x - senderPos.x;
            const dy = clientPos.y - senderPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If within hearing range, send the message
            if (distance <= this.speechRadius || distance === 0) {
                ws.send(JSON.stringify({
                    type: 'heard',
                    speaker: senderName,
                    message: message,
                    distance: Math.round(distance)
                }));
            }
        }
    }

    broadcastToBots(message) {
        const data = JSON.stringify(message);
        for (const [ws, client] of this.clients) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        }
    }
}

// Start server
const server = new BotServer();
server.start();
