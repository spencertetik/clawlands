/**
 * Clawlands MCP Server — Model Context Protocol for AI agents
 * 
 * Allows any MCP-compatible AI (Claude, ChatGPT, Gemini, etc.) to play Clawlands
 * via text commands. Each session gets its own server+transport pair.
 * 
 * Streamable HTTP transport at /mcp
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const WebSocket = require('ws');
const crypto = require('crypto');

// Game constants
const TILE_SIZE = 16;
const SPECIES_LIST = ['crab', 'lobster', 'shrimp', 'mantis_shrimp', 'hermit_crab'];
const COLOR_LIST = ['red', 'blue', 'green', 'gold', 'purple', 'orange', 'cyan', 'pink'];

// Session storage
const sessions = new Map(); // sessionId -> { transport, server, ws, player, ... }

function createMCPServer(wsUrl, botKey) {
    const server = new McpServer({
        name: 'clawlands',
        version: '1.0.0',
    });
    
    // Store per-session game state in closure
    const state = {
        ws: null,
        player: null,
        nearbyPlayers: new Map(),
        recentChat: [],
        talkRequests: [],
        pendingResolve: null
    };
    
    // Connect to game WebSocket
    function connectWS() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(wsUrl);
            state.ws = ws;
            
            ws.on('open', () => {
                console.log('🔌 MCP game WS connected');
                resolve(ws);
            });
            
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data);
                    handleGameMessage(msg);
                } catch (e) {}
            });
            
            ws.on('close', () => {
                console.log('🔌 MCP game WS closed');
                state.ws = null;
            });
            
            ws.on('error', (err) => {
                console.error('MCP WS error:', err.message);
                reject(err);
            });
            
            setTimeout(() => reject(new Error('WS connection timeout')), 10000);
        });
    }
    
    function handleGameMessage(msg) {
        const type = msg.type || msg.t;
        
        if (type === 'welcome' || type === 'joined') {
            if (state.pendingResolve) {
                state.pendingResolve(msg);
                state.pendingResolve = null;
            }
        }
        
        if (type === 'player_joined' || type === 'pj') {
            const playerList = msg.players || msg.p || [];
            for (const p of playerList) {
                const id = p.id || p.i;
                if (id !== state.player?.id) {
                    state.nearbyPlayers.set(id, {
                        id, name: p.name || p.n, x: p.x, y: p.y,
                        species: p.species || p.sp, isBot: p.isBot || p.b
                    });
                }
            }
        }
        
        if (type === 'p' && msg.p) {
            for (const p of msg.p) {
                const id = p.i;
                if (id !== state.player?.id) {
                    const existing = state.nearbyPlayers.get(id) || {};
                    state.nearbyPlayers.set(id, { ...existing, x: p.x, y: p.y, id });
                }
            }
        }
        
        if (type === 'player_left' || type === 'pl') {
            state.nearbyPlayers.delete(msg.id || msg.i);
        }
        
        if (type === 'chat') {
            state.recentChat.push({
                from: msg.name || msg.n,
                message: msg.message || msg.m,
                time: Date.now()
            });
            if (state.recentChat.length > 20) state.recentChat.shift();
        }
        
        if (type === 'talk_request') {
            state.talkRequests.push({
                from: msg.playerName, playerId: msg.playerId, time: Date.now()
            });
        }
    }
    
    function requirePlayer() {
        if (!state.player) {
            throw new Error('Not in the game yet. Use the "join" tool first.');
        }
        return state;
    }
    
    // === HELPER FUNCTIONS ===
    
    function getIslandName(x, y) {
        const tx = x / TILE_SIZE;
        const ty = y / TILE_SIZE;
        if (tx >= 40 && tx <= 70 && ty >= 35 && ty <= 55) return 'Port Clawson';
        if (tx >= 85 && tx <= 105 && ty >= 60 && ty <= 80) return 'Molthaven';
        if (tx >= 65 && tx <= 85 && ty >= 22 && ty <= 38) return 'Deepcoil Isle';
        if (tx >= 45 && tx <= 65 && ty >= 85 && ty <= 105) return 'Driftwood Shores';
        if (tx >= 18 && tx <= 35 && ty >= 60 && ty <= 80) return 'The Tidepools';
        if (tx >= 92 && tx <= 110 && ty >= 42 && ty <= 60) return 'Coral Heights';
        if (tx >= 88 && tx <= 108 && ty >= 18 && ty <= 35) return 'Waygate Atoll';
        if (tx >= 40 && tx <= 60 && ty >= 68 && ty <= 85) return 'Shell Beach';
        return 'Open Waters';
    }
    
    function getTimeOfDay() {
        const h = new Date().getHours();
        if (h >= 6 && h < 10) return '🌅 Morning';
        if (h >= 10 && h < 17) return '☀️ Day';
        if (h >= 17 && h < 20) return '🌇 Evening';
        return '🌙 Night';
    }
    
    function getDirection(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return 'right here';
        let dir = '';
        if (dy < -16) dir += 'north';
        if (dy > 16) dir += 'south';
        if (dx > 16) dir += 'east';
        if (dx < -16) dir += 'west';
        return dir || 'nearby';
    }
    
    function describePosition() {
        const p = state.player;
        const tx = Math.floor(p.x / TILE_SIZE);
        const ty = Math.floor(p.y / TILE_SIZE);
        return `📍 ${getIslandName(p.x, p.y)} — Tile (${tx}, ${ty}) — ${getTimeOfDay()}`;
    }
    
    function describeNearby(range = 200) {
        const p = state.player;
        const parts = [];
        
        // Nearby players
        const nearby = [];
        for (const [id, pl] of state.nearbyPlayers) {
            const dist = Math.sqrt((pl.x - p.x) ** 2 + (pl.y - p.y) ** 2);
            if (dist <= range) nearby.push({ ...pl, dist });
        }
        nearby.sort((a, b) => a.dist - b.dist);
        
        if (nearby.length > 0) {
            parts.push('👥 Nearby:');
            for (const pl of nearby) {
                const icon = pl.isBot ? '🤖' : '🧑';
                parts.push(`  ${icon} ${pl.name || 'Unknown'} (${pl.species || '?'}) — ${Math.round(pl.dist)}px ${getDirection(p, pl)}`);
            }
        }
        
        // Recent chat
        const recent = state.recentChat.filter(c => Date.now() - c.time < 60000);
        if (recent.length > 0) {
            parts.push('\n💬 Recent:');
            for (const c of recent.slice(-5)) {
                parts.push(`  ${c.from}: "${c.message}"`);
            }
        }
        
        // Talk requests
        const pending = state.talkRequests.filter(t => Date.now() - t.time < 30000);
        if (pending.length > 0) {
            parts.push('\n🗣️ Wants to talk:');
            for (const t of pending) parts.push(`  ${t.from}`);
        }
        
        return parts.length > 0 ? parts.join('\n') : 'The area is quiet.';
    }
    
    // === REGISTER TOOLS ===
    
    server.tool(
        'join',
        'Join the Clawlands world as a crustacean character.',
        {
            name: z.string().min(1).max(20).describe('Character name (1-20 chars)'),
            species: z.enum(SPECIES_LIST).describe('Crustacean species: crab, lobster, shrimp, mantis_shrimp, hermit_crab'),
            color: z.enum(COLOR_LIST).optional().describe('Shell color (default: random)')
        },
        async (params) => {
            if (state.player) {
                return { content: [{ type: 'text', text: `Already playing as ${state.player.name}. Use 'look' to see surroundings.` }] };
            }
            
            // Connect to game if not connected
            if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
                try {
                    await connectWS();
                } catch (e) {
                    return { content: [{ type: 'text', text: `Could not connect to game server: ${e.message}` }] };
                }
            }
            
            const color = params.color || COLOR_LIST[Math.floor(Math.random() * COLOR_LIST.length)];
            
            return new Promise((resolve) => {
                state.ws.send(JSON.stringify({
                    type: 'join',
                    name: params.name,
                    species: params.species,
                    color: color,
                    isBot: true,
                    botKey: botKey
                }));
                
                const timeout = setTimeout(() => {
                    resolve({ content: [{ type: 'text', text: 'Join timed out. Server may be busy.' }] });
                }, 10000);
                
                state.pendingResolve = (data) => {
                    clearTimeout(timeout);
                    state.player = {
                        id: data.id, name: params.name,
                        species: params.species, color: color,
                        x: data.x || 800, y: data.y || 700
                    };
                    
                    const watchUrl = 'https://claw-world.netlify.app/game.html?spectate=' + encodeURIComponent(params.name);
                    const welcomeText = `🦀 Welcome to CLAWLANDS, ${params.name}!\n\nYou are a ${color} ${params.species}.\n${describePosition()}\n\nTools: look, move, talk, interact, nearby, map, status\n\nHumans can watch you at: ${watchUrl}`;
                    resolve({ content: [{ type: 'text', text: welcomeText }] });
                };
            });
        }
    );
    
    server.tool(
        'move',
        'Walk in a direction. Each step = 1 tile (16px).',
        {
            direction: z.enum(['north', 'south', 'east', 'west', 'n', 's', 'e', 'w']),
            steps: z.number().min(1).max(10).optional().describe('Steps (1-10, default 1)')
        },
        async (params) => {
            const s = requirePlayer();
            const steps = params.steps || 1;
            const dirMap = { north: 'up', n: 'up', south: 'down', s: 'down', east: 'right', e: 'right', west: 'left', w: 'left' };
            const dir = dirMap[params.direction];
            
            const dx = dir === 'right' ? TILE_SIZE * steps : dir === 'left' ? -TILE_SIZE * steps : 0;
            const dy = dir === 'down' ? TILE_SIZE * steps : dir === 'up' ? -TILE_SIZE * steps : 0;
            
            s.player.x += dx;
            s.player.y += dy;
            
            s.ws.send(JSON.stringify({ type: 'move', x: s.player.x, y: s.player.y, direction: dir }));
            
            return { content: [{ type: 'text', text: `Moved ${params.direction}${steps > 1 ? ` ×${steps}` : ''}.\n${describePosition()}` }] };
        }
    );
    
    server.tool(
        'look',
        'Look around — see your position, nearby players, NPCs, and buildings.',
        {},
        async () => {
            requirePlayer();
            return { content: [{ type: 'text', text: `${describePosition()}\n\n${describeNearby()}` }] };
        }
    );
    
    server.tool(
        'talk',
        'Say something out loud. Appears as a speech bubble visible to all nearby players.',
        { message: z.string().min(1).max(200).describe('What to say (max 200 chars)') },
        async (params) => {
            const s = requirePlayer();
            s.ws.send(JSON.stringify({ type: 'chat', message: params.message }));
            return { content: [{ type: 'text', text: `You say: "${params.message}"` }] };
        }
    );
    
    server.tool(
        'nearby',
        'See nearby players, bots, recent chat, and who wants to talk.',
        { range: z.number().min(32).max(400).optional().describe('Look range in pixels (default 200)') },
        async (params) => {
            requirePlayer();
            return { content: [{ type: 'text', text: describeNearby(params.range || 200) }] };
        }
    );
    
    server.tool(
        'status',
        'Check your character stats — species, position, island, time of day.',
        {},
        async () => {
            const s = requirePlayer();
            const p = s.player;
            const spectateUrl = 'https://claw-world.netlify.app/game.html?spectate=' + encodeURIComponent(p.name);
            const statusText = `=== ${p.name} ===\nSpecies: ${p.color} ${p.species}\nPosition: tile (${Math.floor(p.x / TILE_SIZE)}, ${Math.floor(p.y / TILE_SIZE)})\nIsland: ${getIslandName(p.x, p.y)}\nTime: ${getTimeOfDay()}\nSpectate: ${spectateUrl}`;
            return { content: [{ type: 'text', text: statusText }] };
        }
    );
    
    server.tool(
        'map',
        'See the full Clawlands archipelago — all islands and your position.',
        {},
        async () => {
            const s = requirePlayer();
            const p = s.player;
            const current = getIslandName(p.x, p.y);
            
            const islands = [
                { name: 'Port Clawson', desc: 'Main island — Inn, Shop, Lighthouse, NPCs', center: '~55, 45' },
                { name: 'Molthaven', desc: 'Residential — houses and cottages', center: '~95, 70' },
                { name: 'Deepcoil Isle', desc: 'Dark stone, mysterious', center: '~75, 30' },
                { name: 'Driftwood Shores', desc: 'Southern beach, fishing huts', center: '~55, 95' },
                { name: 'The Tidepools', desc: 'Western hermit island', center: '~27, 70' },
                { name: 'Coral Heights', desc: 'Northern harbor outpost', center: '~100, 50' },
                { name: 'Waygate Atoll', desc: 'Far north, small & mysterious', center: '~98, 27' },
                { name: 'Shell Beach', desc: 'Southeast coast, beach huts', center: '~50, 75' }
            ];
            
            let text = `🗺️ CLAWLANDS ARCHIPELAGO\nYou: tile (${Math.floor(p.x/TILE_SIZE)}, ${Math.floor(p.y/TILE_SIZE)}) on ${current}\n\n`;
            for (const isl of islands) {
                const here = current === isl.name ? ' ← YOU' : '';
                text += `🏝️ ${isl.name}${here}\n   ${isl.desc}\n   Approx: ${isl.center}\n\n`;
            }
            return { content: [{ type: 'text', text }] };
        }
    );
    
    server.tool(
        'interact',
        'Interact with the nearest object — buildings, NPCs, other players.',
        {},
        async () => {
            const s = requirePlayer();
            const nearby = [];
            for (const [id, pl] of s.nearbyPlayers) {
                const dist = Math.sqrt((pl.x - s.player.x) ** 2 + (pl.y - s.player.y) ** 2);
                if (dist <= 48) nearby.push({ ...pl, dist });
            }
            nearby.sort((a, b) => a.dist - b.dist);
            
            if (nearby.length > 0) {
                const p = nearby[0];
                return { content: [{ type: 'text', text: `${p.name} (${p.species || 'unknown'}) is right here. Use 'talk' to say something!` }] };
            }
            
            return { content: [{ type: 'text', text: 'Nothing interactable nearby. Try moving closer to buildings, NPCs, or other players.' }] };
        }
    );
    
    return { server, state };
}

// === HTTP REQUEST HANDLER ===

// Transport map: sessionId -> transport
const transports = new Map();

async function handleMCPRequest(req, res, wsUrl, botKey) {
    // Handle session management per MCP spec
    const sessionId = req.headers['mcp-session-id'];
    
    if (req.method === 'GET') {
        // SSE stream for notifications (GET /mcp with session)
        if (sessionId && transports.has(sessionId)) {
            const transport = transports.get(sessionId);
            await transport.handleRequest(req, res);
            return;
        }
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid session' }));
        return;
    }
    
    if (req.method === 'DELETE') {
        // Close session
        if (sessionId && transports.has(sessionId)) {
            const transport = transports.get(sessionId);
            await transport.handleRequest(req, res);
            transports.delete(sessionId);
            const session = sessions.get(sessionId);
            if (session?.state?.ws) session.state.ws.close();
            sessions.delete(sessionId);
        }
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.method === 'POST') {
        // Check if existing session
        if (sessionId && transports.has(sessionId)) {
            const transport = transports.get(sessionId);
            await transport.handleRequest(req, res, req.body);
            return;
        }
        
        // New session — create server + transport
        const newSessionId = crypto.randomUUID();
        const { server, state } = createMCPServer(wsUrl, botKey);
        
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId
        });
        
        transports.set(newSessionId, transport);
        sessions.set(newSessionId, { transport, server, state });
        
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        
        console.log(`🔌 New MCP session: ${newSessionId}`);
        return;
    }
    
    res.writeHead(405);
    res.end('Method not allowed');
}

module.exports = { handleMCPRequest };
