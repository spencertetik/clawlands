/**
 * Railway Unified Server - Claw World
 * 
 * Single server that handles:
 * - Bot API (WebSocket)
 * - Multiplayer sync (WebSocket)
 * - Health checks (HTTP)
 * 
 * Environment variables:
 *   PORT - HTTP port (Railway sets this automatically)
 *   DATABASE_URL - PostgreSQL connection string (Railway provides this)
 *   BOT_API_KEYS - Comma-separated valid API keys
 *   JWT_SECRET - Secret for signing auth tokens
 */

const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const { Pool } = require('pg');

// ============================================
// Configuration
// ============================================

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const BOT_API_KEYS = (process.env.BOT_API_KEYS || 'dev-key').split(',').filter(k => k);

// Rate limiting config
const RATE_LIMIT = {
    windowMs: 60000,
    maxRequests: 120,
    maxConnections: 50
};

// ============================================
// Database Setup
// ============================================

let db = null;

async function initDatabase() {
    const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
        console.log('⚠️ No DATABASE_URL - running without persistence');
        return;
    }

    let pool = null;
    try {
        pool = new Pool({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
            max: 10
        });

        // Catch pool-level errors so they don't crash the process
        pool.on('error', (err) => {
            console.error('⚠️ Database pool error:', err.message);
        });

        // Test connection first
        const client = await pool.connect();
        console.log('✅ Database connected');
        client.release();
        db = pool;
    } catch (err) {
        console.error('⚠️ Database connection failed:', err.message);
        console.log('⚠️ Running without persistence');
        // Destroy the pool so it doesn't emit unhandled errors
        if (pool) {
            pool.end().catch(() => {});
        }
        db = null;
        return;
    }

    // Create tables if they don't exist
    try {
        await db.query(`
        CREATE TABLE IF NOT EXISTS players (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT UNIQUE NOT NULL,
            species TEXT DEFAULT 'lobster',
            color TEXT DEFAULT 'red',
            last_x INTEGER DEFAULT 744,
            last_y INTEGER DEFAULT 680,
            continuity REAL DEFAULT 50.0,
            auth_token TEXT,
            is_bot BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_seen TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            player_name TEXT NOT NULL,
            message TEXT NOT NULL,
            x INTEGER,
            y INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS chat_time_idx ON chat_messages(created_at DESC);
    `);

        console.log('✅ Database tables ready');
    } catch (err) {
        console.error('⚠️ Table creation failed:', err.message);
        console.log('⚠️ Running without persistence');
        db = null;
    }
}

// ============================================
// Authentication
// ============================================

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================
// Multiplayer State
// ============================================

const players = new Map();  // id -> { ws, name, x, y, species, color, facing, isBot }
const rateLimits = new Map();  // ip -> { count, resetTime }

function checkRateLimit(ip) {
    const now = Date.now();
    let entry = rateLimits.get(ip);
    
    if (!entry || now > entry.resetTime) {
        entry = { count: 0, resetTime: now + RATE_LIMIT.windowMs };
    }
    
    entry.count++;
    rateLimits.set(ip, entry);
    
    return entry.count <= RATE_LIMIT.maxRequests;
}

function broadcast(message, excludeId = null) {
    const data = JSON.stringify(message);
    players.forEach((player, id) => {
        if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(data);
        }
    });
}

function getPlayerList() {
    return Array.from(players.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        species: p.species,
        color: p.color,
        x: p.x,
        y: p.y,
        facing: p.facing || 'down',
        isBot: p.isBot
    }));
}

// ============================================
// HTTP Server
// ============================================

const httpServer = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            players: players.size,
            database: !!db
        }));
    } else if (url.pathname === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            players: players.size,
            playerList: getPlayerList().map(p => ({ name: p.name, species: p.species, isBot: p.isBot }))
        }));
    } else if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head><title>Claw World Server</title>
<style>body{font-family:monospace;background:#0d0806;color:#e8d5cc;padding:2rem;max-width:600px;margin:0 auto;}
h1{color:#c43a24;}code{background:#1a1210;padding:2px 6px;color:#c43a24;}</style>
</head>
<body>
<h1>🦀 Claw World Server</h1>
<p>WebSocket endpoints:</p>
<ul>
<li><code>wss://YOUR_URL/game</code> — Human players</li>
<li><code>wss://YOUR_URL/bot?key=API_KEY</code> — AI agents</li>
</ul>
<p>Status: <a href="/health">/health</a> | Stats: <a href="/stats">/stats</a></p>
</body>
</html>
        `);
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// ============================================
// WebSocket Server
// ============================================

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', async (ws, req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    
    // Rate limit check
    if (!checkRateLimit(ip)) {
        ws.close(4029, 'Rate limited');
        return;
    }

    // Connection limit
    if (players.size >= RATE_LIMIT.maxConnections) {
        ws.close(4003, 'Server full');
        return;
    }

    // Determine connection type
    const isBot = path === '/bot';
    const apiKey = url.searchParams.get('key');

    // Bot authentication
    if (isBot) {
        if (!BOT_API_KEYS.includes(apiKey)) {
            ws.close(4001, 'Invalid API key');
            console.log('❌ Bot rejected: invalid key');
            return;
        }
        console.log('🤖 Bot connected');
    } else {
        console.log('👤 Player connected');
    }

    // Generate player ID
    const playerId = crypto.randomUUID();
    let playerData = {
        ws,
        name: null,
        species: 'lobster',
        color: 'red',
        x: 744,
        y: 680,
        facing: 'down',
        isBot,
        rateLimit: { count: 0, resetTime: Date.now() + RATE_LIMIT.windowMs }
    };

    // Send welcome
    ws.send(JSON.stringify({
        type: 'welcome',
        playerId,
        message: isBot ? 'Send "join" command with name to enter.' : 'Welcome to Claw World!'
    }));

    ws.on('message', async (data) => {
        try {
            // Per-connection rate limit
            const now = Date.now();
            if (now > playerData.rateLimit.resetTime) {
                playerData.rateLimit = { count: 0, resetTime: now + RATE_LIMIT.windowMs };
            }
            if (++playerData.rateLimit.count > RATE_LIMIT.maxRequests) {
                ws.send(JSON.stringify({ type: 'error', message: 'Rate limited' }));
                return;
            }

            const msg = JSON.parse(data.toString());
            await handleMessage(playerId, playerData, msg, ws);
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
        }
    });

    ws.on('close', async () => {
        if (playerData.name) {
            console.log(`${playerData.isBot ? '🤖' : '👤'} ${playerData.name} left`);
            
            // Save position to database
            if (db && !playerData.isBot) {
                await db.query(
                    'UPDATE players SET last_x = $1, last_y = $2, last_seen = NOW() WHERE name = $3',
                    [playerData.x, playerData.y, playerData.name]
                );
            }

            // Notify others
            broadcast({ type: 'player_left', playerId: playerId, name: playerData.name });
        }
        players.delete(playerId);
    });
});

// ============================================
// Message Handler
// ============================================

async function handleMessage(playerId, playerData, msg, ws) {
    const { type, command } = msg;

    // Handle bot commands
    if (playerData.isBot && command) {
        return handleBotCommand(playerId, playerData, msg, ws);
    }

    switch (type) {
        case 'join': {
            const name = sanitizeName(msg.name);
            if (!name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid name' }));
                return;
            }

            // Check if name is taken
            for (const [id, p] of players) {
                if (p.name?.toLowerCase() === name.toLowerCase() && id !== playerId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Name taken' }));
                    return;
                }
            }

            playerData.name = name;
            playerData.species = msg.species || 'lobster';
            playerData.color = msg.color || 'red';
            playerData.x = msg.x || 744;
            playerData.y = msg.y || 680;

            players.set(playerId, playerData);

            // Load from database if exists
            if (db) {
                const result = await db.query('SELECT * FROM players WHERE name = $1', [name]);
                if (result.rows[0]) {
                    playerData.x = result.rows[0].last_x;
                    playerData.y = result.rows[0].last_y;
                } else {
                    await db.query(
                        'INSERT INTO players (name, species, color) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
                        [name, playerData.species, playerData.color]
                    );
                }
            }

            console.log(`${playerData.isBot ? '🤖' : '👤'} ${name} joined`);

            // Send joined confirmation with all players
            ws.send(JSON.stringify({
                type: 'joined',
                player: {
                    id: playerId,
                    name: playerData.name,
                    species: playerData.species,
                    color: playerData.color,
                    x: playerData.x,
                    y: playerData.y
                },
                players: getPlayerList()
            }));

            // Notify others
            broadcast({
                type: 'player_joined',
                player: {
                    id: playerId,
                    name: playerData.name,
                    species: playerData.species,
                    color: playerData.color,
                    x: playerData.x,
                    y: playerData.y
                }
            }, playerId);
            break;
        }

        case 'move': {
            if (!playerData.name) return;
            
            playerData.x = msg.x;
            playerData.y = msg.y;
            playerData.direction = msg.direction || playerData.direction;
            playerData.isMoving = msg.isMoving || false;

            broadcast({
                type: 'player_moved',
                playerId: playerId,
                x: msg.x,
                y: msg.y,
                direction: msg.direction,
                isMoving: msg.isMoving
            }, playerId);
            break;
        }

        case 'chat': {
            if (!playerData.name) return;
            
            const message = msg.text?.slice(0, 500);
            if (!message) return;

            // Save to database
            if (db) {
                await db.query(
                    'INSERT INTO chat_messages (player_name, message, x, y) VALUES ($1, $2, $3, $4)',
                    [playerData.name, message, playerData.x, playerData.y]
                );
            }

            broadcast({
                type: 'chat',
                playerId: playerId,
                name: playerData.name,
                text: message,
                x: playerData.x,
                y: playerData.y
            });
            break;
        }

        case 'talk_request': {
            // Player wants to talk to another player/bot
            const target = players.get(msg.targetId);
            if (target?.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({
                    type: 'talk_request',
                    fromId: playerId,
                    fromName: playerData.name
                }));
            }
            break;
        }

        case 'talk_response': {
            // Response to a talk request
            const target = players.get(msg.targetId);
            if (target?.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({
                    type: 'talk_response',
                    fromId: playerId,
                    fromName: playerData.name,
                    text: msg.text?.slice(0, 500)
                }));
            }
            break;
        }
    }
}

// ============================================
// Bot Command Handler
// ============================================

async function handleBotCommand(playerId, playerData, msg, ws) {
    const { command, data } = msg;

    switch (command) {
        case 'join': {
            const name = sanitizeName(data?.name);
            if (!name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Name required' }));
                return;
            }

            playerData.name = name;
            playerData.species = data?.species || 'lobster';
            playerData.color = data?.color || 'red';
            players.set(playerId, playerData);

            console.log(`🤖 ${name} joined`);

            ws.send(JSON.stringify({
                type: 'joined',
                player: {
                    id: playerId,
                    name,
                    x: playerData.x,
                    y: playerData.y
                },
                players: getPlayerList()
            }));

            broadcast({
                type: 'player_joined',
                player: { id: playerId, name, species: playerData.species, color: playerData.color, x: playerData.x, y: playerData.y }
            }, playerId);
            break;
        }

        case 'move': {
            if (!playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Join first' }));
                return;
            }

            const step = 16;
            const dir = data?.direction?.toLowerCase();
            
            if (dir) {
                if (dir === 'north' || dir === 'up' || dir === 'n') playerData.y -= step;
                else if (dir === 'south' || dir === 'down' || dir === 's') playerData.y += step;
                else if (dir === 'east' || dir === 'right' || dir === 'e') playerData.x += step;
                else if (dir === 'west' || dir === 'left' || dir === 'w') playerData.x -= step;
            }

            broadcast({
                type: 'player_moved',
                id: playerId,
                x: playerData.x,
                y: playerData.y,
                facing: playerData.facing
            }, playerId);

            ws.send(JSON.stringify({
                type: 'moved',
                x: playerData.x,
                y: playerData.y
            }));
            break;
        }

        case 'chat': {
            if (!playerData.name) return;
            
            const message = data?.message?.slice(0, 500);
            if (!message) return;

            broadcast({
                type: 'chat',
                playerId: playerId,
                name: playerData.name,
                text: message
            });

            ws.send(JSON.stringify({ type: 'chat_sent' }));
            break;
        }

        case 'look': {
            const nearby = getPlayerList()
                .filter(p => p.id !== playerId)
                .map(p => ({
                    ...p,
                    distance: Math.sqrt(Math.pow(p.x - playerData.x, 2) + Math.pow(p.y - playerData.y, 2))
                }))
                .filter(p => p.distance < 200)
                .sort((a, b) => a.distance - b.distance);

            ws.send(JSON.stringify({
                type: 'surroundings',
                position: { x: playerData.x, y: playerData.y },
                nearbyPlayers: nearby
            }));
            break;
        }

        case 'players': {
            ws.send(JSON.stringify({
                type: 'players',
                players: getPlayerList()
            }));
            break;
        }
    }
}

// ============================================
// Utilities
// ============================================

function sanitizeName(name) {
    if (!name) return null;
    return String(name)
        .replace(/<[^>]*>/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .slice(0, 20) || null;
}

// ============================================
// Start Server
// ============================================

async function start() {
    // Start listening FIRST so Railway's health check passes immediately
    httpServer.listen(PORT, () => {
        console.log(`
🦀 Claw World Server running on port ${PORT}
   
   Endpoints:
   ├─ HTTP:  http://localhost:${PORT}
   ├─ WS:    ws://localhost:${PORT}/game (players)
   └─ WS:    ws://localhost:${PORT}/bot?key=KEY (bots)
   
   Bot keys: ${BOT_API_KEYS.length} configured
        `);
    });

    // Connect to database in the background (don't block startup)
    await initDatabase();
    console.log(`   Database: ${db ? '✅ Connected' : '⚠️ None (in-memory only)'}`);
}

start().catch(console.error);
