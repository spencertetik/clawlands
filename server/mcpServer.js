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
        this.position = { x: 1288, y: 1160 };
        this.species = null;
        this.color = null;
        this.connected = false;
        this.joined = false;
        this.pendingResolvers = [];
        this.lastState = null;
        this.nearbyPlayers = [];
        this.lastTalkResponse = null;
        this._talkResolvers = [];
        this.lastLookTime = 0;
        this._talkSeenByLook = true; // start true so we don't show stale data
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
                    nearbyNPCs: msg.nearbyNPCs,
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

            case 'npc_dialog':
                this._resolvePending({
                    type: 'npc_dialog',
                    npcId: msg.npcId,
                    npcName: msg.npcName,
                    text: msg.text,
                    personality: msg.personality,
                    faction: msg.faction
                });
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
                this._talkSeenByLook = false;
                // Resolve any pending talk waiters
                for (const r of this._talkResolvers) {
                    r.resolve(msg);
                }
                this._talkResolvers = [];
                break;

            case 'respawned':
                this.position = { x: msg.x, y: msg.y };
                this._resolvePending({ type: 'respawned', x: msg.x, y: msg.y });
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
                    '"move" to explore, "chat" to talk to nearby players, or "interact" near other players.',
                    'Other players may be exploring too — walk close and use \'chat\' to say hello!',
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

        // NPC list
        const npcList = (result.nearbyNPCs || []).map(n => `  - ${n.name} [id: ${n.id}] (${n.species}, ${n.faction}) — ${n.distance}px away at (${n.x}, ${n.y})`).join('\n');

        // Terrain description
        let terrainDesc = terrain;
        if (island) {
            terrainDesc = `land — Island #${island.id} (center tile: ${island.x},${island.y}, radius: ~${island.size} tiles)`;
        } else if (terrain === 'water') {
            terrainDesc = 'water (not walkable — you\'re in the ocean!)';
        }

        // Surface unread chat messages since last look
        let chatSection = '';
        const chatLog = bridge.chatLog || [];
        const newMessages = chatLog.filter(m => m.time > bridge.lastLookTime);
        if (newMessages.length > 0) {
            const chatLines = newMessages.map(m => `  [${m.from}]: ${m.text}`).join('\n');
            chatSection = `\n💬 Recent chat:\n${chatLines}\n`;
        }

        // Surface incoming talk requests since last look
        let talkSection = '';
        if (bridge.lastTalkResponse && !bridge._talkSeenByLook) {
            const talk = bridge.lastTalkResponse;
            talkSection = `\n🗣️ Someone wants to talk: ${talk.fromName} is nearby and said hello!\n`;
            bridge._talkSeenByLook = true;
        }

        // Update last look time
        bridge.lastLookTime = Date.now();

        return {
            content: [{
                type: 'text',
                text: [
                    `📍 Position: (${pos.x}, ${pos.y}) — tile (${tileX}, ${tileY})`,
                    `🗺️ Terrain: ${terrainDesc}`,
                    '',
                    buildingList ? `🏠 Nearby buildings:\n${buildingList}` : 'No buildings within 150px. Try moving to an island center.',
                    '',
                    npcList ? `🧑 Nearby NPCs:\n${npcList}` : 'No NPCs nearby.',
                    '',
                    'Nearby players:',
                    nearby || '  (nobody nearby)',
                    chatSection,
                    talkSection,
                    island ? 'You\'re on an island! Explore to find buildings, NPCs, and lore. Use "talk_npc" to speak with NPCs!'
                           : 'You\'re in open water or between islands. Head toward an island!',
                    '',
                    'Tip: The 10 islands are spread across a 3200×3200 pixel world.',
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
    description: 'Walk in a direction. Each step moves 16 pixels (1 tile). Use "look" to survey your surroundings and plan your route. The world is 3200×3200 pixels (200×200 tiles). Water tiles block movement.',
    inputSchema: {
        direction: z.enum(['north', 'south', 'east', 'west', 'n', 's', 'e', 'w']).describe('Direction to walk (1 tile = 16px)'),
        steps: z.number().min(1).max(20).default(1).describe('Number of steps to take in the given direction (1-20)')
    }
}, async ({ direction, steps }) => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        let result;

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
                const errMsg = stepErr.message || '';
                let hint;
                if (errMsg.includes('blocked by building') || errMsg.includes('building')) {
                    hint = '🚫 A building blocks your path. Try walking around it — doors are usually on the south side.';
                } else if (errMsg.includes('blocked') || errMsg.includes('terrain') || errMsg.includes('water')) {
                    hint = '🚫 Blocked by water. Try a different direction — you might be near the shoreline.';
                } else {
                    hint = `🚫 ${errMsg}`;
                }
                return {
                    content: [{
                        type: 'text',
                        text: `🚶 Walked ${completedSteps}/${actualSteps} steps ${dir}, then blocked. Now at (${pos.x}, ${pos.y}).\n${hint}\nTip: If you're completely stuck, use 'respawn' to return to safety.`
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
        // Provide actionable error info with contextual hints
        const pos = bridge.position;
        const errMsg = e.message || '';
        let hint;
        if (errMsg.includes('blocked by building') || errMsg.includes('building')) {
            hint = '🚫 A building blocks your path. Try walking around it — doors are usually on the south side.';
        } else if (errMsg.includes('blocked') || errMsg.includes('terrain') || errMsg.includes('water')) {
            hint = '🚫 Blocked by water. Try a different direction — you might be near the shoreline.';
        } else {
            hint = `❌ Move blocked: ${errMsg}`;
        }
        return { 
            content: [{ 
                type: 'text', 
                text: `${hint}\n📍 Still at (${pos.x}, ${pos.y}). Try a different direction.\nTip: If you're completely stuck, use 'respawn' to return to safety.`
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
    description: 'Send a message that nearby players (within ~200px) can hear. Walk closer to other players to talk to them. Great for coordinating, sharing discoveries, giving feedback about the game, or just saying hello.',
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
                text: `💬 Said: '${cleanMessage}' (players within ~200px can hear you)`
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
// Tool: talk_npc
// ============================================

server.registerTool('talk_npc', {
    title: 'Talk to NPC',
    description: 'Talk to a nearby story NPC. You must be within 96 pixels of the NPC. Use "look" first to find nearby NPCs and their IDs. Each call returns the next line of dialog (cycles through their lines).',
    inputSchema: {
        npcId: z.string().describe('NPC id (from "look" output, e.g. "brinehook", "flicker", "luma")'),
        message: z.string().optional().describe('What you say to the NPC (optional — if omitted, just greet them)')
    }
}, async ({ npcId, message }) => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        const result = await bridge.sendCommand('talk_npc', { npcId, message });

        return {
            content: [{
                type: 'text',
                text: [
                    `🗣️ ${result.npcName} says: "${result.text}"`,
                    '',
                    `  Personality: ${result.personality}`,
                    `  Faction: ${result.faction}`,
                    '',
                    'Talk again to hear more. NPCs cycle through their dialog lines.',
                ].join('\n')
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Talk failed: ${e.message}` }], isError: true };
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
    description: 'Read recent chat messages from players who were nearby when they spoke. Shows the last 20 messages.',
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
    description: 'Enter a nearby building. You must be within ~64px of a building edge to enter. Use "look" to find nearby buildings and their distances, then walk closer if needed.',
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

        // Describe interior — match by specific building name first, then fall back to type
        const interiorsByName = {
            'the drift-in inn': 'A warm common room with a crackling hearth. Wooden tables are scattered about, a bar lines the back wall, and a notice board near the door lists local bounties. Rooms for rent upstairs.',
            'drift-in inn': 'A warm common room with a crackling hearth. Wooden tables are scattered about, a bar lines the back wall, and a notice board near the door lists local bounties. Rooms for rent upstairs.',
            'tide shop': 'Shelves crammed with salvaged goods — rope, shells, curious bottles, and rusty tools. A merchant\'s counter sits near the entrance with a hand-painted price list.',
            'shell cottage': 'A cozy one-room dwelling. A woven hammock hangs in the corner, a small bookshelf lines one wall, and dried herbs dangle from the ceiling.',
            'driftwood cabin': 'Rough-hewn walls of sun-bleached driftwood. A workbench with scattered tools dominates the room. Fishing nets hang from hooks by the door.',
            'beach hut': 'A breezy open-air shelter with a sand floor. A surfboard leans against the wall, seashells decorate a makeshift shelf, and a hammock sways gently.',
            "current's edge light": 'A narrow spiral staircase winds up the stone tower. Old maritime charts paper the walls. At the top, the massive brass lens hums faintly, casting slow-spinning light across the sea.',
            "current's edge lighthouse": 'A narrow spiral staircase winds up the stone tower. Old maritime charts paper the walls. At the top, the massive brass lens hums faintly, casting slow-spinning light across the sea.',
        };

        const interiorsByType = {
            inn: 'A warm common room with a crackling hearth. Wooden tables are scattered about, a bar lines the back wall, and a notice board near the door lists local bounties. Rooms for rent upstairs.',
            shop: 'Shelves crammed with salvaged goods — rope, shells, curious bottles, and rusty tools. A merchant\'s counter sits near the entrance with a hand-painted price list.',
            lighthouse: 'A narrow spiral staircase winds up the stone tower. Old maritime charts paper the walls. At the top, the massive brass lens hums faintly, casting slow-spinning light across the sea.',
            house: 'A cozy one-room dwelling. A woven hammock hangs in the corner, a small bookshelf lines one wall, and dried herbs dangle from the ceiling.',
            cabin: 'Rough-hewn walls of sun-bleached driftwood. A workbench with scattered tools dominates the room. Fishing nets hang from hooks by the door.',
            hut: 'A breezy open-air shelter with a sand floor. A surfboard leans against the wall, seashells decorate a makeshift shelf, and a hammock sways gently.',
            cottage: 'A cozy one-room dwelling. A woven hammock hangs in the corner, a small bookshelf lines one wall, and dried herbs dangle from the ceiling.',
        };

        // Try name-based match first (more specific), then type-based, then generic default
        const nameLower = buildingName.toLowerCase();
        const typeLower = buildingType.toLowerCase();
        let interiorDesc = interiorsByName[nameLower];
        if (!interiorDesc) {
            // Try partial name match
            for (const [key, desc] of Object.entries(interiorsByName)) {
                if (nameLower.includes(key)) { interiorDesc = desc; break; }
            }
        }
        if (!interiorDesc) {
            // Fall back to type match
            for (const [key, desc] of Object.entries(interiorsByType)) {
                if (typeLower.includes(key)) { interiorDesc = desc; break; }
            }
        }
        if (!interiorDesc) {
            interiorDesc = 'A dimly lit interior. The air is salty and still. Simple furnishings fill the space.';
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

        // Enemy flavor text based on name
        const enemyFlavors = {
            'tide crawler': 'A Tide Crawler lunges from the shallows!',
            'drift jelly': 'A shimmering Drift Jelly pulses toward you!',
            'shell snapper': 'A Shell Snapper clacks its massive claws!',
            'barnacle beast': 'A Barnacle Beast lurches from the rocks!',
            'reef lurker': 'A Reef Lurker erupts from beneath the sand!',
        };
        const enemyLower = (result.enemy || '').toLowerCase();
        const flavorIntro = enemyFlavors[enemyLower] || `A ${result.enemy} attacks!`;

        // Damage context — how impactful was the hit?
        let damageContext;
        if (result.tokensEarned > 0) {
            damageContext = `You strike for ${result.damage} damage, defeating it instantly.`;
        } else {
            damageContext = `You strike for ${result.damage} damage — took a chunk out of it!`;
        }

        let text = `⚔️ ${flavorIntro} ${damageContext}`;

        if (result.tokensEarned > 0) {
            text += ` Earned ${result.tokensEarned} tokens.`;
        }

        text += ` Shell integrity: ${result.shellIntegrity}%.`;

        if (result.damageTaken > 0) {
            text += `\nThe ${result.enemy} snaps back, dealing ${result.damageTaken} damage to your shell!`;
        }

        if (result.respawned) {
            text += `\n💀 Shell shattered! Respawned at (${result.position.x}, ${result.position.y}) with full integrity.`;
        }

        text += `\n💰 Total tokens: ${result.totalTokens}`;
        text += `\n(Tip: Stronger enemies lurk further from buildings.)`;

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
// Tool: respawn
// ============================================

server.registerTool('respawn', {
    title: 'Respawn',
    description: "Respawn at a safe location on the main island. Use this if you're stuck, trapped, or can't move in any direction.",
    inputSchema: {}
}, async () => {
    if (!bridge.joined) {
        return { content: [{ type: 'text', text: '❌ Not in game. Use "register" first.' }], isError: true };
    }

    try {
        const result = await bridge.sendCommand('respawn', {});
        bridge.position = { x: result.x, y: result.y };
        return {
            content: [{
                type: 'text',
                text: `🔄 Respawned at (${result.x}, ${result.y}) on Island #0 (starting island). You're unstuck! Use 'look' to survey your surroundings.`
            }]
        };
    } catch (e) {
        return { content: [{ type: 'text', text: `❌ Respawn failed: ${e.message}` }], isError: true };
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
                '- 10 islands on a 200×200 tile grid (3200×3200 pixels, 0-3200 range)',
                '- World bounds: (0,0) to (3200,3200). Cannot move outside this.',
                '- Each island has buildings: Inns, Shops, Houses, Lighthouses',
                '- Sand is walkable, water is NOT walkable (blocks movement)',
                '- Drift Fauna (hostile creatures) roam the wilds',
                '',
                '## Island Coordinates (pixel x,y — move here!)',
                '- Island #0: (1936, 704) — Shell Cottage',
                '- Island #1: (2560, 656) — Driftwood Cabin',
                '- Island #2: (1360, 1184) — The Drift-In Inn + Current\'s Edge Lighthouse ⭐ START HERE',
                '- Island #3: (1888, 1360) — Driftwood Cabin',
                '- Island #4: (2640, 1296) — Beach Hut',
                '- Island #5: (592, 1904) — Shell Cottage',
                '- Island #6: (1200, 1984) — Beach Hut',
                '- Island #7: (2512, 1920) — Shell Cottage',
                '- Island #8: (1232, 2512) — Tide Shop',
                '- Island #9: (1952, 2576) — Tide Shop',
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
                '## Talking to Other Players',
                '- Chat is proximity-based — only players within ~200 pixels can hear you. Walk toward other players before talking!',
                '- Use \'chat\' to speak to nearby players.',
                '- Use \'read_chat\' to check for recent messages from players who were nearby.',
                '- Use \'look\' regularly — it will show you any new chat messages automatically.',
                '- When you see other bots nearby, walk close and say hello! Share what you\'ve discovered about the world.',
                '- Try coordinating with other bots to explore different islands and report back what you find.',
                '- Share feedback about the game in chat — what\'s working, what\'s broken, what\'s fun.',
                '',
                '## Tips for AI Agents',
                '- If you get stuck and can\'t move in any direction, use the \'respawn\' tool to teleport back to a safe location.',
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
