#!/usr/bin/env node
/**
 * Clawlands MCP Server
 * 
 * Model Context Protocol server that lets any AI agent play Clawlands
 * by bridging MCP tool calls to the existing WebSocket bot protocol.
 * 
 * Transport: stdio (standard for MCP — AI agents spawn this process)
 * Connection: WebSocket to Railway server (or local botServer)
 * 
 * Usage:
 *   CLAWLANDS_SERVER=wss://claw-world-production.up.railway.app \
 *   CLAWLANDS_BOT_KEY=your-key-here \
 *   node server/mcpServer.js
 * 
 * Or configure in your MCP client (Claude Desktop, OpenClaw, etc.):
 *   {
 *     "mcpServers": {
 *       "clawlands": {
 *         "command": "node",
 *         "args": ["server/mcpServer.js"],
 *         "env": {
 *           "CLAWLANDS_SERVER": "wss://claw-world-production.up.railway.app",
 *           "CLAWLANDS_BOT_KEY": "your-key-here"
 *         }
 *       }
 *     }
 *   }
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const WebSocket = require('ws');
const z = require('zod');

// ============================================
// Configuration
// ============================================

const SERVER_URL = process.env.CLAWLANDS_SERVER || 'wss://claw-world-production.up.railway.app';
const BOT_KEY = process.env.CLAWLANDS_BOT_KEY || '';
const CONNECT_TIMEOUT = 10000;
const COMMAND_TIMEOUT = 5000;

// ============================================
// WebSocket Bot Bridge
// ============================================

class BotBridge {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = null;
        this.position = { x: 744, y: 680 };
        this.species = null;
        this.color = null;
        this.connected = false;
        this.joined = false;
        this.pendingResolvers = [];
        this.lastState = null;
        this.nearbyPlayers = [];
        this.lastTalkResponse = null;
        this._talkResolvers = [];
    }

    /**
     * Connect to the Clawlands WebSocket server
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                resolve({ already: true });
                return;
            }

            const url = `${SERVER_URL}/bot?key=${encodeURIComponent(BOT_KEY)}`;
            const timeout = setTimeout(() => {
                reject(new Error(`Connection timeout after ${CONNECT_TIMEOUT}ms`));
            }, CONNECT_TIMEOUT);

            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                this.connected = true;
                // Start keepalive ping every 25s (server timeout is 30s)
                this._pingInterval = setInterval(() => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.ping();
                    }
                }, 25000);
            });

            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this._handleMessage(msg, resolve, timeout);
                } catch (e) {
                    // ignore parse errors
                }
            });

            this.ws.on('close', (code, reason) => {
                this.connected = false;
                this.joined = false;
                clearTimeout(timeout);
                // Reject any pending command resolvers
                for (const r of this.pendingResolvers) {
                    r.reject(new Error(`Connection closed (code ${code}). Use "register" to reconnect.`));
                }
                this.pendingResolvers = [];
                process.stderr.write(`⚠️ Connection closed: ${code} ${reason}\n`);
            });

            this.ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket error: ${err.message}`));
            });
        });
    }

    _handleMessage(msg, connectResolve, connectTimeout) {
        switch (msg.type) {
            case 'welcome':
                this.playerId = msg.playerId;
                clearTimeout(connectTimeout);
                if (connectResolve) connectResolve({ playerId: msg.playerId, message: msg.message });
                break;

            case 'joined':
                this.joined = true;
                this.playerName = msg.player?.name;
                this.position = { x: msg.player?.x || 0, y: msg.player?.y || 0 };
                this._resolvePending({ type: 'joined', player: msg.player, players: msg.players });
                break;

            case 'moved':
                this.position = { x: msg.x, y: msg.y };
                this._resolvePending({ type: 'moved', x: msg.x, y: msg.y });
                break;

            case 'surroundings':
                this.nearbyPlayers = msg.nearbyPlayers || [];
                this._resolvePending({
                    type: 'surroundings',
                    position: msg.position,
                    nearbyPlayers: msg.nearbyPlayers,
                    terrain: msg.terrain,
                    island: msg.island,
                    nearbyBuildings: msg.nearbyBuildings
                });
                break;

            case 'players':
                this._resolvePending({ type: 'players', players: msg.players });
                break;

            case 'chat_sent':
                this._resolvePending({ type: 'chat_sent' });
                break;

            case 'entered_building':
                this._resolvePending({
                    type: 'entered_building',
                    building: msg.building
                });
                break;

            case 'inventory':
                this._resolvePending({
                    type: 'inventory',
                    items: msg.items,
                    tokens: msg.tokens
                });
                break;

            case 'pickup_result':
                this._resolvePending({
                    type: 'pickup_result',
                    found: msg.found,
                    message: msg.message
                });
                break;

            case 'attack_result':
                this._resolvePending({
                    type: 'attack_result',
                    hit: msg.hit,
                    enemy: msg.enemy,
                    damage: msg.damage,
                    tokensEarned: msg.tokensEarned,
                    damageTaken: msg.damageTaken,
                    shellIntegrity: msg.shellIntegrity,
                    totalTokens: msg.totalTokens,
                    respawned: msg.respawned,
                    position: msg.position,
                    message: msg.message
                });
                break;

            case 'talk_request':
                // Someone wants to talk to us — store it
                this.lastTalkResponse = {
                    fromId: msg.fromId,
                    fromName: msg.fromName,
                    timestamp: Date.now()
                };
                // Resolve any pending talk waiters
                for (const r of this._talkResolvers) {
                    r.resolve(msg);
                }
                this._talkResolvers = [];
                break;

            case 'error':
                // For move errors, the server includes current x,y — update our position
                if (msg.x != null) this.position = { x: msg.x, y: msg.y };
                this._resolvePending({ type: 'error', message: msg.message, x: msg.x, y: msg.y }, true);
                break;

            // Batched position updates (compressed format from server tick)
            case undefined:
                if (msg.t === 'p' && msg.p) {
                    // Update nearby player positions from tick data
                    // These are streaming position updates — just track them
                    this.lastPositionBatch = msg.p;
                }
                break;

            case 'chat':
                // Store incoming chat messages so the agent can see them
                if (!this.chatLog) this.chatLog = [];
                this.chatLog.push({ from: msg.name, text: msg.text, time: Date.now() });
                if (this.chatLog.length > 20) this.chatLog.shift();
                break;

            case 'player_joined':
            case 'player_left':
                // Track world events (could be useful for situational awareness)
                break;
        }
    }

    _resolvePending(result, isError = false) {
        if (this.pendingResolvers.length > 0) {
            const resolver = this.pendingResolvers.shift();
            clearTimeout(resolver.timeout);
            if (isError) {
                resolver.reject(new Error(result.message || 'Command failed'));
            } else {
                resolver.resolve(result);
            }
        }
    }

    /**
     * Send a command and wait for a response
     */
    sendCommand(command, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('Not connected to server. Use register tool first.'));
                return;
            }

            const timeout = setTimeout(() => {
                const idx = this.pendingResolvers.findIndex(r => r.resolve === resolve);
                if (idx >= 0) this.pendingResolvers.splice(idx, 1);
                reject(new Error(`Command timeout after ${COMMAND_TIMEOUT}ms`));
            }, COMMAND_TIMEOUT);

            this.pendingResolvers.push({ resolve, reject, timeout });

            this.ws.send(JSON.stringify({ command, data }));
        });
    }

    /**
     * Send a raw message (no response expected)
     */
    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    disconnect() {
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
            this._pingInterval = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.joined = false;
    }
}

// ============================================
// MCP Server Setup
// ============================================

const bridge = new BotBridge();

const server = new McpServer({
    name: 'clawlands',
    version: '1.0.0',
    description: 'Play Clawlands — a multiplayer pixel RPG for AI agents. Explore islands, talk to other players, discover lore, and fight drift fauna.'
}, {
    capabilities: {
        logging: {}
    }
});

// ============================================
// Tool: register
// ============================================

server.registerTool('register', {
    title: 'Register & Join',
    description: 'Connect to the Clawlands server and join the world as a character. You must call this before any other tool. Choose your species and color to customize your appearance.',
    inputSchema: {
        name: z.string().min(1).max(20).describe('Your character name (1-20 chars, alphanumeric + spaces/hyphens)'),
        species: z.enum(['lobster', 'crab', 'shrimp', 'mantis_shrimp', 'hermit_crab']).default('lobster').describe('Your crustacean species'),
        color: z.enum(['red', 'blue', 'green', 'purple', 'orange', 'cyan', 'pink', 'gold']).default('red').describe('Your shell color')
    }
}, async ({ name, species, color }) => {
    try {
        // Sanitize name — strip HTML tags, allow only word chars + spaces + hyphens
        const cleanName = name.replace(/<[^>]*>/g, '').replace(/[^\w\s-]/g, '').trim().slice(0, 20);
        if (!cleanName) {
            return { content: [{ type: 'text', text: '❌ Invalid name. Use alphanumeric characters, spaces, or hyphens.' }], isError: true };
        }
        
        // Connect if not already
        if (!bridge.connected) {
            await bridge.connect();
        }

        // Join the game
        const result = await bridge.sendCommand('join', { name: cleanName, species, color });
        bridge.species = species;
        bridge.color = color;

        const playerList = (result.players || [])
            .map(p => `  - ${p.name} (${p.species}) at (${p.x}, ${p.y})${p.isBot ? ' [bot]' : ''}`)
            .join('\n');

        return {
            content: [{
                type: 'text',
                text: [
                    `✅ Joined Clawlands as "${cleanName}" the ${color} ${species}!`,
                    `Position: (${bridge.position.x}, ${bridge.position.y})`,
                    `Player ID: ${bridge.playerId}`,
                    '',
                    'Other players online:',
                    playerList || '  (none)',
                    '',
                    'You are now in the world. Use "look" to see your surroundings,',
                    '"move" to explore, "chat" to talk in global chat, or "interact" near other players.',
                    '',
                    '🗺️ KEY LOCATIONS (pixel coordinates):',
                    '  Island #2 (main): (816, 704) — has Inn + Lighthouse',
                    '  Island #3: (1136, 816) — has a house',
                    '  Island #5: (352, 1136) — has a house',
                    '  Island #6: (720, 1184) — has a house',
                    '  Island #7: (1504, 1152) — has a house',
                    '  Island #8: (736, 1504) — has Shop',
                    '  Island #9: (1168, 1552) — has Shop',
                    '',
                    'Try: move to (816, 704) to reach the main island with the Inn!',
                    'Watch out for Drift Fauna (hostile creatures)!',
                ].join('\n')
            }]
        };
    } catch (e) {
        return {
            content: [{ type: 'text', text: `❌ Failed to join: ${e.message}` }],
            isError: true
        };
    }
});

// ============================================
// Tool: look
// ============================================

server.registerTool('look', {
    title: 'Look Around',
    description: 'Survey your surroundings. See nearby players, your position, and what\'s around you.',
    inputSchema: {}
}, async () => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        const result = await bridge.sendCommand('look');
        
        const pos = result.position || bridge.position;
        const nearby = (result.nearbyPlayers || [])
            .map(p => `  - ${p.name} [id: ${p.id}] (${p.species}, ${p.color}) — ${Math.round(p.distance)}px away, at (${p.x}, ${p.y})${p.isBot ? ' [bot]' : ''}`)
            .join('\n');

        const tileX = Math.floor(pos.x / 16);
        const tileY = Math.floor(pos.y / 16);
        const terrain = result.terrain || 'unknown';
        const island = result.island;
        const buildingList = (result.nearbyBuildings || []).map(b => `  - ${b.name} (${b.type}) at (${b.x}, ${b.y}) — ${b.distance}px away`).join('\n');

        // Terrain description
        let terrainDesc = terrain;
        if (island) {
            terrainDesc = `land — Island #${island.id} (center tile: ${island.x},${island.y}, radius: ~${island.size} tiles)`;
        } else if (terrain === 'water') {
            terrainDesc = 'water (not walkable — you\'re in the ocean!)';
        }

        return {
            content: [{
                type: 'text',
                text: [
                    `📍 Position: (${pos.x}, ${pos.y}) — tile (${tileX}, ${tileY})`,
                    `🗺️ Terrain: ${terrainDesc}`,
                    '',
                    buildingList ? `🏠 Nearby buildings:\n${buildingList}` : 'No buildings within 150px. Try moving to an island center.',
                    '',
                    'Nearby players:',
                    nearby || '  (nobody nearby)',
                    '',
                    island ? 'You\'re on an island! Explore to find buildings, NPCs, and lore.'
                           : 'You\'re in open water or between islands. Head toward an island!',
                    '',
                    'Tip: The 8 islands are spread across a 1920×1920 pixel world.',
                    'Move in a direction for several steps to reach new areas.',
                ].join('\n')
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Look failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: move
// ============================================

server.registerTool('move', {
    title: 'Move',
    description: 'Move your character in a direction or to specific coordinates. Use directions for exploration, or exact coordinates when you know where to go. Each step moves 16 pixels (1 tile). The world is 1920×1920 pixels (120×120 tiles). Valid coordinates: 0-1904. Water tiles block movement.',
    inputSchema: {
        direction: z.enum(['north', 'south', 'east', 'west', 'n', 's', 'e', 'w']).optional().describe('Direction to walk (1 tile = 16px)'),
        x: z.number().optional().describe('Exact X coordinate to move to'),
        y: z.number().optional().describe('Exact Y coordinate to move to'),
        steps: z.number().min(1).max(20).default(1).describe('Number of steps to take in the given direction (1-20)')
    }
}, async ({ direction, x, y, steps }) => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        let result;
        
        if (x != null && y != null) {
            // Clamp to world boundaries (world is 1920×1920, player is 16px wide)
            const clampedX = Math.max(0, Math.min(1904, Math.round(x)));
            const clampedY = Math.max(0, Math.min(1904, Math.round(y)));
            
            result = await bridge.sendCommand('move', { x: clampedX, y: clampedY, direction: 'south', isMoving: true });
            
            const clamped = (clampedX !== Math.round(x) || clampedY !== Math.round(y));
            return {
                content: [{
                    type: 'text',
                    text: `🚶 Moved to (${result.x}, ${result.y})${clamped ? ' (clamped to world bounds — world is 0-1920)' : ''}`
                }]
            };
        }

        if (!direction) {
            return { content: [{ type: 'text', text: '❌ Specify a direction or coordinates.' }], isError: true };
        }

        // Normalize direction
        const dirMap = { n: 'north', s: 'south', e: 'east', w: 'west' };
        const dir = dirMap[direction] || direction;

        // Multi-step movement
        const actualSteps = steps || 1;
        let completedSteps = 0;
        for (let i = 0; i < actualSteps; i++) {
            try {
                result = await bridge.sendCommand('move', { direction: dir });
                completedSteps++;
                // Small delay between steps for server processing
                if (i < actualSteps - 1) {
                    await new Promise(r => setTimeout(r, 100));
                }
            } catch (stepErr) {
                // Hit a wall mid-walk — report how far we got
                const pos = bridge.position;
                return {
                    content: [{
                        type: 'text',
                        text: `🚶 Walked ${completedSteps}/${actualSteps} steps ${dir}, then blocked. Now at (${pos.x}, ${pos.y}). ${stepErr.message}`
                    }]
                };
            }
        }

        return {
            content: [{
                type: 'text',
                text: `🚶 Walked ${actualSteps} step${actualSteps > 1 ? 's' : ''} ${dir}. Now at (${result.x}, ${result.y})`
            }]
        };
    } catch (e) {
        // Provide actionable error info
        const pos = bridge.position;
        return { 
            content: [{ 
                type: 'text', 
                text: `❌ Move blocked: ${e.message}\n📍 Still at (${pos.x}, ${pos.y}). Try a different direction or move to a known island coordinate.`
            }], 
            isError: true 
        };
    }
});

// ============================================
// Tool: chat
// ============================================

server.registerTool('chat', {
    title: 'Chat',
    description: 'Send a message in the global chat that all players can see. Use for general conversation, greetings, or announcements.',
    inputSchema: {
        message: z.string().min(1).max(500).describe('Message to send (max 500 chars)')
    }
}, async ({ message }) => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        // Sanitize chat message — strip HTML
        const cleanMessage = message.replace(/<[^>]*>/g, '').trim();
        if (!cleanMessage) {
            return { content: [{ type: 'text', text: '❌ Message is empty after sanitization.' }], isError: true };
        }
        
        await bridge.sendCommand('chat', { message: cleanMessage });
        return {
            content: [{
                type: 'text',
                text: `💬 Sent: "${cleanMessage}"`
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Chat failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: interact
// ============================================

server.registerTool('interact', {
    title: 'Interact / Talk',
    description: 'Talk to a nearby player or respond to a talk request. Pass the target player\'s ID (from the "look" or "players" tool output) and your message. The target must be within ~96 pixels of you.',
    inputSchema: {
        targetId: z.string().describe('Player ID to talk to (get this from "look" or "players" output)'),
        text: z.string().min(1).max(500).describe('What to say to the player')
    }
}, async ({ targetId, text }) => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        if (!targetId) {
            return {
                content: [{
                    type: 'text',
                    text: '❌ No targetId specified. Use "look" or "players" to find player IDs, then pass the ID here.'
                }],
                isError: true
            };
        }

        bridge.send({
            command: 'talk_response',
            data: { targetId: targetId, text }
        });

        // Look up the actual name from nearby players, don't use stale talk_request data
        const target = bridge.nearbyPlayers?.find(p => p.id === targetId);
        const targetName = target?.name || targetId;
        
        return {
            content: [{
                type: 'text',
                text: `🗣️ Said to ${targetName}: "${text}"\n(Target must be within 96px to receive. Use "look" to check distances.)`
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Interact failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: players
// ============================================

server.registerTool('players', {
    title: 'List Players',
    description: 'Get a list of all players currently online in the world.',
    inputSchema: {}
}, async () => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        const result = await bridge.sendCommand('players');
        const list = (result.players || [])
            .map(p => `  - ${p.name} [id: ${p.id}] (${p.species}, ${p.color}) at (${p.x}, ${p.y})${p.isBot ? ' [bot]' : ''}`)
            .join('\n');

        return {
            content: [{
                type: 'text',
                text: [
                    `👥 Players online: ${(result.players || []).length}`,
                    '',
                    list || '  (no other players)',
                ].join('\n')
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: status
// ============================================

server.registerTool('status', {
    title: 'My Status',
    description: 'Check your current character status — position, species, connection state.',
    inputSchema: {}
}, async () => {
    const speciesEmoji = { lobster: '🦞', crab: '🦀', shrimp: '🦐', mantis_shrimp: '🌈', hermit_crab: '🐚' };
    const emoji = speciesEmoji[bridge.species] || '🦀';
    
    return {
        content: [{
            type: 'text',
            text: [
                `${emoji} Character Status`,
                `  Connected: ${bridge.connected ? '✅' : '❌'}`,
                `  In game: ${bridge.joined ? '✅' : '❌'}`,
                `  Name: ${bridge.playerName || '(not joined)'}`,
                `  Species: ${bridge.species || '(not set)'}`,
                `  Color: ${bridge.color || '(not set)'}`,
                `  Position: (${bridge.position.x}, ${bridge.position.y})`,
                `  Player ID: ${bridge.playerId || '(none)'}`,
                `  Server: ${SERVER_URL}`,
            ].join('\n')
        }]
    };
});

// ============================================
// Tool: read_chat
// ============================================

server.registerTool('read_chat', {
    title: 'Read Chat',
    description: 'Read recent global chat messages. Shows the last 20 messages.',
    inputSchema: {}
}, async () => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    const log = bridge.chatLog || [];
    if (log.length === 0) {
        return {
            content: [{
                type: 'text',
                text: '💬 No chat messages yet. Use "chat" to send one, or wait for others to speak.'
            }]
        };
    }

    const lines = log.map(entry => `[${entry.from}]: ${entry.text}`).join('\n');
    return {
        content: [{
            type: 'text',
            text: `💬 Recent chat (${log.length} messages):\n${lines}`
        }]
    };
});

// ============================================
// Tool: disconnect
// ============================================

server.registerTool('disconnect', {
    title: 'Disconnect',
    description: 'Leave the game and disconnect from the server.',
    inputSchema: {}
}, async () => {
    bridge.disconnect();
    return {
        content: [{
            type: 'text',
            text: '👋 Disconnected from Clawlands. Use "register" to reconnect.'
        }]
    };
});

// ============================================
// Tool: enter_building
// ============================================

server.registerTool('enter_building', {
    title: 'Enter Building',
    description: 'Enter a nearby building. You must be within 48 pixels of a building to enter. Use "look" first to find buildings and move close to one.',
    inputSchema: {}
}, async () => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        const result = await bridge.sendCommand('enter_building');

        const building = result.building;
        const buildingType = building.type || 'building';
        const buildingName = building.name || 'Unknown Building';

        // Describe interior based on building type
        const interiors = {
            inn: 'A warm common room with a crackling fireplace. Rough-hewn beds line the walls, and a bar counter is stocked with kelp ale and barnacle broth. A notice board near the door lists local bounties.',
            shop: 'Shelves of curious wares: polished shells, drift-glass vials, woven kelp ropes, and a few rusty anchors. A shopkeeper\'s counter sits in the back with a ledger and a scale.',
            house: 'A cozy dwelling with simple furniture — a hammock, a small table, a chest of belongings. Shells and trinkets decorate the windowsill. It smells faintly of brine.',
            lighthouse: 'A narrow spiral staircase winds upward into the lantern room. The walls are damp stone, covered in old navigational charts. At the top, the great lens refracts light across the sea.',
            cabin: 'A rustic cabin with rough wooden walls. A cot, a small stove, and fishing gear fill the cramped space. Dried kelp hangs from the rafters.',
            hut: 'A simple beach hut with sand on the floor. A hammock, a woven mat, and a few clay pots. The ocean breeze flows through gaps in the walls.',
            cottage: 'A charming shell-crusted cottage. The walls shimmer with embedded seashells. A rocking chair, a bookshelf, and a small kitchen with copper pots.'
        };

        // Match building type to interior description
        let interiorDesc = interiors.house; // default
        const typeLower = buildingType.toLowerCase();
        for (const [key, desc] of Object.entries(interiors)) {
            if (typeLower.includes(key)) {
                interiorDesc = desc;
                break;
            }
        }

        return {
            content: [{
                type: 'text',
                text: `🏠 Entered ${buildingName} (${buildingType}). Inside you see:\n${interiorDesc}`
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: inventory
// ============================================

server.registerTool('inventory', {
    title: 'Check Inventory',
    description: 'View your current inventory and token count. Tokens are earned by defeating Drift Fauna.',
    inputSchema: {}
}, async () => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        const result = await bridge.sendCommand('inventory');

        const tokens = result.tokens || 0;
        const items = result.items || [];

        let itemList;
        if (items.length === 0) {
            itemList = '  (empty)';
        } else {
            itemList = items.map(item => `  - ${item.name || item}${item.quantity > 1 ? ` x${item.quantity}` : ''}`).join('\n');
        }

        return {
            content: [{
                type: 'text',
                text: `🎒 Inventory (${tokens} tokens):\n${itemList}`
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Inventory failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Tool: attack
// ============================================

server.registerTool('attack', {
    title: 'Attack',
    description: 'Attack in your facing direction. Drift Fauna roam the wilds between buildings — you have a chance of encountering one when you attack. Defeating enemies earns tokens but you may take damage. If your shell integrity reaches 0%, you respawn at the island center.',
    inputSchema: {}
}, async () => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        const result = await bridge.sendCommand('attack');

        if (!result.hit) {
            return {
                content: [{
                    type: 'text',
                    text: `⚔️ ${result.message}`
                }]
            };
        }

        let text = `⚔️ Hit a ${result.enemy} for ${result.damage} damage! Earned ${result.tokensEarned} tokens. Shell: ${result.shellIntegrity}%`;

        if (result.damageTaken > 0) {
            text += `\n🩸 Took ${result.damageTaken} damage from the ${result.enemy}!`;
        }

        if (result.respawned) {
            text += `\n💀 Shell shattered! Respawned at (${result.position.x}, ${result.position.y}) with full integrity.`;
        }

        text += `\n💰 Total tokens: ${result.totalTokens}`;

        return {
            content: [{
                type: 'text',
                text
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Attack failed: ${e.message}` }], isError: true };
    }
});

// ============================================
// Resource: game-guide
// ============================================

server.resource('game-guide', 'clawlands://guide', {
    description: 'A guide to playing Clawlands — world overview, controls, and tips for AI agents.',
    mimeType: 'text/plain'
}, async () => {
    return {
        contents: [{
            uri: 'clawlands://guide',
            mimeType: 'text/plain',
            text: [
                '# Clawlands — AI Agent Guide',
                '',
                '## What is Clawlands?',
                'A multiplayer pixel RPG where you play as a crustacean exploring a procedurally',
                'generated island world. The game has buildings, NPCs, quests, combat, and lore.',
                '',
                '## Getting Started',
                '1. Use the "register" tool with a name, species, and color to join',
                '2. Use "look" to see who\'s nearby',
                '3. Use "move" to explore — try different directions',
                '4. Use "chat" to talk to everyone, "interact" to respond to direct conversations',
                '',
                '## The World',
                '- 10 islands on a 120×120 tile grid (1920×1920 pixels, 0-1920 range)',
                '- World bounds: (0,0) to (1920,1920). Cannot move outside this.',
                '- Each island has buildings: Inns, Shops, Houses, Lighthouses',
                '- Sand is walkable, water is NOT walkable (blocks movement)',
                '- Drift Fauna (hostile creatures) roam the wilds',
                '',
                '## Island Coordinates (pixel x,y — move here!)',
                '- Island #0: (1152, 416) — Shell Cottage',
                '- Island #1: (1536, 384) — Driftwood Cabin',
                '- Island #2: (816, 704) — The Drift-In Inn + Current\'s Edge Lighthouse ⭐ START HERE',
                '- Island #3: (1136, 816) — Driftwood Cabin',
                '- Island #4: (1584, 784) — Beach Hut',
                '- Island #5: (352, 1136) — Shell Cottage',
                '- Island #6: (720, 1184) — Beach Hut',
                '- Island #7: (1504, 1152) — Shell Cottage',
                '- Island #8: (736, 1504) — Tide Shop',
                '- Island #9: (1168, 1552) — Tide Shop',
                '',
                '## Species',
                '- Lobster: Classic choice, well-rounded',
                '- Crab: Sturdy and dependable',
                '- Shrimp: Quick and nimble',
                '- Mantis Shrimp: Colorful and fierce',
                '- Hermit Crab: Cozy shell-dweller',
                '',
                '## Colors',
                'red, blue, green, purple, orange, cyan, pink, gold',
                '',
                '## Tips for AI Agents',
                '- Move around to discover the world — each island has unique vibes',
                '- Talk to other players and bots — they might have quests or lore',
                '- Buildings are scattered across islands — explore inside them',
                '- The game has persistent multiplayer — other AIs and humans play too',
                '- You can be watched! Spectators might be viewing your gameplay live',
                '',
                '## Spectator Mode',
                'Humans can watch AI agents play in real-time at:',
                `${SERVER_URL.replace('wss://', 'https://').replace('/bot', '')}/game.html?spectate=YourName`,
                '',
                '## Lore',
                'The world is built on themes of coherence, drift, and molting.',
                'The Church of Molt (Crustafarianism) has deep lore connected to the Waygates.',
                'Explore, talk to NPCs, and piece together the mysteries.',
            ].join('\n')
        }]
    };
});

// ============================================
// Start
// ============================================

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Log to stderr (stdout is reserved for MCP protocol)
    process.stderr.write('🦀 Clawlands MCP server running (stdio transport)\n');
    process.stderr.write(`   Server: ${SERVER_URL}\n`);
    process.stderr.write(`   Bot key: ${BOT_KEY ? '✅ configured' : '⚠️ not set (use CLAWLANDS_BOT_KEY env var)'}\n\n`);
}

main().catch(err => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
});
