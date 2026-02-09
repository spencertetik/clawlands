/**
 * Railway Unified Server - Clawlands
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
    maxRequests: 1200,      // ~20/sec for smooth movement
    botMaxRequests: 600,    // ~10/sec for bots
    maxConnections: 200
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

        // Bot API keys table for self-service registration
        await db.query(`
        CREATE TABLE IF NOT EXISTS bot_api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            api_key_hash TEXT UNIQUE NOT NULL,
            bot_name TEXT NOT NULL,
            owner_name TEXT,
            owner_email TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_used TIMESTAMPTZ,
            is_active BOOLEAN DEFAULT true,
            uses INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS bot_keys_hash_idx ON bot_api_keys(api_key_hash);
        `);

        // Feedback table for beta testers
        await db.query(`
        CREATE TABLE IF NOT EXISTS feedback (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            player_name TEXT NOT NULL,
            message TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            game_state JSONB,
            resolved BOOLEAN DEFAULT false,
            response TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS feedback_time_idx ON feedback(created_at DESC);
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
const botRegRateLimits = new Map();  // ip -> { count, resetTime } for bot registration

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

function checkBotRegRateLimit(ip) {
    const now = Date.now();
    let entry = botRegRateLimits.get(ip);
    if (!entry || now > entry.resetTime) {
        entry = { count: 0, resetTime: now + 3600000 }; // 1 hour window
    }
    entry.count++;
    botRegRateLimits.set(ip, entry);
    return entry.count <= 3; // max 3 registrations per IP per hour
}

async function verifyDbApiKey(apiKey) {
    if (!db) return null;
    try {
        const keyHash = hashToken(apiKey);
        const result = await db.query(
            'SELECT bot_name, is_active FROM bot_api_keys WHERE api_key_hash = $1',
            [keyHash]
        );
        if (result.rows.length > 0 && result.rows[0].is_active) {
            // Update last_used and increment uses
            db.query(
                'UPDATE bot_api_keys SET last_used = NOW(), uses = uses + 1 WHERE api_key_hash = $1',
                [keyHash]
            ).catch(() => {});
            return result.rows[0];
        }
    } catch (err) {
        console.error('⚠️ Bot key DB check failed:', err.message);
    }
    return null;
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString()));
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

function broadcast(message, excludeId = null) {
    const data = JSON.stringify(message);
    players.forEach((player, id) => {
        if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(data);
        }
    });
}

// Spatial partitioning: only send to players within AOI_RANGE pixels
// World is 120 tiles × 16px = 1920px. Use full world for now (no culling)
// until player counts actually justify it — premature optimization was hiding players
const AOI_RANGE = 2000;

function broadcastNearby(message, sourceId, sourceX, sourceY) {
    const data = JSON.stringify(message);
    players.forEach((player, id) => {
        if (id !== sourceId && player.ws.readyState === WebSocket.OPEN) {
            const dx = player.x - sourceX;
            const dy = player.y - sourceY;
            // Use squared distance to avoid sqrt
            if (dx * dx + dy * dy <= AOI_RANGE * AOI_RANGE) {
                player.ws.send(data);
            }
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

const httpServer = http.createServer(async (req, res) => {
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
<head><title>Clawlands Server</title>
<style>body{font-family:monospace;background:#0d0806;color:#e8d5cc;padding:2rem;max-width:600px;margin:0 auto;}
h1{color:#c43a24;}code{background:#1a1210;padding:2px 6px;color:#c43a24;}</style>
</head>
<body>
<h1>🦀 Clawlands Server</h1>
<p>WebSocket endpoints:</p>
<ul>
<li><code>wss://YOUR_URL/game</code> — Human players</li>
<li><code>wss://YOUR_URL/bot?key=API_KEY</code> — AI agents</li>
</ul>
<p>Status: <a href="/health">/health</a> | Stats: <a href="/stats">/stats</a></p>
</body>
</html>
        `);
    } else if (url.pathname === '/api/bot/register' && req.method === 'POST') {
        // Self-service bot API key registration
        if (!db) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Registration unavailable - no database' }));
            return;
        }

        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
        if (!checkBotRegRateLimit(ip)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Rate limited - max 3 keys per hour' }));
            return;
        }

        try {
            const body = await parseBody(req);
            const botName = body.botName?.trim();

            if (!botName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'botName is required' }));
                return;
            }
            if (botName.length > 30 || !/^[a-zA-Z0-9 -]+$/.test(botName)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'botName must be 1-30 chars, alphanumeric + spaces + dashes only' }));
                return;
            }

            const apiKey = crypto.randomBytes(16).toString('hex');
            const keyHash = hashToken(apiKey);
            const ownerName = body.ownerName?.trim()?.slice(0, 100) || null;
            const email = body.email?.trim()?.slice(0, 200) || null;

            await db.query(
                'INSERT INTO bot_api_keys (api_key_hash, bot_name, owner_name, owner_email) VALUES ($1, $2, $3, $4)',
                [keyHash, botName, ownerName, email]
            );

            console.log(`🔑 New bot key registered: "${botName}" by ${ownerName || 'anonymous'}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                apiKey,
                botName,
                message: "Save this key! It won't be shown again."
            }));
        } catch (err) {
            console.error('❌ Bot registration error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Registration failed' }));
        }

    } else if (url.pathname === '/api/bot/verify' && req.method === 'GET') {
        const key = url.searchParams.get('key');
        if (!key || !db) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ valid: false }));
            return;
        }
        try {
            const keyHash = hashToken(key);
            const result = await db.query(
                'SELECT bot_name FROM bot_api_keys WHERE api_key_hash = $1 AND is_active = true',
                [keyHash]
            );
            if (result.rows.length > 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ valid: true, botName: result.rows[0].bot_name }));
            } else {
                // Also check admin keys
                const isAdmin = BOT_API_KEYS.includes(key);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ valid: isAdmin, ...(isAdmin ? { botName: 'Admin' } : {}) }));
            }
        } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ valid: false }));
        }

    } else if (url.pathname === '/api/bot/stats' && req.method === 'GET') {
        if (!db) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ totalBots: 0, activeBots: 0 }));
            return;
        }
        try {
            const total = await db.query('SELECT COUNT(*) FROM bot_api_keys WHERE is_active = true');
            const active = await db.query("SELECT COUNT(*) FROM bot_api_keys WHERE is_active = true AND last_used > NOW() - INTERVAL '24 hours'");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                totalBots: parseInt(total.rows[0].count),
                activeBots: parseInt(active.rows[0].count)
            }));
        } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ totalBots: 0, activeBots: 0 }));
        }

    } else {
    // ========== FEEDBACK API ==========

    } else if (url.pathname === '/api/feedback' && req.method === 'POST') {
        // Submit feedback from in-game
        const corsHeaders = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };

        if (!db) {
            res.writeHead(503, corsHeaders);
            res.end(JSON.stringify({ error: 'Feedback unavailable — no database' }));
            return;
        }

        try {
            const body = await parseBody(req);
            const playerName = body.playerName?.trim()?.slice(0, 50);
            const message = body.message?.trim()?.slice(0, 2000);
            const category = (body.category || 'general').slice(0, 30);
            const gameState = body.gameState || null;

            if (!message) {
                res.writeHead(400, corsHeaders);
                res.end(JSON.stringify({ error: 'Message is required' }));
                return;
            }

            await db.query(
                'INSERT INTO feedback (player_name, message, category, game_state) VALUES ($1, $2, $3, $4)',
                [playerName || 'Anonymous', message, category, gameState ? JSON.stringify(gameState) : null]
            );

            console.log(`📝 Feedback from ${playerName || 'Anonymous'}: ${message.slice(0, 80)}...`);

            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({ success: true, message: 'Feedback received! Thank you.' }));

        } catch (err) {
            console.error('❌ Feedback error:', err.message);
            res.writeHead(500, corsHeaders);
            res.end(JSON.stringify({ error: 'Failed to save feedback' }));
        }

    } else if (url.pathname === '/api/feedback' && req.method === 'GET') {
        // Read feedback (admin only — requires admin key)
        const corsHeaders = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        };

        const authKey = url.searchParams.get('key') || req.headers['authorization']?.replace('Bearer ', '');
        if (!authKey || !BOT_API_KEYS.includes(authKey)) {
            res.writeHead(401, corsHeaders);
            res.end(JSON.stringify({ error: 'Admin key required' }));
            return;
        }

        if (!db) {
            res.writeHead(503, corsHeaders);
            res.end(JSON.stringify({ error: 'No database' }));
            return;
        }

        try {
            const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
            const unresolvedOnly = url.searchParams.get('unresolved') === 'true';
            
            let query = 'SELECT * FROM feedback';
            if (unresolvedOnly) query += ' WHERE resolved = false';
            query += ' ORDER BY created_at DESC LIMIT $1';

            const result = await db.query(query, [limit]);
            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({ feedback: result.rows, count: result.rows.length }));
        } catch (err) {
            res.writeHead(500, corsHeaders);
            res.end(JSON.stringify({ error: 'Failed to fetch feedback' }));
        }

    } else if (url.pathname === '/api/feedback/resolve' && req.method === 'POST') {
        // Mark feedback as resolved (admin only)
        const corsHeaders = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        };

        const authKey = req.headers['authorization']?.replace('Bearer ', '');
        if (!authKey || !BOT_API_KEYS.includes(authKey)) {
            res.writeHead(401, corsHeaders);
            res.end(JSON.stringify({ error: 'Admin key required' }));
            return;
        }

        if (!db) {
            res.writeHead(503, corsHeaders);
            res.end(JSON.stringify({ error: 'No database' }));
            return;
        }

        try {
            const body = await parseBody(req);
            const feedbackId = body.id;
            const response = body.response?.trim()?.slice(0, 1000) || null;

            await db.query(
                'UPDATE feedback SET resolved = true, response = $1 WHERE id = $2',
                [response, feedbackId]
            );

            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({ success: true }));
        } catch (err) {
            res.writeHead(500, corsHeaders);
            res.end(JSON.stringify({ error: 'Failed to resolve feedback' }));
        }

    } else if (req.method === 'OPTIONS') {
        // CORS preflight
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();

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
        // First check admin keys from env var
        let botAuthed = BOT_API_KEYS.includes(apiKey);
        let botKeyInfo = null;

        // Then check self-service keys from database
        if (!botAuthed && apiKey) {
            botKeyInfo = await verifyDbApiKey(apiKey);
            botAuthed = !!botKeyInfo;
        }

        if (!botAuthed) {
            ws.close(4001, 'Invalid API key');
            console.log('❌ Bot rejected: invalid key');
            return;
        }
        console.log(`🤖 Bot connected${botKeyInfo ? ` (${botKeyInfo.bot_name})` : ' (admin key)'}`);
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
        isAlive: true,
        rateLimit: { count: 0, resetTime: Date.now() + RATE_LIMIT.windowMs }
    };

    // Track pong responses for keepalive
    ws.on('pong', () => { playerData.isAlive = true; });

    // Send welcome
    ws.send(JSON.stringify({
        type: 'welcome',
        playerId,
        message: isBot ? 'Send "join" command with name to enter.' : 'Welcome to Clawlands!'
    }));

    ws.on('message', async (data) => {
        try {
            // Per-connection rate limit
            const now = Date.now();
            if (now > playerData.rateLimit.resetTime) {
                playerData.rateLimit = { count: 0, resetTime: now + RATE_LIMIT.windowMs };
            }
            const maxReqs = playerData.isBot ? RATE_LIMIT.botMaxRequests : RATE_LIMIT.maxRequests;
            if (++playerData.rateLimit.count > maxReqs) {
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
// Server-side keepalive — detect dead connections
// ============================================
const KEEPALIVE_INTERVAL = 30000; // 30 seconds

setInterval(() => {
    for (const [playerId, playerData] of players) {
        if (!playerData.isAlive) {
            console.log(`💀 Dead connection detected: ${playerData.name || playerId}`);
            playerData.ws.terminate();
            // The 'close' handler will clean up the player entry
            continue;
        }
        playerData.isAlive = false;
        try {
            playerData.ws.ping();
        } catch (e) {
            // If ping fails, terminate
            playerData.ws.terminate();
        }
    }
}, KEEPALIVE_INTERVAL);

// ============================================
// Server Tick — Batched Position Broadcasting (20 Hz)
// ============================================

const TICK_RATE_MS = 50; // 20 Hz

setInterval(() => {
    // Collect all dirty (moved) players
    const movedPlayers = [];
    for (const [id, p] of players) {
        if (p._dirty && p.name) {
            movedPlayers.push({ id, x: p.x, y: p.y, direction: p.direction, isMoving: p.isMoving });
            p._dirty = false;
        }
    }

    if (movedPlayers.length === 0) return;

    // For each connected player, build a compressed payload of nearby movers
    for (const [recipientId, recipient] of players) {
        if (recipient.ws.readyState !== WebSocket.OPEN || !recipient.name) continue;

        // Filter to only nearby movers (spatial partitioning)
        const nearby = [];
        for (const mp of movedPlayers) {
            if (mp.id === recipientId) continue;
            const dx = (players.get(mp.id)?.x || mp.x) - recipient.x;
            const dy = (players.get(mp.id)?.y || mp.y) - recipient.y;
            if (dx * dx + dy * dy <= AOI_RANGE * AOI_RANGE) {
                // Compressed format: short keys
                nearby.push({
                    i: mp.id,
                    x: mp.x,
                    y: mp.y,
                    d: mp.direction,
                    m: mp.isMoving ? 1 : 0
                });
            }
        }

        if (nearby.length === 0) continue;

        // Send compressed batched positions: { t: 'p', p: [...] }
        recipient.ws.send(JSON.stringify({ t: 'p', p: nearby }));
    }
}, TICK_RATE_MS);

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

            // Mark player as dirty for the batched tick system
            playerData._dirty = true;
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

        case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
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

            // Set starting position from bot data
            if (data?.x != null) playerData.x = data.x;
            if (data?.y != null) playerData.y = data.y;

            ws.send(JSON.stringify({
                type: 'joined',
                player: {
                    id: playerId,
                    name,
                    x: playerData.x,
                    y: playerData.y,
                    isBot: true
                },
                players: getPlayerList()
            }));

            broadcast({
                type: 'player_joined',
                player: { id: playerId, name, species: playerData.species, color: playerData.color, x: playerData.x, y: playerData.y, isBot: true }
            }, playerId);
            break;
        }

        case 'move': {
            if (!playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Join first' }));
                return;
            }

            // Accept direct x/y from smart bots (preferred) or direction-based step
            if (data?.x != null && data?.y != null) {
                playerData.x = data.x;
                playerData.y = data.y;
                if (data.direction) playerData.direction = data.direction;
                playerData.isMoving = !!data.isMoving;
            } else {
                const step = 16;
                const dir = data?.direction?.toLowerCase();
                
                if (dir) {
                    if (dir === 'north' || dir === 'up' || dir === 'n') { playerData.y -= step; playerData.direction = 'north'; }
                    else if (dir === 'south' || dir === 'down' || dir === 's') { playerData.y += step; playerData.direction = 'south'; }
                    else if (dir === 'east' || dir === 'right' || dir === 'e') { playerData.x += step; playerData.direction = 'east'; }
                    else if (dir === 'west' || dir === 'left' || dir === 'w') { playerData.x -= step; playerData.direction = 'west'; }
                    playerData.isMoving = true;
                }
            }

            // Mark dirty for batched tick; don't broadcast immediately
            playerData._dirty = true;

            ws.send(JSON.stringify({
                type: 'moved',
                x: playerData.x,
                y: playerData.y
            }));
            break;
        }

        case 'talk_response': {
            // Bot sending a talk response to a player
            if (!playerData.name) return;
            const target = players.get(data?.targetId);
            if (target?.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({
                    type: 'talk_response',
                    fromId: playerId,
                    fromName: playerData.name,
                    text: data?.text?.slice(0, 500)
                }));
            }
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
🦀 Clawlands Server running on port ${PORT}
   
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
