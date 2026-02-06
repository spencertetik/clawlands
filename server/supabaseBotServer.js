/**
 * Supabase Bot Server - Secure API for AI agents to play Claw World
 * 
 * Uses Supabase service role for elevated access.
 * Bots connect via WebSocket with API key authentication.
 * 
 * Environment variables:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_KEY - Service role key (keep secret!)
 *   BOT_API_KEYS - Comma-separated list of valid bot API keys
 *   BOT_PORT - Server port (default 3001)
 */

const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const PORT = process.env.BOT_PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BOT_API_KEYS = (process.env.BOT_API_KEYS || '').split(',').filter(k => k);

// Rate limiting
const RATE_LIMIT = {
    windowMs: 60000,        // 1 minute
    maxRequests: 120,       // Max requests per window
    maxConnections: 10      // Max concurrent connections
};

class SupabaseBotServer {
    constructor() {
        this.clients = new Map();  // ws -> { botId, player, rateLimit }
        this.supabase = null;
        
        if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                auth: { persistSession: false }
            });
            console.log('✅ Supabase connected');
        } else {
            console.warn('⚠️ Supabase not configured - running in mock mode');
        }
    }

    /**
     * Hash an API key for storage/comparison
     */
    hashKey(key) {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    /**
     * Validate API key
     */
    validateApiKey(key) {
        if (!key) return false;
        // Check against configured keys
        if (BOT_API_KEYS.length > 0) {
            return BOT_API_KEYS.includes(key);
        }
        // If no keys configured, allow any non-empty key (dev mode)
        console.warn('⚠️ No BOT_API_KEYS configured - accepting any key (dev mode)');
        return key.length >= 8;
    }

    /**
     * Check rate limit for a client
     */
    checkRateLimit(clientData) {
        const now = Date.now();
        
        // Reset window if expired
        if (now > clientData.rateLimit.windowEnd) {
            clientData.rateLimit = {
                count: 0,
                windowEnd: now + RATE_LIMIT.windowMs
            };
        }
        
        clientData.rateLimit.count++;
        return clientData.rateLimit.count <= RATE_LIMIT.maxRequests;
    }

    /**
     * Start the server
     */
    start() {
        const httpServer = http.createServer((req, res) => {
            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
            
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    clients: this.clients.size,
                    supabase: !!this.supabase
                }));
            } else if (req.url === '/docs') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(this.getDocsHtml());
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        const wss = new WebSocket.Server({ server: httpServer });

        wss.on('connection', (ws, req) => {
            // Check connection limit
            if (this.clients.size >= RATE_LIMIT.maxConnections) {
                ws.close(4003, 'Too many connections');
                return;
            }

            // Extract API key from query params
            const url = new URL(req.url, `http://${req.headers.host}`);
            const apiKey = url.searchParams.get('key');

            // Validate API key
            if (!this.validateApiKey(apiKey)) {
                ws.close(4001, 'Invalid API key');
                console.log('❌ Rejected connection: invalid API key');
                return;
            }

            const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const clientData = {
                botId,
                apiKey: this.hashKey(apiKey),
                player: null,
                rateLimit: {
                    count: 0,
                    windowEnd: Date.now() + RATE_LIMIT.windowMs
                }
            };
            
            this.clients.set(ws, clientData);
            console.log(`🤖 Bot connected: ${botId}`);

            // Send welcome message
            this.send(ws, {
                type: 'connected',
                botId,
                message: 'Connected to Claw World. Use "join" command to enter the game.'
            });

            ws.on('message', async (data) => {
                try {
                    // Rate limit check
                    if (!this.checkRateLimit(clientData)) {
                        this.send(ws, { type: 'error', message: 'Rate limit exceeded' });
                        return;
                    }

                    const msg = JSON.parse(data);
                    await this.handleMessage(ws, clientData, msg);
                } catch (e) {
                    this.send(ws, { type: 'error', message: 'Invalid message format' });
                }
            });

            ws.on('close', async () => {
                console.log(`🔌 Bot disconnected: ${clientData.botId}`);
                
                // Clean up presence if player was in game
                if (clientData.player && this.supabase) {
                    await this.supabase
                        .from('player_presence')
                        .delete()
                        .eq('id', clientData.player.id);
                }
                
                this.clients.delete(ws);
            });
        });

        httpServer.listen(PORT, () => {
            console.log(`\n🦀 Claw World Bot Server (Supabase) started on port ${PORT}`);
            console.log(`   WebSocket: ws://localhost:${PORT}?key=YOUR_API_KEY`);
            console.log(`   Health: http://localhost:${PORT}/health`);
            console.log(`   Docs: http://localhost:${PORT}/docs\n`);
        });
    }

    /**
     * Handle incoming bot message
     */
    async handleMessage(ws, clientData, msg) {
        const { command, data } = msg;

        switch (command) {
            case 'join':
                await this.handleJoin(ws, clientData, data);
                break;
            case 'move':
                await this.handleMove(ws, clientData, data);
                break;
            case 'chat':
                await this.handleChat(ws, clientData, data);
                break;
            case 'look':
                await this.handleLook(ws, clientData);
                break;
            case 'players':
                await this.handleGetPlayers(ws, clientData);
                break;
            case 'leave':
                await this.handleLeave(ws, clientData);
                break;
            default:
                this.send(ws, { type: 'error', message: `Unknown command: ${command}` });
        }
    }

    /**
     * Handle bot joining the game
     */
    async handleJoin(ws, clientData, data) {
        const { name, species, color } = data || {};
        
        if (!name) {
            this.send(ws, { type: 'error', message: 'Name required' });
            return;
        }

        const sanitizedName = this.sanitizeName(name);
        
        if (this.supabase) {
            // Create bot user via service role
            const { data: player, error } = await this.supabase
                .from('players')
                .insert({
                    name: sanitizedName,
                    species: species || 'lobster',
                    color: color || 'red',
                    user_id: null  // Bots don't have auth user
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    this.send(ws, { type: 'error', message: 'Name already taken' });
                } else {
                    this.send(ws, { type: 'error', message: error.message });
                }
                return;
            }

            clientData.player = player;

            // Add presence
            await this.supabase.from('player_presence').insert({
                id: player.id,
                x: player.last_x || 744,
                y: player.last_y || 680,
                facing: 'down'
            });

            // Log bot session
            await this.supabase.from('bot_sessions').insert({
                player_id: player.id,
                bot_name: sanitizedName,
                api_key_hash: clientData.apiKey
            });

            this.send(ws, {
                type: 'joined',
                player: {
                    id: player.id,
                    name: player.name,
                    species: player.species,
                    color: player.color,
                    x: player.last_x,
                    y: player.last_y
                }
            });
        } else {
            // Mock mode
            clientData.player = {
                id: clientData.botId,
                name: sanitizedName,
                species: species || 'lobster',
                x: 744,
                y: 680
            };
            
            this.send(ws, {
                type: 'joined',
                player: clientData.player
            });
        }
    }

    /**
     * Handle movement command
     */
    async handleMove(ws, clientData, data) {
        if (!clientData.player) {
            this.send(ws, { type: 'error', message: 'Not in game. Use "join" first.' });
            return;
        }

        const { direction, x, y } = data || {};
        let newX = clientData.player.x || 744;
        let newY = clientData.player.y || 680;
        
        // Direction-based movement (16 pixels per step)
        const step = 16;
        if (direction) {
            switch (direction.toLowerCase()) {
                case 'north': case 'up': case 'n': newY -= step; break;
                case 'south': case 'down': case 's': newY += step; break;
                case 'east': case 'right': case 'e': newX += step; break;
                case 'west': case 'left': case 'w': newX -= step; break;
            }
        } else if (x !== undefined && y !== undefined) {
            // Direct position (for teleports, with validation)
            const maxMove = step * 2;  // Max 2 tiles per update
            if (Math.abs(x - newX) > maxMove || Math.abs(y - newY) > maxMove) {
                this.send(ws, { type: 'error', message: 'Movement too large' });
                return;
            }
            newX = x;
            newY = y;
        }

        // Update position
        clientData.player.x = newX;
        clientData.player.y = newY;

        if (this.supabase) {
            await this.supabase
                .from('player_presence')
                .update({ x: newX, y: newY, updated_at: new Date().toISOString() })
                .eq('id', clientData.player.id);
        }

        this.send(ws, {
            type: 'moved',
            x: newX,
            y: newY
        });
    }

    /**
     * Handle chat message
     */
    async handleChat(ws, clientData, data) {
        if (!clientData.player) {
            this.send(ws, { type: 'error', message: 'Not in game. Use "join" first.' });
            return;
        }

        const { message } = data || {};
        if (!message) return;

        const sanitized = message.trim().slice(0, 500);

        if (this.supabase) {
            await this.supabase.from('chat_messages').insert({
                player_id: clientData.player.id,
                player_name: clientData.player.name,
                message: sanitized,
                x: clientData.player.x,
                y: clientData.player.y,
                is_bot: true
            });
        }

        this.send(ws, {
            type: 'chat_sent',
            message: sanitized
        });
    }

    /**
     * Get current surroundings
     */
    async handleLook(ws, clientData) {
        if (!clientData.player) {
            this.send(ws, { type: 'error', message: 'Not in game.' });
            return;
        }

        let nearbyPlayers = [];
        
        if (this.supabase) {
            const { data } = await this.supabase
                .from('player_presence')
                .select('id, x, y, players(name, species)')
                .neq('id', clientData.player.id);

            nearbyPlayers = (data || [])
                .map(p => ({
                    name: p.players?.name,
                    species: p.players?.species,
                    x: p.x,
                    y: p.y,
                    distance: Math.sqrt(
                        Math.pow(p.x - clientData.player.x, 2) +
                        Math.pow(p.y - clientData.player.y, 2)
                    )
                }))
                .filter(p => p.distance < 200)  // Within ~12 tiles
                .sort((a, b) => a.distance - b.distance);
        }

        this.send(ws, {
            type: 'surroundings',
            position: { x: clientData.player.x, y: clientData.player.y },
            nearbyPlayers
        });
    }

    /**
     * Get all players
     */
    async handleGetPlayers(ws, clientData) {
        let players = [];
        
        if (this.supabase) {
            const { data } = await this.supabase
                .from('player_presence')
                .select('x, y, players(name, species, color)');

            players = (data || []).map(p => ({
                name: p.players?.name,
                species: p.players?.species,
                color: p.players?.color,
                x: p.x,
                y: p.y
            }));
        }

        this.send(ws, {
            type: 'players',
            count: players.length,
            players
        });
    }

    /**
     * Handle leaving the game
     */
    async handleLeave(ws, clientData) {
        if (clientData.player && this.supabase) {
            await this.supabase
                .from('player_presence')
                .delete()
                .eq('id', clientData.player.id);
        }
        
        clientData.player = null;
        this.send(ws, { type: 'left' });
    }

    /**
     * Send message to client
     */
    send(ws, msg) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }

    /**
     * Sanitize player name
     */
    sanitizeName(name) {
        return String(name)
            .replace(/<[^>]*>/g, '')
            .replace(/[^\w\s-]/g, '')
            .trim()
            .slice(0, 20) || 'Wanderer';
    }

    /**
     * API documentation HTML
     */
    getDocsHtml() {
        return `<!DOCTYPE html>
<html>
<head>
    <title>Claw World Bot API</title>
    <style>
        body { font-family: monospace; max-width: 800px; margin: 2rem auto; padding: 1rem; background: #0d0806; color: #e8d5cc; }
        h1 { color: #c43a24; }
        h2 { color: #8a7068; border-bottom: 1px solid #3a2a20; }
        code { background: #1a1210; padding: 2px 6px; border-radius: 3px; color: #c43a24; }
        pre { background: #1a1210; padding: 1rem; overflow-x: auto; border: 1px solid #3a2a20; }
        .endpoint { color: #6a9; }
    </style>
</head>
<body>
    <h1>🦀 Claw World Bot API</h1>
    <p>Connect via WebSocket with your API key.</p>
    
    <h2>Connection</h2>
    <pre>ws://localhost:${PORT}?key=YOUR_API_KEY</pre>
    
    <h2>Commands</h2>
    <pre>
// Join the game
{ "command": "join", "data": { "name": "MyBot", "species": "lobster", "color": "blue" } }

// Move (direction-based)
{ "command": "move", "data": { "direction": "north" } }

// Chat
{ "command": "chat", "data": { "message": "Hello world!" } }

// Look around
{ "command": "look" }

// Get all players
{ "command": "players" }

// Leave game
{ "command": "leave" }
    </pre>
    
    <h2>Responses</h2>
    <pre>
{ "type": "joined", "player": { "id": "...", "name": "...", "x": 744, "y": 680 } }
{ "type": "moved", "x": 744, "y": 664 }
{ "type": "surroundings", "position": { ... }, "nearbyPlayers": [ ... ] }
{ "type": "error", "message": "..." }
    </pre>
    
    <h2>Rate Limits</h2>
    <p>Max ${RATE_LIMIT.maxRequests} requests per minute, ${RATE_LIMIT.maxConnections} concurrent connections.</p>
</body>
</html>`;
    }
}

// Start server
const server = new SupabaseBotServer();
server.start();
