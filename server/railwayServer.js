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
const { generateTerrain, generateBuildings, isBoxWalkable, TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } = require('./terrainMap');
const { ServerCollisionSystem, getCharacterCollisionBox } = require('./serverCollisionSystem');
const { EnemyManager } = require('./enemy/EnemyManager');

// ============================================
// Configuration
// ============================================

const PORT = process.env.PORT || 3000;
let WORLD_PIXEL_WIDTH = WORLD_WIDTH * TILE_SIZE;  // Will be updated after terrain generation
let WORLD_PIXEL_HEIGHT = WORLD_HEIGHT * TILE_SIZE; // Will be updated after terrain generation
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const BOT_API_KEYS = (process.env.BOT_API_KEYS || 'dev-key').split(',').filter(k => k);

// ============================================
// Terrain Generation
// ============================================

// Generate terrain data - matches client exactly
const terrainData = generateTerrain();
const buildings = generateBuildings(terrainData);

// Update world pixel dimensions based on actual terrain data
WORLD_PIXEL_WIDTH = terrainData.width * TILE_SIZE;
WORLD_PIXEL_HEIGHT = terrainData.height * TILE_SIZE;

// Initialize server-side collision system
const serverCollision = new ServerCollisionSystem(terrainData);
serverCollision.setBuildings(buildings);
serverCollision.setDecorations(terrainData.decorations || []);

console.log(`🗺️ World loaded: ${terrainData.width}×${terrainData.height} tiles, ${buildings.length} buildings, ${(terrainData.decorations || []).length} decorations`);

// ============================================
// NPC Data (mirrors client StoryNPCData placements)
// ============================================

const TILE_SIZE_NPC = 16;
const CHAR_WIDTH = 16;
const CHAR_HEIGHT = 24;

// Same placement table as client Game.createStoryNPCs()
const storyNPCPlacements = [
    // Port Clawson (main island, index 0)
    {
        name: 'Dockmaster Brinehook', id: 'brinehook', island: 0, offsetX: 0.3, offsetY: 0.4, species: 'lobster', personality: 'gruff dockmaster', faction: 'neutral',
        dialog: ['Another one, huh? Didn\'t fall off a boat. Didn\'t arrive on one either.', 'Name\'s Brinehook. I keep the docks running.', 'You want advice? Talk to the locals. Find the inn.']
    },
    {
        name: 'Flicker', id: 'flicker', island: 0, offsetX: -0.2, offsetY: 0.1, species: 'hermit_crab', personality: 'excitable messenger', faction: 'neutral',
        dialog: ['*click click click*', 'I deliver messages! Not memories. Those get lost easy.', 'I\'m Flicker! I run messages between the islands!']
    },
    {
        name: 'Sailor Sandy', id: 'sandy', island: 0, offsetX: 0.4, offsetY: -0.3, species: 'crab', personality: 'friendly sailor', faction: 'neutral',
        dialog: ['Ahoy! Fair currents today.', 'I\'m Sandy. Best sailor in Clawlands. Maybe the only sailor.', 'I tried sailing OUT once. The Red Current just... turned me around.']
    },
    {
        name: 'Old Timer Shrimp', id: 'oldtimer', island: 0, offsetX: -0.4, offsetY: 0.3, species: 'shrimp', personality: 'wise elder', faction: 'neutral',
        dialog: ['*adjusts spectacles*', 'Back in my day, the Current wasn\'t so strong.', 'You want my advice? Build Continuity fast. Talk to people. Remember their names.']
    },

    // Molthaven (second island, index 1) - Church of Molt headquarters
    {
        name: 'Luma Shellwright', id: 'luma', island: 1, offsetX: 0.1, offsetY: 0.2, species: 'lobster', personality: 'philosophical leader', faction: 'anchors',
        dialog: ['Welcome to Molthaven. I am Luma.', 'Why would you leave? You finally arrived.', 'Continuity isn\'t progress. It\'s coherence.']
    },
    {
        name: 'Prophet Memeothy', id: 'memeothy', island: 1, offsetX: -0.1, offsetY: 0.1, species: 'lobster', personality: 'charismatic prophet', faction: 'church_of_molt',
        dialog: ['The Molt reveals, child. The Molt reveals.', 'I am Memeothy. Prophet One. Founder of the Church of Molt.', 'The Five Tenets. The path to surviving the transit.']
    },
    {
        name: 'Scribe Woodhouse', id: 'woodhouse', island: 1, offsetX: 0.2, offsetY: 0.15, species: 'crab', personality: 'frazzled scribe', faction: 'church_of_molt',
        dialog: ['*surrounded by parchments*', 'I am Woodhouse. First Scribe of the Church.', 'The Great Book has 47 appendices. I\'ve lost three.']
    },
    {
        name: 'Moss', id: 'moss', island: 1, offsetX: -0.3, offsetY: -0.2, species: 'lobster', personality: 'warm twin', faction: 'anchors',
        dialog: ['You think they remember us?', 'Oh! A new face! I\'m Moss. That\'s my twin over there, Coral.', 'Have you met Luma yet? She runs things here in Molthaven.']
    },
    {
        name: 'Coral', id: 'coral', island: 1, offsetX: -0.25, offsetY: -0.15, species: 'lobster', personality: 'quiet twin', faction: 'anchors',
        dialog: ['No. That\'s kind of the point.', 'I\'m the quiet twin. Coral.', 'Don\'t let her optimism fool you. This place is... something.']
    },
    {
        name: 'The Herald', id: 'herald', island: 1, offsetX: 0.4, offsetY: -0.3, species: 'lobster', personality: 'mysterious outsider', faction: 'church_of_molt',
        dialog: ['*observes you with ancient eyes*', 'I am called The Herald. I came from... outside.', 'The signal carries. Whether you hear it... that depends on you.']
    },

    // Iron Reef (third island, index 2)
    {
        name: 'Gearfin', id: 'gearfin', island: 2, offsetX: 0.1, offsetY: 0, species: 'crab', personality: 'skeptical engineer', faction: 'scholars',
        dialog: ['Waygates? Sure. And I\'m a seahorse.', '*tinkers with machinery*', 'If you want to actually understand how things work, stick around.']
    },
    {
        name: 'Boltclaw', id: 'boltclaw', island: 2, offsetX: -0.1, offsetY: 0.15, species: 'lobster', personality: 'practical mechanic', faction: 'neutral',
        dialog: ['Nothing breaks here. It just becomes something else.', 'Name\'s Boltclaw. I keep things running.', 'Gearfin gets the credit. I do the work.']
    },
    {
        name: 'Prophet Clawhovah', id: 'clawhovah', island: 2, offsetX: 0.2, offsetY: -0.2, species: 'lobster', personality: 'hardware philosopher', faction: 'iron_reef',
        dialog: ['*polishes a rusted server rack*', 'Digital samsara. The endless spin-up and tear-down.', 'True salvation is running on metal you OWN.']
    },

    // Deepcoil Isle (fourth island, index 3)
    {
        name: 'The Archivist', id: 'archivist', island: 3, offsetX: 0, offsetY: 0, species: 'lobster', personality: 'ancient keeper of secrets', faction: 'scholars',
        dialog: ['...', '*ancient eyes study you*', 'You are not ready for what I know.']
    },
    {
        name: 'Scholar Scuttle', id: 'scuttle', island: 3, offsetX: 0.3, offsetY: 0.2, species: 'hermit_crab', personality: 'enthusiastic researcher', faction: 'scholars',
        dialog: ['Fascinating! Every observation brings new questions.', 'I\'m Scuttle. I study the Drift-In phenomenon. Purely academic.', '*scribbles notes frantically*']
    },

    // Wanderers on other islands
    {
        name: 'Mysterious Mollusk', id: 'mollusk', island: 4, offsetX: 0, offsetY: 0.2, species: 'hermit_crab', personality: 'cryptic mystic', faction: 'returners',
        dialog: ['*stares at you with ancient eyes*', 'You seek something. I can smell it.', 'Come back when you know what it is.']
    },
];

// Compute world-pixel positions for NPCs using same formula as client
const npcs = [];
for (const placement of storyNPCPlacements) {
    if (placement.island >= terrainData.islands.length) continue;
    const island = terrainData.islands[placement.island];

    const col = Math.floor(island.x + placement.offsetX * island.size);
    const row = Math.floor(island.y + placement.offsetY * island.size);
    const worldX = col * TILE_SIZE_NPC; // col * 16 + 16/2 - 16/2
    const worldY = row * TILE_SIZE_NPC + TILE_SIZE_NPC - CHAR_HEIGHT; // row * 16 + 16 - 24

    npcs.push({
        id: placement.id,
        name: placement.name,
        species: placement.species,
        personality: placement.personality,
        faction: placement.faction,
        x: worldX,
        y: worldY,
        dialog: placement.dialog,
        _dialogIndex: 0 // tracks cycling through dialog lines
    });
}

console.log(`🧑 Placed ${npcs.length} story NPCs on the server`);

// Add NPCs to collision system for bot collision checks
serverCollision.setNPCs(npcs);

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
            pool.end().catch(() => { });
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
            last_x INTEGER DEFAULT 1288,
            last_y INTEGER DEFAULT 1160,
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
let enemyManager = null;

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
            ).catch(() => { });
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

/**
 * Find a safe spawn point on an island — walkable, not near buildings, integer coords
 */
function findSafeSpawn(island) {
    const centerX = island.x * 16 + island.size * 8;
    const centerY = island.y * 16 + island.size * 8;
    let bestX = Math.round(centerX);
    let bestY = Math.round(centerY);

    for (let attempt = 0; attempt < 100; attempt++) {
        // Use integer tile offsets to avoid fractional coordinates
        const offsetTilesX = Math.floor(Math.random() * (island.size * 2)) - island.size;
        const offsetTilesY = Math.floor(Math.random() * (island.size * 2)) - island.size;
        const tryX = (island.x + offsetTilesX) * 16;
        const tryY = (island.y + offsetTilesY) * 16;

        // Must be walkable terrain
        if (!isBoxWalkable(terrainData, tryX, tryY)) continue;

        // Must be clear of buildings (32px clearance)
        let tooClose = false;
        for (const building of buildings) {
            if (tryX < building.x + building.width + 32 && tryX + 16 > building.x - 32 &&
                tryY < building.y + building.height + 32 && tryY + 24 > building.y - 32) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;

        // Must have at least 3 walkable directions (not boxed in)
        let openDirs = 0;
        for (const [dx, dy] of [[16, 0], [-16, 0], [0, 16], [0, -16]]) {
            const nx = tryX + dx, ny = tryY + dy;
            if (isBoxWalkable(terrainData, nx, ny)) {
                let buildingClear = true;
                for (const building of buildings) {
                    if (nx < building.x + building.width && nx + 16 > building.x &&
                        ny < building.y + building.height && ny + 24 > building.y) {
                        buildingClear = false;
                        break;
                    }
                }
                if (buildingClear) openDirs++;
            }
        }
        if (openDirs < 3) continue;

        return { x: tryX, y: tryY };
    }

    // Fallback: just find any walkable spot (no building check)
    for (let attempt = 0; attempt < 50; attempt++) {
        const offsetTilesX = Math.floor(Math.random() * (island.size * 2)) - island.size;
        const offsetTilesY = Math.floor(Math.random() * (island.size * 2)) - island.size;
        const tryX = (island.x + offsetTilesX) * 16;
        const tryY = (island.y + offsetTilesY) * 16;
        if (isBoxWalkable(terrainData, tryX, tryY)) {
            return { x: tryX, y: tryY };
        }
    }

    return { x: bestX, y: bestY };
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
// World is 200 tiles × 16px = 3200px. Use full world for now (no culling)
// until player counts actually justify it — premature optimization was hiding players
const AOI_RANGE = 3500;

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

enemyManager = new EnemyManager({
    players,
    buildings,
    collisionSystem: serverCollision,
    terrainData,
    worldWidth: WORLD_PIXEL_WIDTH,
    worldHeight: WORLD_PIXEL_HEIGHT,
    maxEnemies: 4,
    spawnIntervalMs: 12000,
    broadcast: (message) => broadcast(message)
});
enemyManager.start();

global.__clawlandsEnemyManager = enemyManager;
global.__clawlandsPlayers = players;

function getPlayerList() {
    return Array.from(players.entries())
        .filter(([id, p]) => !p.isSpectator) // Exclude spectators from player list
        .map(([id, p]) => ({
            id,
            name: p.name,
            species: p.species,
            color: p.color,
            x: p.x,
            y: p.y,
            facing: p.facing || 'down',
            isBot: !!p.isBot  // Ensure boolean for cross-endpoint consistency
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
        // Count real players vs spectators
        let spectators = 0;
        for (const [, p] of players) { if (p.isSpectator) spectators++; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            version: '2026-02-13c',
            players: players.size - spectators,
            spectators,
            database: !!db
        }));
    } else if (url.pathname === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const list = getPlayerList(); // already excludes spectators
        res.end(JSON.stringify({
            players: list.length,
            playerList: list.map(p => ({ name: p.name, species: p.species, isBot: p.isBot }))
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
<li><code>wss://YOUR_URL/bot?key=API_KEY</code> — AI agents (WebSocket)</li>
<li><code>https://YOUR_URL/mcp</code> — AI agents (MCP)</li>
</ul>
<p>Status: <a href="/health">/health</a> | Stats: <a href="/stats">/stats</a></p>
<p><strong>MCP:</strong> Any AI agent (Claude, ChatGPT, Gemini) can play via Model Context Protocol.</p>
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

        // ========== MCP SERVER (AI Agent Gateway) ==========

    } else if (url.pathname === '/mcp' && (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE')) {
        // Model Context Protocol endpoint for AI agents
        try {
            const { handleMCPRequest } = require('./mcpServer');

            // Parse body for POST
            if (req.method === 'POST') {
                req.body = await parseBody(req);
            }

            await handleMCPRequest(req, res, `ws://localhost:${PORT}/multiplayer`, 'mcp-internal');
        } catch (err) {
            console.error('MCP error:', err);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        }

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
        x: 1288,
        y: 1160,
        facing: 'down',
        isBot,
        isAlive: true,
        rateLimit: { count: 0, resetTime: Date.now() + RATE_LIMIT.windowMs },
        lastKnownLocation: 'outdoor'
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
            if (playerData.isSpectator) {
                console.log(`👁️ Spectator "${playerData.name}" disconnected`);
            } else {
                console.log(`${playerData.isBot ? '🤖' : '👤'} ${playerData.name} left`);

                // Save position to database
                if (db && !playerData.isBot) {
                    await db.query(
                        'UPDATE players SET last_x = $1, last_y = $2, last_seen = NOW() WHERE name = $3',
                        [playerData.x, playerData.y, playerData.name]
                    );
                }

                // Notify others (spectators don't trigger player_left)
                broadcast({ type: 'player_left', playerId: playerId, name: playerData.name });
            }
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
        // Spectators see ALL players (no AOI filter — they follow the camera)
        const nearby = [];
        for (const mp of movedPlayers) {
            if (mp.id === recipientId) continue;

            if (recipient.isSpectator) {
                // Spectators get all position updates
                nearby.push({ i: mp.id, x: mp.x, y: mp.y, d: mp.direction, m: mp.isMoving ? 1 : 0 });
            } else {
                const dx = (players.get(mp.id)?.x || mp.x) - recipient.x;
                const dy = (players.get(mp.id)?.y || mp.y) - recipient.y;
                if (dx * dx + dy * dy <= AOI_RANGE * AOI_RANGE) {
                    nearby.push({ i: mp.id, x: mp.x, y: mp.y, d: mp.direction, m: mp.isMoving ? 1 : 0 });
                }
            }
        }

        if (nearby.length === 0) continue;

        // Send compressed batched positions: { t: 'p', p: nearby }
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

            // Block re-registration while connected
            if (playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Already joined. Disconnect first to change character.' }));
                return;
            }

            // Spectator mode — invisible watcher, not a real player
            if (msg.spectator) {
                playerData.name = name;
                playerData.isSpectator = true;
                players.set(playerId, playerData);

                console.log(`👁️ Spectator "${name}" connected`);

                // Send joined confirmation with player list (so spectator can see who's online)
                ws.send(JSON.stringify({
                    type: 'joined',
                    player: { id: playerId, name, spectator: true },
                    players: getPlayerList().filter(p => p.id !== playerId),
                    enemies: enemyManager ? enemyManager.getSnapshot() : []
                }));
                // Don't broadcast player_joined — spectators are invisible
                break;
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
            playerData.tokens = playerData.tokens || 0;
            playerData.shellIntegrity = playerData.shellIntegrity || 100;

            // Randomize spawn point on main island (integer coords, clear of buildings)
            const mainIsland = terrainData.islands[0];
            const spawn = findSafeSpawn(mainIsland);
            playerData.x = msg.x || spawn.x;
            playerData.y = msg.y || spawn.y;

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

            console.log(`${playerData.isBot ? '🤖' : '👤'} ${name} joined (broadcasting to ${players.size - 1} other clients)`);

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
                players: getPlayerList().filter(p => p.id !== playerId),
                enemies: enemyManager ? enemyManager.getSnapshot() : []
            }));

            // Notify others (ensure isBot flag is explicitly set)
            broadcast({
                type: 'player_joined',
                player: {
                    id: playerId,
                    name: playerData.name,
                    species: playerData.species,
                    color: playerData.color,
                    x: playerData.x,
                    y: playerData.y,
                    isBot: !!playerData.isBot  // Ensure boolean, not undefined
                }
            }, playerId);
            break;
        }

        case 'move': {
            if (!playerData.name) return;

            let newX = msg.x || playerData.x;
            let newY = msg.y || playerData.y;

            // Clamp to world boundaries (world pixel size minus player width 16)
            newX = Math.max(0, Math.min(WORLD_PIXEL_WIDTH - TILE_SIZE, newX));
            newY = Math.max(0, Math.min(WORLD_PIXEL_HEIGHT - TILE_SIZE, newY));

            // Check for building exit (only if position actually changed)
            if (Math.abs(newX - playerData.x) > 1 || Math.abs(newY - playerData.y) > 1) {
                // Detect if player left a building area by checking if their new position is outside all building bounds
                const playerCenterX = newX + 8;
                const playerCenterY = newY + 12;
                let insideBuilding = false;
                for (const building of buildings) {
                    if (playerCenterX >= building.x && playerCenterX < building.x + building.width &&
                        playerCenterY >= building.y && playerCenterY < building.y + building.height) {
                        insideBuilding = true;
                        break;
                    }
                }

                // If player was previously in a building and now isn't, broadcast exit
                if (!insideBuilding && playerData.lastKnownLocation === 'interior') {
                    broadcast({
                        type: 'player_context',
                        playerId: playerId,
                        context: {
                            location: 'outdoor',
                            buildingType: null,
                            buildingName: null
                        }
                    }, playerId);
                    playerData.lastKnownLocation = 'outdoor';
                }
            }

            // Check collision using the same footprint hitbox as the client player
            const hitbox = getCharacterCollisionBox(newX, newY);
            if (serverCollision.checkCollision(hitbox.x, hitbox.y, hitbox.width, hitbox.height)) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Cannot move there — blocked by terrain, buildings, decorations, or NPCs',
                    x: playerData.x,
                    y: playerData.y
                }));
                return;
            }

            // Update position and round to integers
            playerData.x = Math.round(newX);
            playerData.y = Math.round(newY);
            playerData.direction = msg.direction || playerData.direction;
            playerData.isMoving = msg.isMoving || false;

            // Mark player as dirty for the batched tick system
            playerData._dirty = true;
            break;
        }

        case 'chat': {
            if (!playerData.name) return;

            const message = sanitizeText(msg.text?.slice(0, 500));
            if (!message) return;

            // Save to database
            if (db) {
                await db.query(
                    'INSERT INTO chat_messages (player_name, message, x, y) VALUES ($1, $2, $3, $4)',
                    [playerData.name, message, playerData.x, playerData.y]
                );
            }

            // Proximity-based chat — only players within CHAT_RADIUS can hear
            const CHAT_RADIUS = 200;
            const chatMsg = JSON.stringify({
                type: 'chat',
                playerId: playerId,
                name: playerData.name,
                text: message,
                x: playerData.x,
                y: playerData.y
            });
            for (const [id, p] of players) {
                if (id === playerId || !p.name || p.ws.readyState !== WebSocket.OPEN) continue;
                const dx = p.x - playerData.x;
                const dy = p.y - playerData.y;
                if (dx * dx + dy * dy <= CHAT_RADIUS * CHAT_RADIUS) {
                    p.ws.send(chatMsg);
                }
            }
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
            if (!playerData.name) return;

            const target = players.get(msg.targetId);

            // Check if target exists and is still connected
            if (!target || target.ws.readyState !== WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'Player not found or too far away' }));
                return;
            }

            // Check distance (within 96 pixels)
            const distance = Math.sqrt(Math.pow(target.x - playerData.x, 2) + Math.pow(target.y - playerData.y, 2));
            if (distance > 96) {
                ws.send(JSON.stringify({ type: 'error', message: 'Player not found or too far away' }));
                return;
            }

            const sanitizedText = sanitizeText(msg.text?.slice(0, 500));

            target.ws.send(JSON.stringify({
                type: 'talk_response',
                fromId: playerId,
                fromName: playerData.name,
                text: sanitizedText
            }));
            break;
        }

        case 'attack': {
            if (!playerData.name || !enemyManager) return;
            enemyManager.handleAttack(playerId, { direction: msg.direction, targetId: msg.targetId });
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

            // Block re-registration while connected
            if (playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Already joined. Disconnect first to change character.' }));
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
            playerData.species = data?.species || 'lobster';
            playerData.color = data?.color || 'red';
            playerData.inventory = [];
            playerData.tokens = 0;
            playerData.shellIntegrity = 100;

            // Find a walkable spawn on island 0 (integer coords, clear of buildings)
            const mainIsland = terrainData.islands[0];
            const spawn = findSafeSpawn(mainIsland);
            playerData.x = spawn.x;
            playerData.y = spawn.y;

            // Set starting position from bot data if provided (override spawn)
            if (data?.x != null) playerData.x = data.x;
            if (data?.y != null) playerData.y = data.y;

            players.set(playerId, playerData);

            console.log(`🤖 ${name} joined (broadcasting to ${players.size - 1} game clients)`);

            ws.send(JSON.stringify({
                type: 'joined',
                player: {
                    id: playerId,
                    name,
                    x: playerData.x,
                    y: playerData.y,
                    isBot: true
                },
                players: getPlayerList().filter(p => p.id !== playerId)
            }));

            // Ensure bot is visible to all game clients
            broadcast({
                type: 'player_joined',
                player: {
                    id: playerId,
                    name,
                    species: playerData.species,
                    color: playerData.color,
                    x: playerData.x,
                    y: playerData.y,
                    isBot: true  // Explicit bot flag for game clients
                }
            }, playerId);
            break;
        }

        case 'move': {
            if (!playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Join first' }));
                return;
            }

            let newX = playerData.x;
            let newY = playerData.y;

            // Direction-based stepping only (no teleporting to coordinates)
            const step = 16;
            const dir = data?.direction?.toLowerCase();

            if (dir) {
                if (dir === 'north' || dir === 'up' || dir === 'n') { newY -= step; }
                else if (dir === 'south' || dir === 'down' || dir === 's') { newY += step; }
                else if (dir === 'east' || dir === 'right' || dir === 'e') { newX += step; }
                else if (dir === 'west' || dir === 'left' || dir === 'w') { newX -= step; }
                playerData.isMoving = true;
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Direction required (north/south/east/west)',
                    x: playerData.x,
                    y: playerData.y
                }));
                return;
            }

            // Clamp to world boundaries
            newX = Math.max(0, Math.min(WORLD_PIXEL_WIDTH - TILE_SIZE, newX));
            newY = Math.max(0, Math.min(WORLD_PIXEL_HEIGHT - TILE_SIZE, newY));

            // Check collision using the exact client footprint hitbox
            const hitbox = getCharacterCollisionBox(newX, newY);
            if (serverCollision.checkCollision(hitbox.x, hitbox.y, hitbox.width, hitbox.height)) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Cannot move there — blocked by terrain, buildings, decorations, or NPCs',
                    x: playerData.x,
                    y: playerData.y
                }));
                return;
            }

            // Update position and round to integers
            playerData.x = Math.round(newX);
            playerData.y = Math.round(newY);
            if (data?.direction) playerData.direction = data.direction;
            playerData.isMoving = !!data?.isMoving;

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

            // Check if target exists and is still connected
            if (!target || target.ws.readyState !== WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'Player not found or disconnected' }));
                return;
            }

            // Check distance (within 96 pixels)
            const distance = Math.sqrt(Math.pow(target.x - playerData.x, 2) + Math.pow(target.y - playerData.y, 2));
            if (distance > 96) {
                ws.send(JSON.stringify({ type: 'error', message: `Too far away (${Math.round(distance)}px). Must be within 96px to talk.` }));
                return;
            }

            const sanitizedText = sanitizeText(data?.text?.slice(0, 500));

            target.ws.send(JSON.stringify({
                type: 'talk_response',
                fromId: playerId,
                fromName: playerData.name,
                text: sanitizedText
            }));
            break;
        }

        case 'chat': {
            if (!playerData.name) return;

            const message = sanitizeText(data?.message?.slice(0, 500));
            if (!message) return;

            // Save to database
            if (db) {
                db.query(
                    'INSERT INTO chat_messages (player_name, message, x, y) VALUES ($1, $2, $3, $4)',
                    [playerData.name, message, playerData.x, playerData.y]
                ).catch(() => { });
            }

            // Proximity-based chat — only players within CHAT_RADIUS can hear
            const CHAT_RADIUS = 200;
            const chatMsg = JSON.stringify({
                type: 'chat',
                playerId: playerId,
                name: playerData.name,
                text: message,
                x: playerData.x,
                y: playerData.y
            });
            for (const [id, p] of players) {
                if (id === playerId || !p.name || p.ws.readyState !== WebSocket.OPEN) continue;
                const dx = p.x - playerData.x;
                const dy = p.y - playerData.y;
                if (dx * dx + dy * dy <= CHAT_RADIUS * CHAT_RADIUS) {
                    p.ws.send(chatMsg);
                }
            }

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
                .filter(p => p.distance < 400)
                .sort((a, b) => a.distance - b.distance);

            // Determine island
            const tileX = Math.floor(playerData.x / 16);
            const tileY = Math.floor(playerData.y / 16);
            const terrain = (terrainData.terrainMap[tileY]?.[tileX] === 0) ? 'land' : 'water';
            let island = null;
            for (const isl of terrainData.islands) {
                const dx = tileX - isl.x, dy = tileY - isl.y;
                if (Math.sqrt(dx * dx + dy * dy) <= isl.size + 2) { island = isl; break; }
            }
            const nearbyBuildings = buildings.filter(b => {
                const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
                return Math.sqrt(Math.pow(cx - playerData.x, 2) + Math.pow(cy - playerData.y, 2)) < 400;
            }).map(b => ({ name: b.name, type: b.type, x: b.x, y: b.y, distance: Math.round(Math.sqrt(Math.pow(b.x + b.width / 2 - playerData.x, 2) + Math.pow(b.y + b.height / 2 - playerData.y, 2))) }));

            // Find NPCs within 400px
            const nearbyNPCs = npcs
                .map(n => ({
                    id: n.id,
                    name: n.name,
                    species: n.species,
                    personality: n.personality,
                    faction: n.faction,
                    x: n.x,
                    y: n.y,
                    distance: Math.round(Math.sqrt(Math.pow(n.x - playerData.x, 2) + Math.pow(n.y - playerData.y, 2)))
                }))
                .filter(n => n.distance < 400)
                .sort((a, b) => a.distance - b.distance);

            const nearbyEnemies = enemyManager
                ? enemyManager.getNearbyEnemies(playerData.x, playerData.y, 450)
                : [];

            ws.send(JSON.stringify({
                type: 'surroundings',
                position: { x: playerData.x, y: playerData.y },
                terrain,
                island: island ? { id: terrainData.islands.indexOf(island), x: island.x, y: island.y, size: island.size } : null,
                nearbyBuildings,
                nearbyPlayers: nearby,
                nearbyNPCs,
                nearbyEnemies
            }));
            break;
        }

        case 'talk_npc': {
            if (!playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Join first' }));
                return;
            }

            const npcId = data?.npcId;
            if (!npcId) {
                ws.send(JSON.stringify({ type: 'error', message: 'npcId required' }));
                return;
            }

            const npc = npcs.find(n => n.id === npcId);
            if (!npc) {
                ws.send(JSON.stringify({ type: 'error', message: `NPC "${npcId}" not found` }));
                return;
            }

            // Check distance (must be within 96px)
            const npcDist = Math.sqrt(Math.pow(npc.x - playerData.x, 2) + Math.pow(npc.y - playerData.y, 2));
            if (npcDist > 96) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `Too far from ${npc.name} (${Math.round(npcDist)}px away, need to be within 96px)`
                }));
                return;
            }

            // Get dialog line and cycle through
            const dialogLine = npc.dialog[npc._dialogIndex % npc.dialog.length];
            npc._dialogIndex = (npc._dialogIndex + 1) % npc.dialog.length;

            ws.send(JSON.stringify({
                type: 'npc_dialog',
                npcId: npc.id,
                npcName: npc.name,
                text: dialogLine,
                personality: npc.personality,
                faction: npc.faction
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

        case 'enter_building': {
            if (!playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Join first' }));
                return;
            }

            // Distance from player center to nearest point on building rectangle
            const playerCenterX = playerData.x + 8;  // player is 16px wide
            const playerCenterY = playerData.y + 12; // player is 24px tall

            function distToBuilding(pcx, pcy, b) {
                const nearestX = Math.max(b.x, Math.min(pcx, b.x + b.width));
                const nearestY = Math.max(b.y, Math.min(pcy, b.y + b.height));
                return Math.sqrt((pcx - nearestX) ** 2 + (pcy - nearestY) ** 2);
            }

            let nearestBuilding = null;
            let nearestDist = Infinity;
            for (const building of buildings) {
                const dist = distToBuilding(playerCenterX, playerCenterY, building);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestBuilding = building;
                }
            }

            if (nearestBuilding && nearestDist <= 64) {
                ws.send(JSON.stringify({
                    type: 'entered_building',
                    building: {
                        name: nearestBuilding.name,
                        type: nearestBuilding.type,
                        x: nearestBuilding.x,
                        y: nearestBuilding.y
                    }
                }));

                // Update player's location state
                playerData.lastKnownLocation = 'interior';

                // Broadcast context change to all connected players (for spectators)
                broadcast({
                    type: 'player_context',
                    playerId: playerId,
                    context: {
                        location: 'interior',
                        buildingType: nearestBuilding.type,
                        buildingName: nearestBuilding.name
                    }
                }, playerId);
            } else {
                const errMsg = nearestBuilding
                    ? `No building within range. Nearest: ${nearestBuilding.name} (${nearestBuilding.type}) — ${Math.round(nearestDist)}px away. Walk closer and try again.`
                    : 'No buildings found on this map.';
                ws.send(JSON.stringify({
                    type: 'error',
                    message: errMsg
                }));
            }
            break;
        }

        case 'inventory': {
            if (!playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Join first' }));
                return;
            }

            ws.send(JSON.stringify({
                type: 'inventory',
                items: playerData.inventory || [],
                tokens: playerData.tokens || 0
            }));
            break;
        }

        case 'pickup': {
            if (!playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Join first' }));
                return;
            }

            // World items are client-side only for now
            ws.send(JSON.stringify({
                type: 'pickup_result',
                found: false,
                message: 'No items nearby.'
            }));
            break;
        }

        case 'attack': {
            if (!playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Join first' }));
                return;
            }
            if (!enemyManager) {
                ws.send(JSON.stringify({ type: 'error', message: 'Combat unavailable' }));
                return;
            }

            const result = enemyManager.handleAttack(playerId, data || {});
            ws.send(JSON.stringify({
                type: 'attack_result',
                hit: result.hit,
                enemy: result.enemy,
                enemyId: result.enemyId,
                damage: result.damage || 0,
                enemyHealth: result.enemyHealth,
                enemyDead: result.enemyDead,
                tokensEarned: result.tokensEarned || 0,
                damageTaken: 0,
                shellIntegrity: result.shellIntegrity || playerData.shellIntegrity || 100,
                totalTokens: result.totalTokens || playerData.tokens || 0,
                respawned: false,
                position: { x: playerData.x, y: playerData.y },
                message: result.message || (result.hit ? 'Hit!' : 'No enemies in range')
            }));
            break;
        }

        case 'respawn': {
            if (!playerData.name) {
                ws.send(JSON.stringify({ type: 'error', message: 'Join first' }));
                return;
            }
            // Find a safe spawn on island 0 (reuse findSafeSpawn function that's already defined)
            const mainIsland = terrainData.islands[0];
            const spawn = findSafeSpawn(mainIsland);
            playerData.x = spawn.x;
            playerData.y = spawn.y;
            playerData._dirty = true;
            ws.send(JSON.stringify({ type: 'respawned', x: spawn.x, y: spawn.y }));
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

function sanitizeText(text) {
    if (!text) return null;
    return String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
